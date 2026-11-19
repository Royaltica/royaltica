import { z } from 'zod';

export const collectionSecuritySchema = z.object({
  dosPasos: z.boolean(),
  inactividad: z.boolean(),
}).strict();

export const collectionRulesSchema = z.object({
  festivos: z.boolean(),
  descuentoMax: z.number().int().min(0).max(30),
  parcialidades: z.boolean(),
  prorroga: z.boolean(),
  aprueba: z.enum(['admin', 'supervisor']),
}).strict();

export type CollectionSecuritySettings = z.infer<typeof collectionSecuritySchema>;
export type CollectionRulesSettings = z.infer<typeof collectionRulesSchema>;

export const DEFAULT_COLLECTION_SECURITY: CollectionSecuritySettings = {
  dosPasos: false,
  inactividad: false,
};

export const DEFAULT_COLLECTION_RULES: CollectionRulesSettings = {
  festivos: false,
  descuentoMax: 0,
  parcialidades: false,
  prorroga: false,
  aprueba: 'admin',
};
