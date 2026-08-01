/**
 * Parser CSV mínimo (RFC 4180) sin dependencias externas: el repo no tiene
 * `csv-parse`/`papaparse` instalado (ver api/package.json) y este sandbox no
 * tiene acceso de red confiable para agregar una dependencia nueva. Soporta
 * comillas, comas y saltos de línea escapados dentro de campos, así como el
 * BOM UTF-8 que agrega Excel al exportar (mismo BOM que escribe toCsv en
 * common/csv.util.ts al exportar, así que un roundtrip export→import calza).
 */
export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/** Quita el BOM UTF-8 inicial si existe. */
const stripBom = (text: string): string =>
  text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

/** Parsea el texto CSV completo en filas de campos (arrays de strings). */
function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  const pushField = () => {
    record.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };

  while (i < len) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    if (c === '\n') {
      pushRecord();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }

  // Última fila sin salto de línea final.
  if (field.length > 0 || record.length > 0) {
    pushRecord();
  }

  return records.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Parsea un CSV con encabezado en la primera fila a objetos {header: valor}. */
export function parseCsv(buffer: Buffer | string): ParsedCsv {
  const text = stripBom(
    typeof buffer === 'string' ? buffer : buffer.toString('utf8'),
  );
  const records = parseRecords(text);
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((record) => {
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = (record[idx] ?? '').trim();
    });
    return row;
  });

  return { headers, rows };
}
