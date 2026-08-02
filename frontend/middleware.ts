// Edge Middleware: serves the public marketing landing page on royaltica.com
// and www.royaltica.com, while app.royaltica.com (and everything else) keeps
// serving the login/app SPA. Implemented as explicit code rather than a
// declarative vercel.json "has" header rewrite because that approach proved
// unreliable specifically for the apex domain (royaltica.com) even though it
// worked correctly for www.royaltica.com and other paths.
export const config = {
  matcher: '/((?!_vercel|favicon.ico).*)',
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
    const target = new URL('/_public/index.html', url);
    return fetch(target, request);
  }

  return undefined;
}
