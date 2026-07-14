import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

// Cabeceras de seguridad del frontend:
// - frame-ancestors/X-Frame-Options: nadie puede meter la app en un iframe (clickjacking).
// - nosniff: el navegador no "adivina" tipos de contenido.
// En producción, replicar estas cabeceras en el servidor que sirva el build
// (ver public/_headers para Netlify/Cloudflare).
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    // SEGURIDAD: aquí NO se inyectan API keys al bundle del navegador. Toda
    // llamada a IA pasa por el backend (/api/ai/*); la credencial vive solo
    // en el servidor. geminiService.ts queda en modo simulación sin key.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      headers: SECURITY_HEADERS,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Proxy hacia el backend Royáltica (NestJS en :8080). El frontend llama
      // a rutas relativas /api/* y Vite las reenvía al backend, evitando CORS.
      // Ej: /api/auth/dev-login → http://localhost:8080/auth/dev-login
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
    preview: {
      headers: SECURITY_HEADERS,
    },
  };
});
