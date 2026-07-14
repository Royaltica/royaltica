import { XMLParser } from 'fast-xml-parser';

export interface ParsedCfdi {
  cfdiUuid: string;
  rfcEmisor: string;
  rfcReceptor: string;
  emisorNombre: string | null;
  subtotal: number;
  iva: number;
  total: number;
  currency: string;
  date: Date;
  folio: string | null;
  paymentType: 'PPD' | 'PUE' | null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true, // colapsa cfdi:/tfd: para acceder por nombre simple
});

type AnyNode = Record<string, unknown>;

const attr = (node: unknown, name: string): string | undefined => {
  if (!node || typeof node !== 'object') return undefined;
  const v = (node as AnyNode)[`@_${name}`];
  return v === undefined || v === null ? undefined : String(v);
};

const firstChild = (node: unknown, name: string): unknown => {
  if (!node || typeof node !== 'object') return undefined;
  const v = (node as AnyNode)[name];
  return Array.isArray(v) ? v[0] : v;
};

const num = (s: string | undefined): number => {
  const n = s === undefined ? NaN : Number(s);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Extrae los campos fiscales de un CFDI 4.0 (XML timbrado). No valida el
 * sello ni consulta al SAT: solo lee la estructura. Lanza si falta el UUID
 * del timbre o los RFC, que son los datos mínimos para registrar la factura.
 */
export function parseCfdiXml(xml: string): ParsedCfdi {
  const root = parser.parse(xml) as AnyNode;
  const comprobante = firstChild(root, 'Comprobante');
  if (!comprobante) {
    throw new Error('El XML no es un CFDI (falta el nodo Comprobante).');
  }

  const emisor = firstChild(comprobante, 'Emisor');
  const receptor = firstChild(comprobante, 'Receptor');
  const complemento = firstChild(comprobante, 'Complemento');
  const tfd = firstChild(complemento, 'TimbreFiscalDigital');
  const impuestos = firstChild(comprobante, 'Impuestos');

  const cfdiUuid = attr(tfd, 'UUID');
  const rfcEmisor = attr(emisor, 'Rfc');
  const rfcReceptor = attr(receptor, 'Rfc');

  if (!cfdiUuid) {
    throw new Error('CFDI sin UUID de timbre fiscal (TimbreFiscalDigital).');
  }
  if (!rfcEmisor || !rfcReceptor) {
    throw new Error('CFDI sin RFC de emisor o receptor.');
  }

  const subtotal = num(attr(comprobante, 'SubTotal'));
  const total = num(attr(comprobante, 'Total'));
  const ivaAttr = attr(impuestos, 'TotalImpuestosTrasladados');
  const iva = ivaAttr !== undefined ? num(ivaAttr) : Math.max(0, total - subtotal);

  const fechaStr = attr(comprobante, 'Fecha');
  const date = fechaStr ? new Date(fechaStr) : new Date();

  const metodoPago = attr(comprobante, 'MetodoPago'); // PPD | PUE
  const paymentType =
    metodoPago === 'PPD' ? 'PPD' : metodoPago === 'PUE' ? 'PUE' : null;

  return {
    cfdiUuid: cfdiUuid.toUpperCase(),
    rfcEmisor: rfcEmisor.toUpperCase(),
    rfcReceptor: rfcReceptor.toUpperCase(),
    emisorNombre: attr(emisor, 'Nombre') ?? null,
    subtotal,
    iva,
    total,
    currency: attr(comprobante, 'Moneda') ?? 'MXN',
    date: Number.isNaN(date.getTime()) ? new Date() : date,
    folio: attr(comprobante, 'Folio') ?? null,
    paymentType,
  };
}
