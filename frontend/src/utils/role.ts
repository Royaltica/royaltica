// 'agent' = perfil operativo Agente/Ejecutivo (UI ultra-simplificada, spec
// "Mejoras V1" sección 2) — distinto de 'corporate' (portal completo), pero
// sigue siendo un CORPORATE_USER del lado del backend.
export type Role = 'corporate' | 'agent' | 'provider' | 'admin' | null;
