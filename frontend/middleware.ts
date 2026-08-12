// Edge Middleware: serves the public marketing site on royaltica.com and
// www.royaltica.com (landing, thank-you page, privacy policy, custom 404,
// robots.txt, sitemap.xml, og:image), while app.royaltica.com (and everything
// else) keeps serving the login/app SPA. Implemented as explicit code rather
// than a declarative vercel.json "has" header rewrite because that approach
// proved unreliable specifically for the apex domain (royaltica.com) even
// though it worked correctly for www.royaltica.com and other paths.
export const config = {
  matcher: '/((?!_vercel|favicon.ico).*)',
};

// Rutas conocidas del sitio marketing → archivo estático en dist/_public/
// (ver frontend/vercel.json buildCommand, que copia estos archivos desde
// /landing). Cualquier ruta no listada aquí cae al 404 personalizado.
const MARKETING_ROUTES: Record<string, string> = {
  '/': '/index.html',
  '/gracias': '/gracias.html',
  '/privacidad': '/privacidad.html',
  '/robots.txt': '/robots.txt',
  '/sitemap.xml': '/sitemap.xml',
  '/og-image.png': '/og-image.png',
};

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const host = (request.headers.get('host') || '').toLowerCase();

  const isMarketingHost = host === 'royaltica.com' || host === 'www.royaltica.com';
  const isExcludedPath =
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_public/') ||
    url.pathname.startsWith('/assets/');

  if (isMarketingHost && !isExcludedPath) {
    const mapped = MARKETING_ROUTES[url.pathname];
    if (mapped) {
      const target = new URL('/_public' + mapped, url);
      return fetch(target, request);
    }
    // Ruta desconocida en el dominio de marketing: 404 personalizada, con el
    // código de estado 404 real (no un 200 disfrazado) para SEO y monitoreo.
    const notFoundTarget = new URL('/_public/404.html', url);
    const notFoundRes = await fetch(notFoundTarget, request);
    return new Response(notFoundRes.body, {
      status: 404,
      headers: notFoundRes.headers,
    });
  }

  return undefined;
}
