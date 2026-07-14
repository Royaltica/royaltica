/**
 * Serialización CSV sin dependencias externas.
 * Escapa comillas/comas/saltos de línea según RFC 4180 y antepone el BOM
 * UTF-8 para que Excel reconozca los acentos correctamente.
 */

type CsvValue = string | number | boolean | Date | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

const escape = (raw: CsvValue): string => {
  if (raw === null || raw === undefined) return '';
  const str = raw instanceof Date ? raw.toISOString() : String(raw);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/** Convierte filas + definición de columnas en una cadena CSV con BOM. */
export const toCsv = <T>(rows: T[], columns: CsvColumn<T>[]): string => {
  const head = columns.map((c) => escape(c.header)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escape(c.value(row))).join(','))
    .join('\n');
  return `﻿${head}\n${body}`;
};
