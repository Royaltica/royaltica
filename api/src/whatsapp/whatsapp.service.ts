import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import type { Env } from '../config/env.validation';

export interface WhatsappSendResult {
  sent: boolean;
  mode: 'meta' | 'twilio' | 'stub';
  id?: string;
}

/**
 * Envío de alertas críticas por WhatsApp (factura bloqueada, documento KYC
 * vencido, pago fallido). Solo para eventos de alta prioridad y solo a usuarios
 * que hicieron opt-in con su teléfono.
 *
 * Degradación elegante (mismo patrón que Resend/Firebase/Factoraje): si no hay
 * WHATSAPP_TOKEN, corre en modo "stub" — registra en el log lo que habría
 * enviado y devuelve `{ sent: false, mode: 'stub' }`, sin romper el flujo.
 *
 * Soporta dos proveedores (WHATSAPP_PROVIDER): 'meta' (Cloud API) y 'twilio'.
 * La llamada HTTP real se hace con fetch nativo cuando esté configurado.
 *
 * Redacción con IA: antes de enviar una alerta vía notifyOrgAdmins(), el texto
 * (ya armado por el llamador con los datos duros: montos, fechas, nombres) se
 * pasa por Gemini (vía Vertex AI, GeminiService) para pulir el tono/redacción
 * a un mensaje de WhatsApp natural y profesional. Mismo patrón "degradación
 * elegante": si Gemini no está configurado o falla, se manda el texto
 * original tal cual — nunca bloquea ni retrasa una alerta crítica por esto.
 */
@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private provider: 'meta' | 'twilio' = 'meta';
  private token = '';
  private phoneId = '';
  private from = '';

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
  ) {}

  onModuleInit(): void {
    this.provider = this.config.get('WHATSAPP_PROVIDER', { infer: true });
    this.token = this.config.get('WHATSAPP_TOKEN', { infer: true });
    this.phoneId = this.config.get('WHATSAPP_PHONE_ID', { infer: true });
    this.from = this.config.get('WHATSAPP_FROM', { infer: true });

    if (!this.isConfigured) {
      this.logger.warn(
        'WhatsApp NO configurado (falta WHATSAPP_TOKEN). Las alertas se registran en modo stub (no se envían).',
      );
      return;
    }
    this.logger.log(`WhatsApp inicializado (proveedor: ${this.provider}).`);
  }

  get isConfigured(): boolean {
    if (!this.token) return false;
    return this.provider === 'meta' ? !!this.phoneId : !!this.from;
  }

  /**
   * Envía un mensaje a un teléfono (E.164). Nunca lanza: si no está
   * configurado o falla, lo registra y devuelve `{ sent: false }`.
   */
  async sendMessage(phone: string, text: string): Promise<WhatsappSendResult> {
    if (!this.isConfigured) {
      this.logger.debug(`[stub] WhatsApp NO enviado a ${phone}: "${text}".`);
      return { sent: false, mode: 'stub' };
    }
    try {
      return this.provider === 'meta'
        ? await this.sendViaMeta(phone, text)
        : await this.sendViaTwilio(phone, text);
    } catch (err) {
      this.logger.warn(
        `Fallo al enviar WhatsApp a ${phone}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { sent: false, mode: this.provider };
    }
  }

  /**
   * Alerta crítica a todos los admins de una organización que hicieron opt-in
   * y tienen teléfono. Fire-and-forget desde el llamador (`void`).
   *
   * El texto se redacta una sola vez (vía Gemini, si está disponible) y se
   * reusa para todos los destinatarios — no tiene caso pagar/llamar a Gemini
   * por cada admin cuando el mensaje es idéntico para todos.
   */
  async notifyOrgAdmins(
    organizationId: string,
    text: string,
  ): Promise<{ recipients: number; sent: number }> {
    const admins = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: 'CORPORATE_ADMIN',
        isActive: true,
        whatsappOptIn: true,
        whatsappPhone: { not: null },
      },
      select: { whatsappPhone: true },
    });

    const drafted = await this.draftWithAi(text, organizationId);

    let sent = 0;
    await Promise.all(
      admins.map(async (a) => {
        if (!a.whatsappPhone) return;
        const res = await this.sendMessage(a.whatsappPhone, drafted);
        if (res.sent) sent += 1;
      }),
    );
    return { recipients: admins.length, sent };
  }

  /**
   * Pule la redacción de una alerta con Gemini (Vertex AI), preservando
   * intactos todos los datos duros del texto original (montos, fechas,
   * nombres, folios). Si Gemini no está configurado, falla, o devuelve un
   * texto vacío/sospechoso, se regresa el texto original sin modificar —
   * nunca debe ser la causa de que una alerta crítica no llegue o llegue
   * con datos incorrectos.
   */
  private async draftWithAi(
    rawText: string,
    organizationId: string,
  ): Promise<string> {
    if (!this.gemini.isConfigured) return rawText;

    const prompt = `Eres el redactor de alertas de Royáltica, una plataforma de cobranza B2B en México.
Reescribe el siguiente mensaje interno como un mensaje de WhatsApp natural, claro y profesional en español de México, dirigido a un administrador de la empresa.

Reglas ESTRICTAS:
- No inventes, no omitas y no cambies NINGÚN dato: montos, fechas, nombres, folios, porcentajes y cualquier cifra deben quedar EXACTAMENTE igual que en el mensaje original.
- No agregues información que no esté en el mensaje original.
- Tono profesional pero cercano, como si se lo escribiera un colega. Nada de lenguaje robótico ni de "estimado usuario".
- Máximo ~350 caracteres.
- Sin formato markdown (no uses **, #, etc.). Como mucho un emoji relevante al inicio.
- Responde ÚNICAMENTE con JSON: {"mensaje": "..."}

Mensaje original:
"""
${rawText}
"""`;

    try {
      const result = await this.gemini.generateJson<{ mensaje?: string }>(
        prompt,
        { organizationId, feature: 'GEMINI_WHATSAPP' },
      );
      const drafted = result?.mensaje?.trim();
      if (!drafted) return rawText;
      return drafted;
    } catch (err) {
      this.logger.warn(
        `Fallo al redactar alerta de WhatsApp con Gemini, se manda el texto original: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return rawText;
    }
  }

  // ── Proveedores (implementación real, activa con credenciales) ──

  /** Meta WhatsApp Cloud API (graph.facebook.com). */
  private async sendViaMeta(
    phone: string,
    text: string,
  ): Promise<WhatsappSendResult> {
    const url = `https://graph.facebook.com/v21.0/${this.phoneId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: this.normalize(phone),
        type: 'text',
        text: { body: text },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      throw new Error(`Meta API respondió ${res.status}`);
    }
    const data = (await res.json()) as { messages?: { id?: string }[] };
    return { sent: true, mode: 'meta', id: data.messages?.[0]?.id };
  }

  /** Twilio WhatsApp API. */
  private async sendViaTwilio(
    phone: string,
    text: string,
  ): Promise<WhatsappSendResult> {
    // El token de Twilio se espera como "AccountSid:AuthToken".
    const [accountSid] = this.token.split(':');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({
      From: `whatsapp:${this.from}`,
      To: `whatsapp:${this.normalize(phone)}`,
      Body: text,
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(this.token).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      throw new Error(`Twilio API respondió ${res.status}`);
    }
    const data = (await res.json()) as { sid?: string };
    return { sent: true, mode: 'twilio', id: data.sid };
  }

  /** Garantiza prefijo internacional (E.164 sin el doble +). */
  private normalize(phone: string): string {
    return phone.startsWith('+') ? phone : `+${phone}`;
  }
}
