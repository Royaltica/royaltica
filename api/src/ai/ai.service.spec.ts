import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { AiService } from './ai.service';
import { AiToolsService } from './ai-tools.service';
import { UsageService } from '../usage/usage.service';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

/**
 * Simulador de la API de Vertex AI para pruebas locales.
 *
 * Este sandbox no tiene salida de red hacia generativelanguage.googleapis.com
 * (ni hacia ningún host fuera de un allowlist reducido), así que no es
 * posible probar una llamada real a Gemini/Vertex desde aquí — con o sin
 * credenciales. Esta suite simula el `GenerativeModel` del SDK
 * (@google-cloud/vertexai) devolviendo respuestas fabricadas con la MISMA
 * forma que devuelve la API real, para poder probar todo el pipeline del
 * agente (bucle de tool-calling, límite de rondas, timeout, aislamiento de
 * organizationId, streaming) sin depender de la red ni de credenciales
 * reales. Es el equivalente a un "fake" de integración, no un mock trivial.
 */
function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    firebaseUid: 'fb-1',
    email: 'admin@royaltica.com',
    role: 'CORPORATE_ADMIN' as UserRole,
    organizationId: 'org-1',
    permissions: [],
    supplierId: null,
    ...overrides,
  };
}

function textResponse(text: string) {
  return {
    response: {
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    },
  };
}

function toolCallResponse(name: string, args: Record<string, unknown>) {
  return {
    response: {
      candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    },
  };
}

