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
  const params = new URL(req.url).searchParams;
  const profileId = params.get('userId');
  if (profileId) {
    const [{ data: authUser, error: authError }, { data: profile, error: profileError }, { data: notes, error: notesError }] = await Promise.all([
      auth.admin.auth.admin.getUserById(profileId),
      auth.admin.from('profiles').select('id,user_type,city,bio,username,created_at').eq('id', profileId).maybeSingle(),
      auth.admin.from('admin_user_notes').select('id,admin_id,note,created_at').eq('user_id', profileId).order('created_at', { ascending: false }).limit(100)
    ]);
    if (authError || profileError || notesError) return NextResponse.json({ error: authError?.message || profileError?.message || notesError?.message }, { status: 500 });
    if (!authUser?.user || !profile) return NextResponse.json({ error: 'İstifadəçi tapılmadı' }, { status: 404 });
    return NextResponse.json({ profile: { ...profile, email: authUser.user.email, full_name: authUser.user.user_metadata?.full_name || '', email_confirmed: Boolean(authUser.user.email_confirmed_at), created_at: authUser.user.created_at, banned_until: authUser.user.banned_until || null }, notes: notes || [] });
  }
  const query = params.get('q')?.trim().toLowerCase() || '';
  const requestedType = params.get('type') || 'all';
  const userType = ['teacher', 'student', 'university_student'].includes(requestedType) ? requestedType : 'all';
  const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(params.get('from') || '') ? params.get('from') : '';
  const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(params.get('to') || '') ? params.get('to') : '';
  const page = Math.max(1, Math.min(400, Number.parseInt(params.get('page') || '1', 10) || 1));
  const sort = params.get('sort') === 'created_asc' ? 'created_asc' : 'created_desc';
  const pageSize = 25;
  const offset = (page - 1) * pageSize;
  const matches = [];
  let scannedAll = false;
  let scanPage = 1;
  const maxPages = 100;
  while (scanPage <= maxPages) {
    const pageNumbers = Array.from({ length: Math.min(5, maxPages - scanPage + 1) }, (_, i) => scanPage + i);
    const responses = await Promise.all(pageNumbers.map((n) => auth.admin.auth.admin.listUsers({ page: n, perPage: 100 })));
    const failed = responses.find((r) => r.error);
    if (failed) return NextResponse.json({ error: failed.error.message }, { status: 500 });
    const batch = responses.flatMap((r) => r.data.users);
    const ids = batch.map((u) => u.id);
    const { data: profiles, error: profileError } = ids.length ? await auth.admin.from('profiles').select('id,user_type,city,bio,username').in('id', ids) : { data: [], error: null };
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    for (const u of batch) {
      const fullName = u.user_metadata?.full_name || '';
      const profile = profileMap[u.id] || {};
      const type = profile.user_type || 'student';
      const createdDay = (u.created_at || '').slice(0, 10);
      if (query && !`${u.email || ''} ${fullName}`.toLowerCase().includes(query)) continue;
      if (userType !== 'all' && type !== userType) continue;
      if (dateFrom && createdDay < dateFrom) continue;
      if (dateTo && createdDay > dateTo) continue;
      matches.push({ id: u.id, email: u.email, full_name: fullName, user_type: type, city: profile.city || '', bio: profile.bio || '', username: profile.username || '', created_at: u.created_at, email_confirmed: Boolean(u.email_confirmed_at), banned_until: u.banned_until || null });
    }
    const exhausted = responses.some((r) => r.data.users.length < 100);
    scanPage += pageNumbers.length;
    if (exhausted) { scannedAll = true; break; }
    if (sort === 'created_desc' && matches.length > offset + pageSize) break;
  }
  matches.sort((a, b) => (sort === 'created_asc' ? 1 : -1) * (new Date(a.created_at) - new Date(b.created_at)));
  return NextResponse.json({ users: matches.slice(offset, offset + pageSize), page, hasMore: matches.length > offset + pageSize || !scannedAll, scannedLimit: scanPage > maxPages && !scannedAll });
}

export async function POST(req) {
  let auth;
  try { auth = await adminFor(req); } catch (e) { return NextResponse.json({ error: e.message }, { status: 503 }); }
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => null);
  const userId = body?.userId;
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  if (!userId || note.length < 1 || note.length > 2000) return NextResponse.json({ error: 'Qeyd 1–2000 simvol olmalıdır' }, { status: 400 });
  const { data: exists, error: userError } = await auth.admin.auth.admin.getUserById(userId);
  if (userError || !exists.user) return NextResponse.json({ error: 'İstifadəçi tapılmadı' }, { status: 404 });
  const { data, error } = await auth.admin.from('admin_user_notes').insert({ user_id: userId, admin_id: auth.actor.id, note }).select('id,admin_id,note,created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const audited = await auth.admin.from('admin_audit_log').insert({ actor_id: auth.actor.id, action: 'create_note', target_type: 'auth_user', target_id: userId, summary: { note_id: data.id } });
  if (audited.error) return NextResponse.json({ error: 'Qeyd saxlanıldı, audit qeydi yazılmadı.' }, { status: 500 });
  return NextResponse.json({ note: data }, { status: 201 });
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
