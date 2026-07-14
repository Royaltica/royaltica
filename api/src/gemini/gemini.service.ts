import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UsageFeature } from '@prisma/client';
import type { Env } from '../config/env.validation';
import { UsageService } from '../usage/usage.service';
import { extractText } from './vertex-response.util';

/** Contexto opcional para registrar el costo (tokens) del llamado a Gemini. */
export interface GeminiUsageContext {
  organizationId: string;
  feature: UsageFeature;
}

/**
 * Abstracción de Google Gemini (vía Vertex AI) para análisis de texto
 * (auditoría forense de facturas, principalmente).
 *
 * Si VERTEX_PROJECT_ID no está configurado, el servicio corre en modo "stub":
 * `isConfigured` es false y `generateJson` devuelve null. El consumidor
 * (InvoiceAuditService) usa entonces solo sus heurísticas deterministas,
 * de modo que la auditoría sigue funcionando sin la API en desarrollo.
 *
 * El SDK @google-cloud/vertexai se carga con import dinámico para no
 * penalizar el arranque cuando no se usa.
 */
@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private modelName = 'gemini-2.5-flash';
  // Tipado laxo: el SDK se carga dinámicamente solo si está configurado.
  private model: import('@google-cloud/vertexai').GenerativeModel | null =
    null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly usage: UsageService,
  ) {}

  async onModuleInit(): Promise<void> {
    const project = this.config.get('VERTEX_PROJECT_ID', { infer: true });
    if (!project) {
      this.logger.warn(
        'Gemini NO configurado (falta VERTEX_PROJECT_ID). La auditoría usará solo heurísticas deterministas.',
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
    this.model = client.getGenerativeModel({ model: this.modelName });
    this.logger.log(
      `Gemini inicializado vía Vertex AI (proyecto: ${project}, modelo: ${this.modelName}).`,
    );
  }

  get isConfigured(): boolean {
    return this.model !== null;
  }

  /**
   * Envía un prompt pidiendo una respuesta JSON y la parsea.
   * Devuelve null si Gemini no está configurado o si la respuesta no es
   * JSON válido (el consumidor debe tolerar la ausencia de resultado).
   */
  async generateJson<T = Record<string, unknown>>(
    prompt: string,
    ctx?: GeminiUsageContext,
  ): Promise<T | null> {
    if (!this.model) return null;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      });

      // Cost tracking de tokens (fire-and-forget) si el consumidor dio contexto.
      if (ctx) {
        const um = result.response.usageMetadata;
        void this.usage.record({
          organizationId: ctx.organizationId,
          feature: ctx.feature,
          inputTokens: um?.promptTokenCount ?? 0,
          outputTokens: um?.candidatesTokenCount ?? 0,
        });
      }

      const text = extractText(result.response);
      return JSON.parse(text) as T;
    } catch (err) {
      this.logger.warn(
        `Fallo al obtener/parsear respuesta de Gemini: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }
}
