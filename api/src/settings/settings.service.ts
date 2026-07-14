import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Configuración tipada de una organización. Se persiste en el campo JSON
 * `Organization.settings`. Cualquier campo ausente cae a su default, así
 * que el resto del código nunca lee `undefined`.
 */
/** Un autorizador operativo configurado en la organización. */
export interface AuthorizerEntry {
  name: string;
  cargo: string;
  email: string;
}

/** Tope de firmas requeridas (autorizadores que cuentan para aprobar). */
export const MAX_REQUIRED_SIGNATURES = 5;

export interface OrgSettings {
  /** Modo multi-usuario (varios usuarios por área) vs un solo admin. */
  multiUserEnabled: boolean;
  /**
   * Autorizadores operativos configurados en Configuración → Autorización.
   * Su CANTIDAD define `requiredSignatures`: 0 autorizadores = aprobación
   * automática (se salta la firma), 1 = una firma, 2 = dos firmas, etc.
   */
  authorizers: AuthorizerEntry[];
  /**
   * Firmas requeridas para aprobar una factura. DERIVADO de `authorizers`
   * (= número de autorizadores operativos, acotado a MAX_REQUIRED_SIGNATURES).
   * No se fija a mano: cambia al agregar/quitar autorizadores.
   */
  requiredSignatures: number;
  /** Días de anticipación para alertar documentos KYC por vencer. */
  documentAlertDays: number;
  /** Comisión de factoraje propia de la organización (porcentaje). */
  factorajeFeePercent: number;
  /** Proporción del gasto que se considera "costo" vs "OPEX" (0-1). */
  costRatio: number;
  /** Régimen fiscal del receptor (para CFDI / reportes). */
  fiscalRegimen: string | null;
  /** Domicilio fiscal del receptor. */
  fiscalAddress: string | null;
  /** Nombre visible en reportes (si difiere de la razón social). */
  displayName: string | null;
  /** ERP del corporativo para sincronización (aspel|bind|odoo|null). */
  erpProvider: string | null;
}

export const DEFAULT_SETTINGS: OrgSettings = {
  multiUserEnabled: false,
  authorizers: [],
  // 0 autorizadores ⇒ aprobación automática (se salta la firma).
  requiredSignatures: 0,
  documentAlertDays: 15,
  factorajeFeePercent: 0,
  costRatio: 0.7,
  fiscalRegimen: null,
  fiscalAddress: null,
  displayName: null,
  erpProvider: null,
};

/** ERPs soportados por los conectores (adaptadores). */
export const SUPPORTED_ERPS = ['aspel', 'bind', 'odoo'] as const;

/**
 * Parche de configuración aceptado por `update()`. `requiredSignatures` no
 * se acepta (es derivado) y las entradas de `authorizers` pueden venir
 * parciales (cargo/email opcionales); `parseAuthorizers` las normaliza.
 */
export type SettingsPatch = Partial<
  Omit<OrgSettings, 'authorizers' | 'requiredSignatures'>
