import { z } from 'zod';

const text = z.string().max(200);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const key = z.string().min(1).max(120).refine((s) => !['__proto__', 'constructor', 'prototype'].includes(s));
const segment = z.enum(['puntual', 'tardio', 'olvidadizo', 'deterioro', 'moroso', 'disputa', 'nuevo']);
const boundedRecord = <T extends z.ZodTypeAny>(schema: T) => z.record(key, schema).refine((v) => Object.keys(v).length <= 500);

export const collectionNotificationsSchema = z.object({
  noMolestar: z.boolean(), resumenHora: time,
  destinatarios: z.array(z.object({
    id: key, nombre: z.string().trim().min(1).max(120), puesto: text,
    telefono: z.string().regex(/^\+\d{8,15}$/),
    nivel: z.enum(['criticas', 'altas', 'todas']), modo: z.enum(['momento', 'resumen']),
    activo: z.boolean(), verificado: z.literal(false),
  }).strict()).max(30),
}).strict();
export type CollectionNotifications = z.infer<typeof collectionNotificationsSchema>;
export const DEFAULT_COLLECTION_NOTIFICATIONS: CollectionNotifications = { noMolestar: true, resumenHora: '08:00', destinatarios: [] };

export const collectionCompanySchema = z.object({
  empresa: text, telefono_oficial: z.string().max(30), banco: text,
  clabe: z.string().regex(/^(\d{18})?$/),
  liga: z.string().max(500).refine((v) => !v || (() => { try { return new URL(v).protocol === 'https:'; } catch { return false; } })()),
  correo: z.union([z.literal(''), z.string().email().max(160)]), firma: z.string().max(500),
}).strict();
export type CollectionCompany = z.infer<typeof collectionCompanySchema>;
export const DEFAULT_COLLECTION_COMPANY: CollectionCompany = { empresa: '', telefono_oficial: '', banco: '', clabe: '', liga: '', correo: '', firma: '' };

const filters = z.object({
  agente: text, linea: text, resultado: text, desde: date, hasta: date,
  horaDesde: time, horaHasta: time, soloNoGestionadas: z.boolean(),
}).strict().refine((f) => f.desde <= f.hasta && f.horaDesde <= f.horaHasta);
const campaign = z.object({
  id: key, nombre: z.string().trim().min(1).max(120),
  config: z.object({
    objetivo: z.enum(['recuperar', 'adelantar', 'cierre', 'contactos']).optional(),
    ocasion: z.enum(['buen_fin', 'black_friday', 'cierre', 'personalizada', 'contacto']), plantilla: text,
    oferta: z.object({ tipo: z.enum(['descuento', 'parcialidades', 'condonacion', 'prorroga', 'beneficio', 'ninguna']), valor: z.number().finite().min(0).max(365), texto: z.string().max(1000).optional() }).strict(),
    inicio: date, fin: date, canal: z.enum(['WhatsApp', 'Correo']), clientes: z.array(key).max(500),
  }).strict(),
  estado: z.literal('Borrador'), enviados: z.literal(0),
}).strict();

export const collectionWorkspaceSchema = z.object({
  revision: z.number().int().nonnegative(),
  alertas: boundedRecord(z.object({ firma: z.string().max(4000), hasta: date.optional() }).strict()),
  reportes: z.array(z.object({ nombre: z.string().trim().min(1).max(120), filtros: filters }).strict()).max(50),
  segmentos: boundedRecord(z.object({ segmento: segment, motivo: z.string().max(500) }).strict()),
  cambiosSegmento: z.array(z.object({ cliente: text, de: segment, a: segment, motivo: z.string().max(500), hora: time, fecha: date.optional() }).strict()).max(500),
  tiposDeudor: z.object({ activos: z.array(key).max(50), asignaciones: boundedRecord(key), archivo: text, fecha: z.string().datetime() }).strict().nullable(),
  campanas: z.array(campaign).max(100),
}).strict();
export type CollectionWorkspace = z.infer<typeof collectionWorkspaceSchema>;
export const collectionWorkspacePatchSchema = collectionWorkspaceSchema.partial().required({ revision: true });
export type CollectionWorkspacePatch = z.infer<typeof collectionWorkspacePatchSchema>;
export const DEFAULT_COLLECTION_WORKSPACE: CollectionWorkspace = { revision: 0, alertas: {}, reportes: [], segmentos: {}, cambiosSegmento: [], tiposDeudor: null, campanas: [] };

export function parseUserWorkspaces(value: unknown): Record<string, CollectionWorkspace> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([id, entry]) => {
    const parsed = collectionWorkspaceSchema.safeParse(entry);
    return key.safeParse(id).success && parsed.success ? [[id, parsed.data]] : [];
  }));
}
