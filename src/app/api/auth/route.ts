import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  const validUser = process.env.DEMO_USERNAME || 'user';
  const validPass = process.env.DEMO_PASSWORD || 'pass123!';
  const secret    = process.env.SESSION_SECRET || 'pafis-session-secret';

  if (username !== validUser || password !== validPass) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Log access (server-side console — visible in Railway/AWS logs)
  console.log(`[PAFIS ACCESS] User "${username}" logged in at ${new Date().toISOString()}`);

  const response = NextResponse.json({ ok: true });
  response.cookies.set('pafis_session', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('pafis_session');
  return response;
}