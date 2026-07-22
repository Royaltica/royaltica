import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
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
  /** Si el CFDI puede cancelarse (dato del SAT); null si no aplica/desconocido. */
  esCancelable: string | null;
  /** Estatus de cancelación del CFDI (dato del SAT); null si no aplica. */
  estatusCancelacion: string | null;
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

/** Endpoint SOAP público del SAT para consultar el estatus de un CFDI. */
const SAT_CONSULTA_URL =
  'https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc';
const SAT_CONSULTA_SOAP_ACTION =
  'http://tempuri.org/IConsultaCFDIService/Consulta';

/**
 * CSV oficial de la lista 69-B (contribuyentes con operaciones inexistentes).
 * HTTP a propósito: el servidor del SAT (IIS legado) rechaza el handshake
 * TLS moderno de Node y el listado es público (sin datos sensibles).
 */
const SAT_69B_CSV_URL =
  'http://omawww.sat.gob.mx/cifras_sat/Documents/Listado_Completo_69-B.csv';

/** Timeout para llamadas al SAT (sus servicios suelen ser lentos). */
const SAT_HTTP_TIMEOUT_MS = 15_000;

/**
 * Verificación del estatus de un CFDI ante el SAT.
 *
 * Modo 'mock' (default): valida que el UUID tenga formato CFDI correcto y
 * devuelve 'Vigente'; si el formato es inválido devuelve 'No Encontrado'.
 * No realiza ninguna llamada de red, por lo que el flujo de auditoría es
 * determinista y reproducible en desarrollo/pruebas.
 *
 * Modo 'live': consulta el servicio SOAP público del SAT
 * (`consultaqr.facturaelectronica.sat.gob.mx`). Si el SAT no responde o
 * devuelve algo inesperado, se degrada a 'No Verificado' (la auditoría lo
 * trata como discrepancia, nunca como bloqueo silencioso).
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
      const consulta = await this.consultaSat(input);
      return { ...consulta, verifiedAt, mode };
    }

    const status: SatStatus = CFDI_UUID_RE.test(input.cfdiUuid)
      ? 'Vigente'
      : 'No Encontrado';
    return {
      status,
      esCancelable: null,
      estatusCancelacion: null,
      verifiedAt,
      mode,
    };
  }

  /**
   * Llama al servicio SOAP `Consulta` del SAT con la "expresión impresa"
   * del CFDI (misma cadena del QR: re/rr/tt/id) y extrae `<Estado>`,
   * `<EsCancelable>` y `<EstatusCancelacion>`.
   */
  private async consultaSat(
    input: SatVerifyInput,
  ): Promise<Pick<SatVerifyResult, 'status' | 'esCancelable' | 'estatusCancelacion'>> {
    const notFound = {
      status: 'No Encontrado' as SatStatus,
      esCancelable: null,
      estatusCancelacion: null,
    };
    const unverified = {
      status: 'No Verificado' as SatStatus,
      esCancelable: null,
      estatusCancelacion: null,
    };
    if (!CFDI_UUID_RE.test(input.cfdiUuid)) return notFound;

    const expresion =
      `?re=${input.rfcEmisor.toUpperCase()}` +
      `&rr=${input.rfcReceptor.toUpperCase()}` +
      `&tt=${input.total.toFixed(6)}` +
      `&id=${input.cfdiUuid.toUpperCase()}`;

    const envelope =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">' +
      '<soap:Body><tem:Consulta><tem:expresionImpresa>' +
      `<![CDATA[${expresion}]]>` +
      '</tem:expresionImpresa></tem:Consulta></soap:Body></soap:Envelope>';

    try {
      const res = await fetch(SAT_CONSULTA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: SAT_CONSULTA_SOAP_ACTION,
        },
        body: envelope,
        signal: AbortSignal.timeout(SAT_HTTP_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`Consulta SAT respondió HTTP ${res.status}.`);
        return unverified;
      }
      const xml = await res.text();
      const pick = (tag: string): string | null =>
        new RegExp(`<(?:\\w+:)?${tag}>([^<]*)</(?:\\w+:)?${tag}>`, 'i').exec(
          xml,
        )?.[1]?.trim() || null;
      const estado = pick('Estado');
      const esCancelable = pick('EsCancelable');
      const estatusCancelacion = pick('EstatusCancelacion');
      if (
        estado === 'Vigente' ||
        estado === 'Cancelado' ||
        estado === 'No Encontrado'
      ) {
        return { status: estado, esCancelable, estatusCancelacion };
      }
      this.logger.warn(`Consulta SAT: estado inesperado "${estado ?? '∅'}".`);
      return unverified;
    } catch (err) {
      this.logger.warn(
        `Consulta SAT falló: ${err instanceof Error ? err.message : err}`,
      );
      return unverified;
    }
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
   * Versión por lotes de `check69b`: cruza varios RFC contra la lista 69-B
   * en una sola consulta. Devuelve un Map por RFC (mayúsculas) solo con los
   * que están listados como riesgo (PRESUNTO/DEFINITIVO); los RFC limpios no
   * aparecen en el Map (equivale a "fuera de la lista").
   */
  async check69bBatch(
    rfcs: string[],
  ): Promise<Map<string, { listed: true; status: string; name: string | null }>> {
    const unique = [...new Set(rfcs.map((r) => r.toUpperCase()))].filter(
      Boolean,
    );
    if (unique.length === 0) return new Map();
    const entries = await this.prisma.sat69bEntry.findMany({
      where: {
        rfc: { in: unique },
        status: { in: ['PRESUNTO', 'DEFINITIVO'] },
      },
      select: { rfc: true, status: true, name: true },
    });
    return new Map(
      entries.map((e) => [
        e.rfc,
        { listed: true as const, status: e.status, name: e.name },
      ]),
    );
  }

  /**
   * Valida el formato del RFC. El padrón del SAT no expone un servicio
   * público sin captcha para consultar si un RFC está activo, así que en
   * ambos modos solo se valida estructura; la señal fuerte de riesgo la da
   * `check69b` (lista real) y `verifyCfdi` (un CFDI Vigente implica que el
   * emisor existe ante el SAT).
   */
  async checkRfcActive(rfc: string): Promise<CheckRfcResult> {
    const normalized = rfc.toUpperCase();
    const valid = RFC_RE.test(normalized);
    return {
      rfc: normalized,
      active: valid,
      status: valid ? 'Formato válido' : 'RFC inválido',
      mode: this.mode,
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

  /**
   * Descarga el CSV oficial de la lista 69-B del SAT y actualiza la caché
   * local `Sat69bEntry`. El archivo viene en Windows-1252 con campos
   * entrecomillados; se toman RFC, nombre y situación. Corre cada noche
   * (cron) y puede dispararse manualmente vía POST /sat/sync-69b/download.
   */
  async sync69bFromSat(): Promise<{ synced: number; skipped: number }> {
    this.logger.log('Descargando lista 69-B del SAT…');
    const res = await fetch(SAT_69B_CSV_URL, {
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      throw new Error(`Descarga 69-B falló: HTTP ${res.status}`);
    }
    const csv = new TextDecoder('windows-1252').decode(
      await res.arrayBuffer(),
    );

    const syncedAt = new Date();
    const entries: { rfc: string; name: string | null; status: string }[] = [];
    let skipped = 0;

    for (const line of csv.split(/\r?\n/)) {
      const cols = parseCsvLine(line);
      // Layout oficial: No, RFC, Nombre, Situación, … (encabezados y notas
      // se descartan porque su columna 2 no es un RFC válido).
      const rfc = cols[1]?.trim().toUpperCase() ?? '';
      if (!RFC_RE.test(rfc)) {
        skipped++;
        continue;
      }
      const status = normalize69bStatus(cols[3] ?? '');
      if (!status) {
        skipped++;
        continue;
      }
      entries.push({ rfc, name: cols[2]?.trim() || null, status });
    }

    // Upsert por lotes: la lista trae ~13k filas y puede tener RFC repetidos
    // (última publicación gana).
    const byRfc = new Map(entries.map((e) => [e.rfc, e]));
    const unique = [...byRfc.values()];
    const CHUNK = 500;
    for (let i = 0; i < unique.length; i += CHUNK) {
      await this.prisma.$transaction(
        unique.slice(i, i + CHUNK).map((e) =>
          this.prisma.sat69bEntry.upsert({
            where: { rfc: e.rfc },
            create: { ...e, syncedAt },
            update: { name: e.name, status: e.status, syncedAt },
          }),
        ),
      );
    }

    this.logger.log(
      `Lista 69-B del SAT sincronizada: ${unique.length} RFC (${skipped} filas descartadas).`,
    );
    return { synced: unique.length, skipped };
  }

  /** Sincronización nocturna de la lista 69-B (respeta JOBS_ENABLED). */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'sat-69b-sync' })
  async nightly69bSync(): Promise<void> {
    const enabled =
      this.config.get('JOBS_ENABLED', { infer: true }) === 'true';
    if (!enabled) return;
    try {
      await this.sync69bFromSat();
    } catch (err) {
      this.logger.error(
        `Sincronización nocturna 69-B falló: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}

/** Situación del contribuyente en el CSV → estatus interno. */
function normalize69bStatus(raw: string): string | null {
  const s = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (s.includes('DEFINITIVO')) return 'DEFINITIVO';
  if (s.includes('PRESUNTO')) return 'PRESUNTO';
  if (s.includes('DESVIRTUADO')) return 'DESVIRTUADO';
  if (s.includes('SENTENCIA')) return 'SENTENCIA_FAVORABLE';
  return null;
}

/** Parser mínimo de una línea CSV con campos entrecomillados. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}