describe('AiService (simulación de Vertex AI, sin red)', () => {
  let service: AiService;
  let tools: { execute: jest.Mock };
  let usage: { record: jest.Mock };
  let prisma: { withOrg: jest.Mock };
  let sendMessage: jest.Mock;
  let fakeModel: { startChat: jest.Mock };

  beforeEach(() => {
    tools = { execute: jest.fn().mockResolvedValue({ ok: true }) };
    usage = { record: jest.fn() };
    prisma = { withOrg: jest.fn((_org, fn) => fn(prisma)) };

    sendMessage = jest.fn();
    fakeModel = {
      startChat: jest.fn(() => ({ sendMessage })),
    };

    service = new AiService(
      { get: jest.fn() } as never,
      tools as unknown as AiToolsService,
      usage as unknown as UsageService,
      prisma as unknown as PrismaService,
    );
    // Inyecta el modelo simulado directamente, saltando onModuleInit() (que
    // hace el import dinámico real del SDK) — así la prueba no toca la red.
    (service as unknown as { model: unknown }).model = fakeModel;
  });

  it('reporta isConfigured=true solo cuando hay modelo inicializado', () => {
    expect(service.isConfigured).toBe(true);
    (service as unknown as { model: unknown }).model = null;
    expect(service.isConfigured).toBe(false);
  });

  it('responde 503 si Vertex AI no está configurado', async () => {
    (service as unknown as { model: unknown }).model = null;
    await expect(service.chat(makeUser(), { message: 'hola' })).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('responde 403 si el usuario no pertenece a una organización (nunca confía en el modelo para esto)', async () => {
    await expect(
      service.chat(makeUser({ organizationId: null }), { message: 'hola' }),
    ).rejects.toThrow(ForbiddenException);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('responde directo cuando el modelo no pide herramientas', async () => {
    sendMessage.mockResolvedValueOnce(textResponse('Tienes 3 facturas pendientes.'));

    const result = await service.chat(makeUser(), { message: '¿cuántas facturas pendientes tengo?' });

    expect(result.reply).toBe('Tienes 3 facturas pendientes.');
    expect(result.toolsUsed).toEqual([]);
    expect(tools.execute).not.toHaveBeenCalled();
  });

  it('ejecuta el bucle de tool-calling y SIEMPRE usa el organizationId del JWT, nunca uno inventado por el modelo', async () => {
    sendMessage
      .mockResolvedValueOnce(toolCallResponse('getPendingInvoices', { organizationId: 'org-ATACANTE' }))
      .mockResolvedValueOnce(textResponse('Tienes 2 facturas pendientes por $50,000 MXN.'));

    const result = await service.chat(makeUser({ organizationId: 'org-1' }), {
      message: '¿cuántas facturas pendientes tengo?',
    });

    expect(tools.execute).toHaveBeenCalledWith(
      'getPendingInvoices',
      expect.any(Object),
      'org-1', // el organizationId real del JWT, no el que mandó el modelo en args
    );
    expect(result.toolsUsed).toEqual(['getPendingInvoices']);
    expect(result.reply).toContain('2 facturas pendientes');
  });

  it('corta en MAX_TOOL_ROUNDS y avisa al usuario en vez de responder a medias en silencio', async () => {
    // El modelo simulado SIEMPRE pide una herramienta más — nunca concluye.
    sendMessage.mockImplementation(() =>
      Promise.resolve(toolCallResponse('getPendingInvoices', {})),
    );

    const result = await service.chat(makeUser(), { message: 'dame un análisis completo' });

    expect(result.toolsUsed.length).toBeGreaterThan(0);
    expect(result.reply).toMatch(/no alcancé a completar/i);
  });

  it('si una herramienta falla, no tumba la conversación: el modelo recibe un error legible', async () => {
    tools.execute.mockRejectedValueOnce(new Error('DB caída'));
    sendMessage
      .mockResolvedValueOnce(toolCallResponse('getPendingInvoices', {}))
      .mockResolvedValueOnce(textResponse('No pude consultar tus facturas en este momento.'));

    const result = await service.chat(makeUser(), { message: '¿cuántas facturas pendientes tengo?' });

    expect(result.reply).toContain('No pude consultar');
    // La segunda llamada a sendMessage debe haber recibido un functionResponse
    // con el payload de error genérico, no el error crudo de la excepción.
    const secondCallArgs = sendMessage.mock.calls[1][0];
    expect(secondCallArgs[0].functionResponse.response.error).toMatch(
      /no se pudo obtener/i,
    );
  });

  it('registra el uso de tokens vía UsageService (fire-and-forget)', async () => {
    sendMessage.mockResolvedValueOnce(textResponse('ok'));
    await service.chat(makeUser(), { message: 'hola' });
    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', feature: 'GEMINI_CHAT' }),
    );
  });

  it('convierte un timeout de Vertex AI en un 503 legible en vez de colgar el request', async () => {
    jest.useFakeTimers();
    // El modelo simulado nunca resuelve — simula una llamada colgada.
    sendMessage.mockReturnValueOnce(new Promise(() => {}));

    const chatPromise = service.chat(makeUser(), { message: 'hola' });
    const assertion = expect(chatPromise).rejects.toThrow(ServiceUnavailableException);
    await jest.advanceTimersByTimeAsync(46_000);
    await assertion;

    jest.useRealTimers();
  });

  describe('chatStream (SSE)', () => {
    it('emite delta -> done sin herramientas', async () => {
      const sendMessageStream = jest.fn().mockResolvedValue({
        stream: (async function* () {
          yield { candidates: [{ content: { parts: [{ text: 'Hola' }] } }] };
          yield { candidates: [{ content: { parts: [{ text: ' mundo' }] } }] };
        })(),
        response: Promise.resolve(textResponse('Hola mundo').response),
      });
      fakeModel.startChat = jest.fn(() => ({ sendMessageStream }));

      const events = [];
      for await (const ev of service.chatStream(makeUser(), { message: 'saluda' })) {
        events.push(ev);
      }

      expect(events).toEqual([
        { type: 'delta', text: 'Hola' },
        { type: 'delta', text: ' mundo' },
        { type: 'done', reply: 'Hola mundo', toolsUsed: [] },
      ]);
    });

    it('emite un evento tool cuando el modelo invoca una herramienta en streaming', async () => {
      let call = 0;
      const sendMessageStream = jest.fn().mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return Promise.resolve({
            stream: (async function* () {})(),
            response: Promise.resolve(
              toolCallResponse('getPendingInvoices', {}).response,
            ),
          });
        }
        return Promise.resolve({
          stream: (async function* () {
            yield { candidates: [{ content: { parts: [{ text: 'Tienes 1 factura.' }] } }] };
          })(),
          response: Promise.resolve(textResponse('Tienes 1 factura.').response),
        });
      });
      fakeModel.startChat = jest.fn(() => ({ sendMessageStream }));

      const events = [];
      for await (const ev of service.chatStream(makeUser(), { message: '¿facturas?' })) {
        events.push(ev);
      }

      expect(events).toContainEqual({ type: 'tool', name: 'getPendingInvoices' });
      expect(events.at(-1)).toEqual({
        type: 'done',
        reply: 'Tienes 1 factura.',
        toolsUsed: ['getPendingInvoices'],
      });
    });

    it('emite un evento error si Vertex AI no está configurado', async () => {
      (service as unknown as { model: unknown }).model = null;
      const events = [];
      for await (const ev of service.chatStream(makeUser(), { message: 'hola' })) {
        events.push(ev);
      }
      expect(events).toEqual([
        { type: 'error', message: expect.stringContaining('no está disponible') },
      ]);
    });
  });

  describe('recordFeedback', () => {
    it('guarda el feedback sin lanzar aunque falle la escritura (nunca rompe la UX del chat)', async () => {
      prisma.withOrg.mockRejectedValueOnce(new Error('DB caída'));
      const result = await service.recordFeedback(makeUser(), {
        rating: 'DOWN',
        question: '¿cuánto debo?',
        answer: 'no sé',
        toolsUsed: [],
      });
      expect(result).toEqual({ ok: true });
    });

    it('rechaza si el usuario no tiene organización', async () => {
      await expect(
        service.recordFeedback(makeUser({ organizationId: null }), {
          rating: 'UP',
          question: 'q',
          answer: 'a',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
