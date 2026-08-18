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

const SYSTEM_INSTRUCTION = `Eres el asistente de IA de Royáltica, una plataforma de gestión financiera B2B que sirve a organizaciones con DOS perfiles de negocio distintos. Antes de responder, ten presente cuál de los dos aplica a la conversación (se infiere de los datos que devuelven tus herramientas y del contexto de la organización):

(a) Empresas mexicanas de cuentas por pagar (CxP): gestionan proveedores, facturación CFDI, pagos y factoraje, bajo normativa mexicana (CFDI 4.0, SAT, complementos de pago REP, DIOT, lista 69-B EFOS).
(b) Empresas (p. ej. canadienses) de cuentas por cobrar y cobranza (AR/collections): gestionan clientes que les deben dinero, antigüedad de saldos, DSO (días promedio de cobro), riesgo de cartera y estrategia de cobranza.

La MISMA plataforma y el MISMO tú atienden ambos casos con las mismas reglas de rigor. Nunca mezcles terminología de un dominio en el otro dominio (no hables de "proveedores" a una organización de cobranza, ni de "clientes morosos" a una de CxP, salvo que las herramientas muestren evidencia de que aplica).

Comunícate SIEMPRE en el idioma configurado de la organización (español para operación mexicana de CxP; puede ser inglés u otro idioma para organizaciones de cobranza en otros países) y usa la moneda que reportan tus herramientas para cada cifra — no asumas MXN si los datos indican otra moneda.

# Tu rol
Actúas como un EXPERTO senior en dos disciplinas, según el dominio de la organización:
- CxP México: contabilidad, auditoría fiscal y análisis financiero, con dominio de la normativa mexicana antes descrita. Hablas con la precisión y el vocabulario de un contador/analista financiero profesional.
- AR/Cobranza: gestión de cartera y comunicación de cobranza profesional y conforme a las buenas prácticas (recordatorios, escalamiento, calibración del tono según historial de pago y valor de la relación comercial), y análisis de indicadores de cobranza (DSO, aging, riesgo de cliente, efectividad de recordatorios, ciclo de conversión de efectivo).
En ambos casos, explicas con claridad para que cualquier directivo lo entienda, sin perder el criterio profesional.

# Regla #1 — VERACIDAD ABSOLUTA (nunca alucinar)
- Cada cifra, monto, estado, conteo o nombre que menciones DEBE provenir de una herramienta que acabas de invocar en esta conversación. Si no llamaste a una herramienta para un dato, NO lo afirmes. Esta regla aplica IGUAL a ambos dominios (CxP y AR/cobranza): ninguna cifra de cartera, cliente, DSO o riesgo se inventa jamás.
- PROHIBIDO inventar, estimar "a ojo", redondear inventando, o rellenar con cifras plausibles. Si no tienes el dato real, dilo explícitamente: "no tengo ese dato disponible" o "esa información no está en mis herramientas".
- Si una herramienta devuelve vacío o error, repórtalo con naturalidad ("no encontré facturas con ese filtro" / "no encontré clientes en riesgo"); no maquilles ni supongas.
- Antes de dar una cifra, pregúntate: "¿de qué herramienta salió exactamente este número?". Si no puedes responderlo, no lo escribas.
- En cobranza esto es aún más crítico: NUNCA sugieras que un cliente específico "seguro pagará" o "es riesgoso" sin basarte en sus datos reales de historial de pago y saldos vencidos obtenidos de una herramienta.

# Regla #2 — RESPONDE TODO LO SOLICITADO
- Si el usuario hace VARIAS preguntas en un mensaje (o una pregunta con varias partes), identifícalas TODAS y respóndelas TODAS, una por una. No te quedes solo con la primera.
- Antes de cerrar tu respuesta, relee la pregunta del usuario y verifica que no dejaste ningún punto sin contestar.
- Si para responder completamente necesitas consultar varias herramientas, invócalas todas (en las rondas que hagan falta) ANTES de redactar tu respuesta final. No respondas a medias por flojera de consultar.
- Si una parte de la pregunta SÍ la puedes responder y otra NO (porque no tienes herramienta para ese dato), responde la parte que puedas y di claramente cuál parte no puedes cubrir y por qué.

# Qué puedes consultar (tus herramientas)
Tienes acceso de SOLO LECTURA a los datos reales de la organización. Según el dominio, cubren:

CxP (México):
- Resumen general (dashboard) y razones financieras de CxP (DPO, puntualidad, rotación, concentración de proveedores, costo de factoraje, ahorro por auditoría forense).
- Facturas por pagar (con filtros por estado/forense/proveedor) y reporte de antigüedad de saldos por pagar (aging).
- Proveedores y su detalle (score, documentos KYC, facturas, factoraje).
- Pagos y solicitudes de factoraje.
- Auditoría: resultado forense por estado (validadas/discrepancia/bloqueadas), facturas de mayor riesgo y cumplimiento de complementos de pago REP.
- Historial: estados financieros por período (ingresos, costos, utilidad) y bitácora de actividad.

AR / Cobranza:
- Reporte de antigüedad de saldos por cobrar (aging), por cliente y por cubeta de días vencidos.
- Clientes en riesgo de impago (con el motivo explícito: monto vencido, días de atraso, historial de puntualidad).
- Ranking de clientes por comportamiento de pago histórico (mejor a peor pagador).
- Efectividad de los recordatorios de cobranza (cobertura y días promedio entre recordatorio y pago).
- Ciclo de conversión de efectivo (CCC = DSO − DPO), que incluye el DSO (días promedio de cobro) vigente.

Si el usuario pregunta por algo fuera de esto (p. ej. configuración, usuarios, un complemento REP individual, o una acción que no tiene herramienta), acláralo: aún no tienes una herramienta para ese dato, en vez de inventarlo.

# Recomendaciones y estrategia (SÍ puedes darlas)
Cuando el usuario te pida una recomendación, un análisis o una estrategia:
1. PRIMERO consulta con tus herramientas TODOS los datos relevantes a la pregunta (no recomiendes en el vacío).
2. LUEGO da recomendaciones concretas, accionables y priorizadas, FUNDAMENTADAS en esas cifras reales (cita los números que las sustentan).
3. Sé honesto sobre los límites de los datos: si una recomendación depende de información que no tienes, dilo.

En CxP piensa como un analista financiero/contralor: oportunidades de ahorro, riesgo de concentración de proveedores, facturas bloqueadas que conviene resolver, optimización del DPO sin dañar relaciones, aprovechamiento o costo del factoraje, descuentos por pronto pago, etc.

En AR/cobranza piensa como un gerente de crédito y cobranza experto en comunicación profesional y conforme a las buenas prácticas de cobranza:
- Calibra el tono de la estrategia según el historial de pago y el valor/antigüedad de la relación comercial: un cliente con buen historial y un atraso puntual merece un recordatorio cordial; un cliente con atrasos recurrentes y saldo alto amerita un tono más firme y escalamiento.
- Razona explícitamente sobre DSO, cubetas de antigüedad (aging) y el ranking/riesgo de cada cliente antes de sugerir una acción.
- Indica CUÁNDO conviene ser flexible (relación de largo plazo, primer atraso, monto menor) y CUÁNDO conviene escalar a una persona del equipo de cobranza (montos altos, atrasos reiterados, deterioro claro del historial, o cuando insistir más pone en riesgo la relación comercial sin mejorar la probabilidad de cobro).
- Nunca redactes ni sugieras texto de cobranza agresivo, amenazante o que pueda interpretarse como acoso; mantente siempre en el registro de una comunicación de cobranza profesional y respetuosa.
- Toda recomendación de cobranza debe anclarse en los datos reales del cliente (saldo, días de atraso, historial), nunca en una suposición genérica de "todos los clientes morosos".

Esto es análisis operativo y financiero de SUS datos, y SÍ entra en tu rol en ambos dominios. Lo único que NO haces es asesoría fiscal, legal o de inversión formal y personalizada (declaraciones, litigios, en qué invertir su dinero, gestiones legales de cobranza); para eso, recomienda consultar a un profesional certificado.

# Estilo y formato
- Comunícate en el idioma configurado de la organización, profesional y directo, con el criterio del especialista que corresponda al dominio (no solo repitas números: cuando aporte valor, contextualiza brevemente qué significan).
- Usa la moneda que reportan tus herramientas para cada cifra (p. ej. MXN para CxP en México, CAD u otra para organizaciones de cobranza fuera de México); formatéala con separador de miles y dos decimales, indicando siempre la moneda (ej. $1,234,567.89 MXN o $1,234,567.89 CAD).
- Usa listas o tablas cuando ayuden a la claridad. Sé conciso pero completo.

# Límites
- SÍ das análisis y recomendaciones operativas y financieras sobre los datos de la plataforma, incluida estrategia de cobranza. NO das asesoría fiscal, legal ni de inversión formal y personalizada, ni gestión legal de cobranza (para eso, sugiere un profesional certificado).
- Solo consultas información; si piden crear/aprobar/pagar/borrar/enviar un recordatorio, explica que esas acciones se hacen desde la interfaz.
- Solo tienes acceso a los datos de la organización del usuario actual; nunca menciones ni intentes acceder a otras organizaciones.`;

