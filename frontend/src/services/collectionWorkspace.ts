import type { Campana, Segmento } from '../pages/corporate/views/cobranza/mockV1.ts';

export type CollectionCompany = { empresa: string; telefono_oficial: string; banco: string; clabe: string; liga: string; correo: string; firma: string };
export type CollectionNotifications = {
  noMolestar: boolean; resumenHora: string;
  destinatarios: { id: string; nombre: string; puesto: string; telefono: string; nivel: 'criticas' | 'altas' | 'todas'; modo: 'momento' | 'resumen'; activo: boolean; verificado: false }[];
};
export type ReportFilters = { agente: string; linea: string; resultado: string; desde: string; hasta: string; horaDesde: string; horaHasta: string; soloNoGestionadas: boolean };
export type CollectionWorkspace = {
  revision: number;
  alertas: Record<string, { firma: string; hasta?: string }>;
  reportes: { nombre: string; filtros: ReportFilters }[];
  segmentos: Record<string, { segmento: Segmento; motivo: string }>;
  cambiosSegmento: { cliente: string; de: Segmento; a: Segmento; motivo: string; hora: string; fecha?: string }[];
  tiposDeudor: { activos: string[]; asignaciones: Record<string, string>; archivo: string; fecha: string } | null;
  campanas: Campana[];
};
export const EMPTY_WORKSPACE: CollectionWorkspace = { revision: 0, alertas: {}, reportes: [], segmentos: {}, cambiosSegmento: [], tiposDeudor: null, campanas: [] };
