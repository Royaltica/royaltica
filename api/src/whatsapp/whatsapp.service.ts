import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
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

    let sent = 0;
    await Promise.all(
      admins.map(async (a) => {
        if (!a.whatsappPhone) return;
        const res = await this.sendMessage(a.whatsappPhone, text);
        if (res.sent) sent += 1;
      }),
    );
    return { recipients: admins.length, sent };
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
