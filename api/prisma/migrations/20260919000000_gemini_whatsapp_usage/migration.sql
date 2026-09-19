-- UsageFeature: nuevo valor GEMINI_WHATSAPP para trackear el costo de
-- redactar/pulir con Gemini (Vertex AI) el texto de las alertas críticas
-- que WhatsappService manda por notifyOrgAdmins().
-- ALTER TYPE ... ADD VALUE no puede combinarse con otro DDL que USE el
-- valor nuevo dentro de la misma transacción; esta migración solo AGREGA
-- el valor, no lo usa, así que es seguro incluirlo aquí.
ALTER TYPE "UsageFeature" ADD VALUE 'GEMINI_WHATSAPP';
