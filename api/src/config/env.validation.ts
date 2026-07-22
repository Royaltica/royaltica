import { z } from 'zod';

/**
 * Esquema de validación de variables de entorno.
 * Las variables de infraestructura (DB, Redis, JWT) son obligatorias.
 * Las de integraciones externas (Firebase, GCS, Gemini, Resend) son
 * opcionales en esta fase y se volverán obligatorias en su módulo.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  // Orígenes permitidos para CORS (separados por coma). En producción es
  // OBLIGATORIO listar los dominios de la app; '*' no se acepta.
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
  // Llave dedicada para cifrar secretos TOTP (si falta, se deriva de JWT_SECRET).
  TOTP_ENCRYPTION_KEY: z.string().min(32).optional(),

  // Interruptor EXPLÍCITO para permitir /auth/dev-login en un despliegue con
  // NODE_ENV=production (p. ej. un ambiente de demo/staging temporal, antes
  // de tener Firebase configurado). Independiente de NODE_ENV a propósito:
  // así el resto del comportamiento "producción" (CORS estricto, etc.) no
  // se ve afectado. Por default queda deshabilitado — hay que prenderlo
  // a mano y apagarlo cuando ya no se necesite, porque emite un JWT válido
  // para cualquier usuario existente solo con su email.
  ALLOW_DEV_LOGIN: z.enum(['true', 'false']).optional().default('false'),

  // Infraestructura — obligatorias
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),

  // Firebase Admin — opcionales por ahora
  FIREBASE_PROJECT_ID: z.string().optional().default(''),
  FIREBASE_CLIENT_EMAIL: z.string().optional().default(''),
  FIREBASE_PRIVATE_KEY: z.string().optional().default(''),

  // Google Cloud Storage — opcionales por ahora
  GCS_BUCKET_NAME: z.string().optional().default(''),
  GCS_KEY_FILE: z.string().optional().default(''),

  // Gemini — opcional por ahora (legado, modo API key directa)
  GEMINI_API_KEY: z.string().optional().default(''),

  // Vertex AI (Gemini vía cuenta de servicio de GCP) — opcionales por ahora.
  // Si VERTEX_PROJECT_ID está configurado, se usa Vertex AI en vez de GEMINI_API_KEY.
  VERTEX_PROJECT_ID: z.string().optional().default(''),
  VERTEX_LOCATION: z.string().optional().default('us-central1'),
  VERTEX_KEY_FILE: z.string().optional().default(''),

  // Verificación CFDI ante el SAT.
  // 'mock' (default): valida formato sin llamar al SAT real.
  // 'live': consultaría el servicio del SAT (pendiente de implementar).
  SAT_VERIFY_MODE: z.enum(['mock', 'live']).default('mock'),

  // Resend — opcionales por ahora
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM_EMAIL: z.string().optional().default('no-reply@royaltica.com'),

  // Proveedor externo de factoraje — opcionales (modo stub hasta tener API)
  FACTORAJE_API_URL: z.string().optional().default(''),
  FACTORAJE_API_KEY: z.string().optional().default(''),

  // Conector ERP del corporativo — opcionales (modo stub hasta tener API).
  // El ERP a usar se elige en Organization.settings.erpProvider.
  ERP_API_URL: z.string().optional().default(''),
  ERP_API_KEY: z.string().optional().default(''),

  // SPEI (dispersión de pagos) — opcionales, modo stub hasta tener credenciales.
  SPEI_PROVIDER: z.enum(['conekta', 'stp']).optional().default('conekta'),
  SPEI_API_KEY: z.string().optional().default(''),
  SPEI_API_URL: z.string().optional().default(''),
  SPEI_CLABE_ORIGEN: z.string().optional().default(''),

  // WhatsApp para alertas críticas — opcionales (modo stub hasta tener token).
  // 'meta' (Cloud API) usa WHATSAPP_PHONE_ID; 'twilio' usa WHATSAPP_FROM.
  WHATSAPP_PROVIDER: z.enum(['meta', 'twilio']).optional().default('meta'),
  WHATSAPP_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_ID: z.string().optional().default(''),
  WHATSAPP_FROM: z.string().optional().default(''),
  // Webhook entrante de Meta: token del challenge de verificación (GET) y
  // app secret para validar la firma HMAC de los mensajes entrantes (POST).
  WHATSAPP_VERIFY_TOKEN: z.string().optional().default(''),
  WHATSAPP_APP_SECRET: z.string().optional().default(''),

  // Swagger — opcionales por ahora
  SWAGGER_USER: z.string().optional().default('admin'),
  SWAGGER_PASS: z.string().optional().default('change-me'),

  // Jobs programados (recordatorios). 'false' los desactiva (p. ej. en CI).
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .default('true'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Función `validate` consumida por `@nestjs/config`.
 * Si alguna variable es inválida, la app no arranca.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  return parsed.data;
}
