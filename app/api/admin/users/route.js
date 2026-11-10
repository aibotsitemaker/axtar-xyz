import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY server environment variable is not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function adminFor(req) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'Giriş tələb olunur', status: 401 };
  const admin = clients();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { error: 'Sessiya etibarlı deyil', status: 401 };
  const { data: row, error: lookupError } = await admin.from('platform_admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (lookupError || !row) return { error: 'Admin icazəsi tələb olunur', status: 403 };
  return { admin, actor: data.user };
}

export async function GET(req) {
  let auth;
  try { auth = await adminFor(req); } catch (e) { return NextResponse.json({ error: e.message }, { status: 503 }); }
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const query = new URL(req.url).searchParams.get('q')?.trim().toLowerCase() || '';
  const { data, error } = await auth.admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const users = data.users.filter((u) => !query || `${u.email || ''} ${u.user_metadata?.full_name || ''}`.toLowerCase().includes(query));
  const ids = users.map((u) => u.id);
  const { data: profiles } = ids.length ? await auth.admin.from('profiles').select('id,user_type').in('id', ids) : { data: [] };
  const types = Object.fromEntries((profiles || []).map((p) => [p.id, p.user_type]));
  return NextResponse.json({ users: users.map((u) => ({ id: u.id, email: u.email, full_name: u.user_metadata?.full_name || '', user_type: types[u.id] || 'student', created_at: u.created_at, email_confirmed: Boolean(u.email_confirmed_at), banned_until: u.banned_until || null })) });
}

export async function PATCH(req) {
  let auth;
  try { auth = await adminFor(req); } catch (e) { return NextResponse.json({ error: e.message }, { status: 503 }); }
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const payload = await req.json().catch(() => null);
  const { id, action, user_type } = payload || {};
  if (!id || !['set_type', 'ban', 'unban', 'delete'].includes(action)) return NextResponse.json({ error: 'Sorğu yanlışdır' }, { status: 400 });
  if (action === 'set_type') {
    if (!['teacher', 'student', 'university_student'].includes(user_type)) return NextResponse.json({ error: 'İstifadəçi tipi yanlışdır' }, { status: 400 });
    const { error } = await auth.admin.from('profiles').update({ user_type }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (action === 'ban' || action === 'unban') {
    if (id === auth.actor.id) return NextResponse.json({ error: 'Öz hesabınızı bloklaya bilməzsiniz' }, { status: 400 });
    const { error } = await auth.admin.auth.admin.updateUserById(id, { ban_duration: action === 'ban' ? '876000h' : 'none' });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    if (id === auth.actor.id) return NextResponse.json({ error: 'Öz hesabınızı bu paneldən silə bilməzsiniz' }, { status: 400 });
    const { count } = await auth.admin.from('platform_admins').select('*', { count: 'exact', head: true }).eq('user_id', id);
    if ((count || 0) > 0) {
      const { count: admins } = await auth.admin.from('platform_admins').select('*', { count: 'exact', head: true });
      if ((admins || 0) <= 1) return NextResponse.json({ error: 'Yeganə Super Admin hesabını silmək olmaz' }, { status: 400 });
    }
    const { error } = await auth.admin.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await auth.admin.from('admin_audit_log').insert({ actor_id: auth.actor.id, action, target_type: 'auth_user', target_id: id, summary: action === 'set_type' ? { user_type } : {} });
  return NextResponse.json({ ok: true });
}
