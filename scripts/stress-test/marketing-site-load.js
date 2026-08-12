// Carga sobre el sitio de marketing (royaltica.com) — valida que el patrón
// de Edge Middleware (fetch interno a /_public/<archivo>.html por cada
// request, ver frontend/middleware.ts) no se caiga ni meta demasiada
// latencia bajo carga, y que las rutas nuevas del checklist SEO respondan
// bien: home, /gracias, /privacidad, robots.txt, sitemap.xml, y que una URL
// inventada SÍ devuelva 404 (antes devolvía 200 con el home disfrazado).
//
// Uso:
//   k6 run -e BASE_URL=https://royaltica.com scripts/stress-test/marketing-site-load.js
//
// Es tráfico público sin auth sobre contenido estático — razonablemente
// seguro de correr contra producción con pocos VUs. Vercel también tiene su
// propio rate-limiting/DDoS protection por delante, así que esto es más
// para medir latencia percibida que para "tumbar" nada.
import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://royaltica.com';

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 10 },
        { duration: '40s', target: 20 },
        { duration: '20s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],
  },
};

export default function () {
  group('Home', () => {
    const r = http.get(`${BASE_URL}/`);
    check(r, { '200': (res) => res.status === 200, 'tiene title': (res) => res.body.includes('<title>') });
  });
  group('Gracias', () => {
    const r = http.get(`${BASE_URL}/gracias`);
    check(r, { '200': (res) => res.status === 200 });
  });
  group('Privacidad', () => {
    const r = http.get(`${BASE_URL}/privacidad`);
    check(r, { '200': (res) => res.status === 200 });
  });
  group('robots.txt', () => {
    const r = http.get(`${BASE_URL}/robots.txt`);
    check(r, { '200': (res) => res.status === 200, 'menciona sitemap': (res) => res.body.includes('Sitemap') });
  });
  group('sitemap.xml', () => {
    const r = http.get(`${BASE_URL}/sitemap.xml`);
    check(r, { '200': (res) => res.status === 200 });
  });
  group('404 real', () => {
    const r = http.get(`${BASE_URL}/esta-ruta-no-existe-${Date.now()}`);
    check(r, { '404 real (no 200 disfrazado)': (res) => res.status === 404 });
  });
  sleep(1);
}