> & {
  authorizers?: Array<{ name?: string; cargo?: string; email?: string }>;
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lee la configuración efectiva (stored ∪ defaults) de una organización. */
  async get(organizationId: string): Promise<OrgSettings> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    if (!org) throw new NotFoundException('Organización no encontrada.');
    return this.merge(org.settings);
  }

  /**
   * Aplica un parche parcial sobre la configuración y la persiste.
   * Devuelve la configuración efectiva resultante.
   */
  async update(
    organizationId: string,
    patch: SettingsPatch,
  ): Promise<OrgSettings> {
    const current = await this.get(organizationId);
    const next: OrgSettings = { ...current, ...this.sanitize(patch) };
    // requiredSignatures es DERIVADO: se recalcula del conteo de autorizadores.
    next.requiredSignatures = Math.min(
      MAX_REQUIRED_SIGNATURES,
      next.authorizers.length,
    );

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: next as unknown as Prisma.JsonObject },
    });
    return next;
  }

  // ── helpers ───────────────────────────────────────────────

  private merge(stored: Prisma.JsonValue | null): OrgSettings {
    const s = (stored ?? {}) as Record<string, unknown>;
    const authorizers = this.parseAuthorizers(s.authorizers);
    return {
      multiUserEnabled:
        typeof s.multiUserEnabled === 'boolean'
          ? s.multiUserEnabled
          : DEFAULT_SETTINGS.multiUserEnabled,
      authorizers,
      // Derivado: tantas firmas como autorizadores operativos (tope MAX).
      requiredSignatures: Math.min(MAX_REQUIRED_SIGNATURES, authorizers.length),
      documentAlertDays: this.numOr(
        s.documentAlertDays,
        DEFAULT_SETTINGS.documentAlertDays,
      ),
      factorajeFeePercent: this.numOr(
        s.factorajeFeePercent,
        DEFAULT_SETTINGS.factorajeFeePercent,
      ),
      costRatio: this.numOr(s.costRatio, DEFAULT_SETTINGS.costRatio),
      fiscalRegimen:
        typeof s.fiscalRegimen === 'string' ? s.fiscalRegimen : null,
      fiscalAddress:
        typeof s.fiscalAddress === 'string' ? s.fiscalAddress : null,
      displayName: typeof s.displayName === 'string' ? s.displayName : null,
      erpProvider:
        typeof s.erpProvider === 'string' &&
        SUPPORTED_ERPS.includes(s.erpProvider as (typeof SUPPORTED_ERPS)[number])
          ? s.erpProvider
          : null,
    };
  }

  /** Descarta claves desconocidas; solo deja pasar campos válidos. */
  private sanitize(patch: SettingsPatch): Partial<OrgSettings> {
    const out: Partial<OrgSettings> = {};
    if (patch.multiUserEnabled !== undefined)
      out.multiUserEnabled = Boolean(patch.multiUserEnabled);
    // `requiredSignatures` NO se fija a mano: es derivado de `authorizers`.
    if (patch.authorizers !== undefined)
      out.authorizers = this.parseAuthorizers(patch.authorizers);
    if (patch.documentAlertDays !== undefined)
      out.documentAlertDays = Math.max(1, Math.trunc(patch.documentAlertDays));
    if (patch.factorajeFeePercent !== undefined)
      out.factorajeFeePercent = Math.max(0, Number(patch.factorajeFeePercent));
    if (patch.costRatio !== undefined)
      out.costRatio = Math.min(1, Math.max(0, Number(patch.costRatio)));
    if (patch.fiscalRegimen !== undefined)
      out.fiscalRegimen = patch.fiscalRegimen;
    if (patch.fiscalAddress !== undefined)
      out.fiscalAddress = patch.fiscalAddress;
    if (patch.displayName !== undefined) out.displayName = patch.displayName;
    if (patch.erpProvider !== undefined) {
      // Solo acepta un ERP soportado; cualquier otro valor se normaliza a null.
      out.erpProvider =
        patch.erpProvider &&
        SUPPORTED_ERPS.includes(
          patch.erpProvider as (typeof SUPPORTED_ERPS)[number],
        )
          ? patch.erpProvider
          : null;
    }
    return out;
  }

  private numOr(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : fallback;
  }

  /**
   * Normaliza la lista de autorizadores: descarta entradas sin nombre y
   * limita los campos a strings. Tolera datos parciales (cargo/email vacíos).
   */
  private parseAuthorizers(value: unknown): AuthorizerEntry[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (a): a is Record<string, unknown> =>
          a !== null && typeof a === 'object',
      )
      .map((a) => ({
        name: typeof a.name === 'string' ? a.name.trim() : '',
        cargo: typeof a.cargo === 'string' ? a.cargo.trim() : '',
        email: typeof a.email === 'string' ? a.email.trim() : '',
      }))
      .filter((a) => a.name.length > 0);
  }
}
