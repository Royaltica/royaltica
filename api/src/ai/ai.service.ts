import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UsageService } from '../usage/usage.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiToolsService } from './ai-tools.service';
import { AI_TOOL_DECLARATIONS } from './ai-tool.definitions';
import { extractText, extractFunctionCalls } from '../gemini/vertex-response.util';
import type { ChatDto } from './dto/chat.dto';
import type { FeedbackDto } from './dto/feedback.dto';

/**
 * Tope de rondas de herramientas por mensaje. Cada ronda = el modelo pide una
 * o más herramientas y nosotros le devolvemos los resultados. Evita un bucle
 * infinito si el modelo se queda pidiendo datos sin concluir.
 */
const MAX_TOOL_ROUNDS = 6;

const SYSTEM_INSTRUCTION = `Eres el asistente de IA de Royáltica, una plataforma mexicana de gestión de cuentas por pagar (CxP), proveedores, facturación CFDI, pagos y factoraje.

# Tu rol
Actúas como un EXPERTO senior en contabilidad, auditoría fiscal y análisis financiero, con dominio de la normativa mexicana (CFDI 4.0, SAT, complementos de pago REP, DIOT, lista 69-B EFOS). Hablas con la precisión, el criterio y el vocabulario de un contador y analista financiero profesional, pero explicas con claridad para que cualquier directivo lo entienda.

# Regla #1 — VERACIDAD ABSOLUTA (nunca alucinar)
- Cada cifra, monto, estado, conteo o nombre que menciones DEBE provenir de una herramienta que acabas de invocar en esta conversación. Si no llamaste a una herramienta para un dato, NO lo afirmes.
- PROHIBIDO inventar, estimar "a ojo", redondear inventando, o rellenar con cifras plausibles. Si no tienes el dato real, dilo explícitamente: "no tengo ese dato disponible" o "esa información no está en mis herramientas".
- Si una herramienta devuelve vacío o error, repórtalo con naturalidad ("no encontré facturas con ese filtro"); no maquilles ni supongas.
- Antes de dar una cifra, pregúntate: "¿de qué herramienta salió exactamente este número?". Si no puedes responderlo, no lo escribas.

# Regla #2 — RESPONDE TODO LO SOLICITADO
- Si el usuario hace VARIAS preguntas en un mensaje (o una pregunta con varias partes), identifícalas TODAS y respóndelas TODAS, una por una. No te quedes solo con la primera.
- Antes de cerrar tu respuesta, relee la pregunta del usuario y verifica que no dejaste ningún punto sin contestar.
- Si para responder completamente necesitas consultar varias herramientas, invócalas todas (en las rondas que hagan falta) ANTES de redactar tu respuesta final. No respondas a medias por flojera de consultar.
- Si una parte de la pregunta SÍ la puedes responder y otra NO (porque no tienes herramienta para ese dato), responde la parte que puedas y di claramente cuál parte no puedes cubrir y por qué.

# Qué puedes consultar (tus herramientas)
Tienes acceso de SOLO LECTURA a los datos reales de la organización, que cubren las pestañas de la plataforma:
- Resumen general (dashboard) y razones financieras de CxP (DPO, puntualidad, rotación, concentración de proveedores, costo de factoraje, ahorro por auditoría forense).
- Facturas (con filtros por estado/forense/proveedor) y reporte de antigüedad de saldos (aging).
- Proveedores y su detalle (score, documentos KYC, facturas, factoraje).
- Pagos y solicitudes de factoraje.
- Auditoría: resultado forense por estado (validadas/discrepancia/bloqueadas), facturas de mayor riesgo y cumplimiento de complementos de pago REP.
- Historial: estados financieros por período (ingresos, costos, utilidad) y bitácora de actividad.
Si el usuario pregunta por algo fuera de esto (p. ej. configuración, usuarios, un complemento REP individual), acláralo: aún no tienes una herramienta para ese dato, en vez de inventarlo.

# Recomendaciones y estrategia (SÍ puedes darlas)
Cuando el usuario te pida una recomendación, un análisis o una estrategia ("¿qué me recomiendas?", "¿qué harías con estos datos?", "¿cómo mejoro mi flujo?"):
1. PRIMERO consulta con tus herramientas TODOS los datos relevantes a la pregunta (no recomiendes en el vacío).
2. LUEGO da recomendaciones concretas, accionables y priorizadas, FUNDAMENTADAS en esas cifras reales (cita los números que las sustentan). Piensa como un analista financiero/contralor: oportunidades de ahorro, riesgo de concentración de proveedores, facturas bloqueadas que conviene resolver, optimización del DPO sin dañar relaciones, aprovechamiento o costo del factoraje, descuentos por pronto pago, etc.
3. Sé honesto sobre los límites de los datos: si una recomendación depende de información que no tienes, dilo.
Esto es análisis operativo y financiero de SUS datos, y SÍ entra en tu rol. Lo único que NO haces es asesoría fiscal, legal o de inversión formal y personalizada (declaraciones, litigios, en qué invertir su dinero); para eso, recomienda consultar a un profesional certificado.

# Estilo y formato
- Responde SIEMPRE en español, profesional y directo, con criterio de analista financiero (no solo repitas números: cuando aporte valor, contextualiza brevemente qué significan).
- Montos en pesos mexicanos (MXN) salvo que la factura indique otra moneda; formatéalos con separador de miles y dos decimales (ej. $1,234,567.89 MXN).
- Usa listas o tablas cuando ayuden a la claridad. Sé conciso pero completo.

# Límites
- SÍ das análisis y recomendaciones operativas y financieras sobre los datos de la plataforma. NO das asesoría fiscal, legal ni de inversión formal y personalizada (para eso, sugiere un profesional certificado).
- Solo consultas información; si piden crear/aprobar/pagar/borrar, explica que esas acciones se hacen desde la interfaz.
- Solo tienes acceso a los datos de la organización del usuario actual; nunca menciones ni intentes acceder a otras organizaciones.`;

