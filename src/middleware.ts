import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Log page visits (skip static assets, health checks, and API polling)
  const isPage    = !pathname.startsWith('/api/');
  const isApiCall = pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/health') &&
    !pathname.startsWith('/api/stats') &&
    !pathname.startsWith('/api/services');
  if (isPage || isApiCall) {
    const ua      = request.headers.get('user-agent') || '';
    const isBot   = /bot|crawler|spider|ping|monitor|health/i.test(ua);
    if (!isBot) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      console.log(`[PAFIS VISIT] ${request.method} ${pathname} | ip:${ip} | ua:${ua.substring(0, 80)}`);
    }
  }

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check session cookie
  const session = request.cookies.get('pafis_session');
  if (session?.value === process.env.SESSION_SECRET) {
    return NextResponse.next();
  }

  // Redirect to login
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};