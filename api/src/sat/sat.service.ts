import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Env } from '../config/env.validation';

/** Estatus posibles de un CFDI ante el SAT. */
export type SatStatus =
  | 'Vigente'
  | 'Cancelado'
  | 'No Encontrado'
  | 'No Verificado';

export interface SatVerifyInput {
  cfdiUuid: string;
  rfcEmisor: string;
  rfcReceptor: string;
  total: number;
}

export interface SatVerifyResult {
  status: SatStatus;
  verifiedAt: string;
  mode: 'mock' | 'live';
}

/** Resultado de consultar la lista 69-B (EFOS/EDOS). */
export interface Check69bResult {
  rfc: string;
  /** true = el RFC está en la lista 69-B (riesgo fiscal). */
  listed: boolean;
  status: string | null;
  name: string | null;
}

/** Resultado de verificar el RFC en el padrón del SAT. */
export interface CheckRfcResult {
  rfc: string;
  active: boolean;
  status: string;
  mode: 'mock' | 'live';
}

/** Una entrada para sembrar/actualizar la lista 69-B. */
export interface Sat69bSeed {
  rfc: string;
  name?: string;
  status?: string;
  publishedAt?: string;
}

/** UUID de CFDI: 8-4-4-4-12 hexadecimal. */
const CFDI_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** RFC de persona moral (12) o física (13). */
const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i;

/**
 * Verificación del estatus de un CFDI ante el SAT.
 *
 * Modo 'mock' (default): valida que el UUID tenga formato CFDI correcto y
 * devuelve 'Vigente'; si el formato es inválido devuelve 'No Encontrado'.
 * No realiza ninguna llamada de red, por lo que el flujo de auditoría es
 * determinista y reproducible en desarrollo/pruebas.
 *
 * Modo 'live': aquí se conectará el servicio de consulta del SAT
 * (servicio SOAP `consultaqr.facturaelectronica.sat.gob.mx`). Mientras no
 * esté implementado, devuelve 'No Verificado' y advierte en el log.
 */
@Injectable()
export class SatService {
  private readonly logger = new Logger(SatService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  private get mode(): 'mock' | 'live' {
    return this.config.get('SAT_VERIFY_MODE', { infer: true });
  }

  async verifyCfdi(input: SatVerifyInput): Promise<SatVerifyResult> {
    const verifiedAt = new Date().toISOString();
    const mode = this.mode;

    if (mode === 'live') {
      // TODO(Prompt futuro): integrar servicio SOAP del SAT.
      this.logger.warn(
        'SAT_VERIFY_MODE=live aún no implementado; se devuelve "No Verificado".',
      );
      return { status: 'No Verificado', verifiedAt, mode };
    }

    const status: SatStatus = CFDI_UUID_RE.test(input.cfdiUuid)
      ? 'Vigente'
      : 'No Encontrado';
    return { status, verifiedAt, mode };
  }

  /**
   * Verifica si un RFC está en la lista 69-B (EFOS/EDOS) del SAT.
   * Consulta la caché local `Sat69bEntry` (poblada por `sync69b`).
   * Solo cuenta como riesgo si el estatus es PRESUNTO o DEFINITIVO;
   * DESVIRTUADO o SENTENCIA_FAVORABLE ya no son riesgo.
   */
  async check69b(rfc: string): Promise<Check69bResult> {
    const normalized = rfc.toUpperCase();
    const entry = await this.prisma.sat69bEntry.findUnique({
      where: { rfc: normalized },
    });

    const riskyStatuses = ['PRESUNTO', 'DEFINITIVO'];
    const listed = entry !== null && riskyStatuses.includes(entry.status);

    return {
      rfc: normalized,
      listed,
      status: entry?.status ?? null,
      name: entry?.name ?? null,
    };
  }

  /**
   * Verifica que el RFC exista y esté activo en el padrón del SAT.
   * En modo 'mock' valida el formato del RFC. En 'live' consultaría el
   * servicio del SAT (pendiente).
   */
  async checkRfcActive(rfc: string): Promise<CheckRfcResult> {
    const normalized = rfc.toUpperCase();
    const mode = this.mode;

    if (mode === 'live') {
      this.logger.warn(
        'SAT_VERIFY_MODE=live aún no implementado para padrón RFC.',
      );
      return { rfc: normalized, active: false, status: 'No Verificado', mode };
    }

    const valid = RFC_RE.test(normalized);
    return {
      rfc: normalized,
      active: valid,
      status: valid ? 'Activo' : 'RFC inválido',
      mode,
    };
  }

  /**
   * Sincroniza la lista 69-B. En producción descargaría el archivo público
   * del SAT; aquí acepta un arreglo de entradas (útil para sembrar la caché
   * y para pruebas). Hace upsert por RFC y devuelve cuántas se procesaron.
   */
  async sync69b(entries: Sat69bSeed[]): Promise<{ synced: number }> {
    const syncedAt = new Date();
    let synced = 0;

    for (const e of entries) {
      const rfc = e.rfc.toUpperCase();
      if (!RFC_RE.test(rfc)) continue;
      await this.prisma.sat69bEntry.upsert({
        where: { rfc },
        create: {
          rfc,
          name: e.name,
          status: e.status ?? 'PRESUNTO',
          publishedAt: e.publishedAt ? new Date(e.publishedAt) : null,
          syncedAt,
        },
        update: {
          name: e.name,
          status: e.status ?? 'PRESUNTO',
          publishedAt: e.publishedAt ? new Date(e.publishedAt) : null,
          syncedAt,
        },
      });
      synced++;
    }

    this.logger.log(`Lista 69-B sincronizada: ${synced} entradas.`);
    return { synced };
  }
}
