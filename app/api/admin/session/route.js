import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const COOKIE = 'tehsilhub_admin_session';

function client() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) throw new Error('Server Supabase açarları təyin edilməyib');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const response = NextResponse.json({ ok: true });
  const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/admin' };
  if (!token) { response.cookies.set(COOKIE, '', { ...cookieOptions, maxAge: 0 }); return response; }
  try {
    const db = client();
    const { data: auth, error } = await db.auth.getUser(token);
    if (error || !auth.user) { response.cookies.set(COOKIE, '', { ...cookieOptions, maxAge: 0 }); return response; }
    const { data: row } = await db.from('platform_admins').select('user_id').eq('user_id', auth.user.id).maybeSingle();
    if (!row) { response.cookies.set(COOKIE, '', { ...cookieOptions, maxAge: 0 }); return response; }
    const exp = Number(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).exp);
    const maxAge = Math.max(0, Math.min(3600, exp - Math.floor(Date.now() / 1000)));
    if (!maxAge) { response.cookies.set(COOKIE, '', { ...cookieOptions, maxAge: 0 }); return response; }
    response.cookies.set(COOKIE, token, { ...cookieOptions, maxAge });
    return response;
  } catch {
    response.cookies.set(COOKIE, '', { ...cookieOptions, maxAge: 0 });
    return NextResponse.json({ ok: false }, { status: 503, headers: response.headers });
  }
}