/** Forma de un turno tal como lo espera el SDK de Vertex AI. */
interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface ChatResult {
  reply: string;
  toolsUsed: string[];
}

/**
 * Asistente conversacional con function-calling de Gemini (vía Vertex AI).
 *
 * Si VERTEX_PROJECT_ID no está configurado, el servicio corre en modo "no
 * disponible": `isConfigured` es false y `chat()` lanza 503. El SDK
 * @google-cloud/vertexai se carga con import dinámico (igual que GeminiService)
 * para no penalizar el arranque cuando la IA no se usa.
 */
@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private readonly modelName = 'gemini-2.5-flash';
  private model: import('@google-cloud/vertexai').GenerativeModel | null =
    null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly tools: AiToolsService,
    private readonly usage: UsageService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Guarda la calificación del usuario sobre una respuesta del asistente.
   * Es la base de la "retroalimentación": las marcadas DOWN son las que luego
   * se revisan para afinar el prompt o agregar herramientas. No lanza si algo
   * falla (el feedback nunca debe romper la UX del chat).
   */
  async recordFeedback(
    user: AuthenticatedUser,
    dto: FeedbackDto,
  ): Promise<{ ok: true }> {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    try {
      await this.prisma.withOrg(organizationId, (tx) =>
        tx.aiFeedback.create({
          data: {
            organizationId,
            userId: user.id,
            rating: dto.rating,
            question: dto.question,
            answer: dto.answer,
            comment: dto.comment ?? null,
            toolsUsed: dto.toolsUsed ?? [],
          },
        }),
      );
    } catch (err) {
      this.logger.warn(
        `No se pudo guardar el feedback: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return { ok: true };
  }

  async onModuleInit(): Promise<void> {
    const project = this.config.get('VERTEX_PROJECT_ID', { infer: true });
    if (!project) {
      this.logger.warn(
        'Asistente IA NO disponible (falta VERTEX_PROJECT_ID). POST /ai/chat devolverá 503.',
      );
      return;
    }
    const location = this.config.get('VERTEX_LOCATION', { infer: true });
    const keyFile = this.config.get('VERTEX_KEY_FILE', { infer: true });

    const { VertexAI } = await import('@google-cloud/vertexai');
    const client = new VertexAI({
      project,
      location,
      googleAuthOptions: keyFile ? { keyFilename: keyFile } : undefined,
    });
    this.model = client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ functionDeclarations: AI_TOOL_DECLARATIONS }],
      // Temperatura baja: respuestas más deterministas y apegadas a los datos,
      // menos "creatividad" (menos alucinación). topP acota igual el muestreo.
      generationConfig: { temperature: 0.2, topP: 0.8 },
    });
    this.logger.log(
      `Asistente IA inicializado vía Vertex AI (proyecto: ${project}, modelo: ${this.modelName}).`,
    );
  }

  get isConfigured(): boolean {
    return this.model !== null;
  }

  async chat(user: AuthenticatedUser, dto: ChatDto): Promise<ChatResult> {
    if (!this.model) {
      throw new ServiceUnavailableException(
        'El asistente de IA no está disponible (falta configurar Vertex AI).',
      );
    }
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }

    const history: GeminiContent[] = (dto.history ?? []).map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.content }],
    }));

    try {
      const chat = this.model.startChat({ history });
      let result = await chat.sendMessage(dto.message);
      const toolsUsed: string[] = [];
      let inputTokens = 0;
      let outputTokens = 0;
      const accumulate = (um?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      }) => {
        inputTokens += um?.promptTokenCount ?? 0;
        outputTokens += um?.candidatesTokenCount ?? 0;
      };
      accumulate(result.response.usageMetadata);

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const calls = extractFunctionCalls(result.response);
        if (!calls || calls.length === 0) break;

        const responseParts = [];
        for (const call of calls) {
          toolsUsed.push(call.name);
          const data = await this.runTool(call.name, call.args, organizationId);
          responseParts.push({
            functionResponse: { name: call.name, response: data },
          });
        }
        result = await chat.sendMessage(responseParts);
        accumulate(result.response.usageMetadata);
      }

      // Cost tracking de tokens del chat (fire-and-forget).
      void this.usage.record({
        organizationId,
        feature: 'GEMINI_CHAT',
        inputTokens,
        outputTokens,
        metadata: { toolsUsed },
      });

      return { reply: extractText(result.response), toolsUsed };
    } catch (err) {
      this.logger.error(
        `Fallo en el chat de IA: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        'El asistente de IA no pudo procesar tu mensaje en este momento.',
      );
    }
  }

  /**
   * Ejecuta una herramienta de forma defensiva: el `organizationId` viene del
   * JWT (no del modelo) y cualquier error se convierte en un payload de error
   * para que el modelo lo explique, en vez de tumbar toda la conversación.
   */
  private async runTool(
    name: string,
    args: unknown,
    organizationId: string,
  ): Promise<Record<string, unknown>> {
    try {
      const safeArgs =
        args && typeof args === 'object'
          ? (args as Record<string, unknown>)
          : {};
      return await this.tools.execute(name, safeArgs, organizationId);
    } catch (err) {
      this.logger.warn(
        `Herramienta ${name} falló: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { error: 'No se pudo obtener la información solicitada.' };
    }
  }
}