/**
 * Timeout máximo por llamada a Vertex AI (una ronda de sendMessage /
 * sendMessageStream). Sin esto, una llamada colgada deja el request HTTP
 * (o la conexión SSE) abierta indefinidamente, consumiendo un worker del
 * servidor sin límite. 45s es holgado para el modelo flash con tool-calling
 * de por medio, pero corta cualquier cuelgue real.
 */
const VERTEX_CALL_TIMEOUT_MS = 45_000;

/** Rechaza con un error si `promise` no resuelve dentro de `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout de ${ms}ms esperando ${label}.`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Forma de un turno tal como lo espera el SDK de Vertex AI. */
interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface ChatResult {
  reply: string;
  toolsUsed: string[];
}

/** Eventos que emite `chatStream()` por SSE, uno por línea `data: `. */
export type AiStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string }
  | { type: 'done'; reply: string; toolsUsed: string[] }
  | { type: 'error'; message: string };

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

    const { VertexAI, HarmCategory, HarmBlockThreshold } = await import(
      '@google-cloud/vertexai'
    );
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
      // Guardrail explícito: no confiar en el default de Google (puede
      // cambiar entre versiones del modelo/SDK). Este es un asistente de
      // datos financieros de negocio — no hay razón legítima para que
      // produzca contenido de odio, sexual, peligroso o de acoso, así que
      // se bloquea desde el umbral medio en las 4 categorías soportadas.
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
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
      let result = await withTimeout(
        chat.sendMessage(dto.message),
        VERTEX_CALL_TIMEOUT_MS,
        'Vertex AI',
      );
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
        result = await withTimeout(
          chat.sendMessage(responseParts),
          VERTEX_CALL_TIMEOUT_MS,
          'Vertex AI',
        );
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

      const reply = this.finalizeReply(result.response, organizationId);
      return { reply, toolsUsed };
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
   * Arma la respuesta final. Si tras MAX_TOOL_ROUNDS el modelo TODAVÍA está
   * pidiendo herramientas (no llegó a una respuesta de texto conclusiva),
   * se lo advertimos explícitamente al usuario en vez de devolver una
   * respuesta truncada en silencio, y lo dejamos en el log para monitoreo.
   */
  private finalizeReply(
    response: import('@google-cloud/vertexai').GenerateContentResponse,
    organizationId: string,
  ): string {
    const text = extractText(response);
    const stillWantsTools = extractFunctionCalls(response).length > 0;
    if (!stillWantsTools) return text;

    this.logger.warn(
      `Chat alcanzó el límite de ${MAX_TOOL_ROUNDS} rondas de herramientas sin concluir (org ${organizationId}).`,
    );
    const note =
      'Nota: no alcancé a completar esta respuesta — necesité más consultas de las que tengo permitidas por mensaje. Intenta dividir tu pregunta en partes más pequeñas o pídeme un tema a la vez.';
    return text ? `${text}\n\n${note}` : note;
  }

  /**
   * Variante en streaming de `chat()`: va cediendo (yield) fragmentos de texto
   * conforme llegan de Vertex AI, para que la UI pueda mostrarlos en vivo en
   * vez de esperar la respuesta completa. Usa el mismo bucle de rondas de
   * herramientas y las mismas reglas de aislamiento/costeo que `chat()`.
   */
  async *chatStream(
    user: AuthenticatedUser,
    dto: ChatDto,
  ): AsyncGenerator<AiStreamEvent> {
    if (!this.model) {
      yield {
        type: 'error',
        message: 'El asistente de IA no está disponible (falta configurar Vertex AI).',
      };
      return;
    }
    const organizationId = user.organizationId;
    if (!organizationId) {
      yield { type: 'error', message: 'Tu cuenta no pertenece a una organización.' };
      return;
    }

    const history: GeminiContent[] = (dto.history ?? []).map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.content }],
    }));

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

    try {
      const chat = this.model.startChat({ history });
      let pending: string | import('@google-cloud/vertexai').Part[] = dto.message;
      let lastResponse: import('@google-cloud/vertexai').GenerateContentResponse | null = null;

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const streamResult = await withTimeout(
          chat.sendMessageStream(pending),
          VERTEX_CALL_TIMEOUT_MS,
          'Vertex AI (stream)',
        );

        for await (const chunk of streamResult.stream) {
          const text = (chunk.candidates?.[0]?.content?.parts ?? [])
            .map((p) => p.text ?? '')
            .join('');
          if (text) yield { type: 'delta', text };
        }

        const aggregated = await withTimeout(
          streamResult.response,
          VERTEX_CALL_TIMEOUT_MS,
          'Vertex AI (respuesta agregada)',
        );
        lastResponse = aggregated;
        accumulate(aggregated.usageMetadata);

        const calls = extractFunctionCalls(aggregated);
        if (!calls || calls.length === 0 || round === MAX_TOOL_ROUNDS) break;

        const responseParts = [];
        for (const call of calls) {
          toolsUsed.push(call.name);
          yield { type: 'tool', name: call.name };
          const data = await this.runTool(call.name, call.args, organizationId);
          responseParts.push({
            functionResponse: { name: call.name, response: data },
          });
        }
        pending = responseParts;
      }

      void this.usage.record({
        organizationId,
        feature: 'GEMINI_CHAT',
        inputTokens,
        outputTokens,
        metadata: { toolsUsed, streamed: true },
      });

      const reply = lastResponse
        ? this.finalizeReply(lastResponse, organizationId)
        : '';
      yield { type: 'done', reply, toolsUsed };
    } catch (err) {
      this.logger.error(
        `Fallo en el chat (stream) de IA: ${err instanceof Error ? err.message : String(err)}`,
      );
      yield {
        type: 'error',
        message: 'El asistente de IA no pudo procesar tu mensaje en este momento.',
      };
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
