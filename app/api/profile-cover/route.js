import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { avatarExtension } from '../../../lib/avatar-file.mjs';

export const runtime = 'nodejs';
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return NextResponse.json({ error: 'Giriş tələb olunur.' }, { status: 401 });
  let form;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: 'Fayl sorğusu oxunmadı.' }, { status: 400 }); }
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function' || file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ error: 'Cover şəkli 1 bayt–5 MB arasında olmalıdır.' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = avatarExtension(bytes, file.type);
  if (!extension) return NextResponse.json({ error: 'Yalnız həqiqi JPG, PNG və WebP şəkilləri qəbul edilir.' }, { status: 415 });
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: authError } = await client.auth.getUser(token);
  if (authError || !userData.user) return NextResponse.json({ error: 'Giriş sessiyası etibarsızdır.' }, { status: 401 });
  const { data: allowed, error: limitError } = await client.rpc('claim_avatar_upload');
  if (limitError) return NextResponse.json({ error: 'Yükləmə limiti yoxlanmadı.' }, { status: 503 });
  if (!allowed) return NextResponse.json({ error: 'Saat ərzində ən çox 10 profil şəkli yükləmək olar.' }, { status: 429 });
  const objectPath = `${userData.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from('profile-covers').upload(objectPath, bytes, { contentType: file.type, cacheControl: '3600', upsert: false });
  if (error) return NextResponse.json({ error: 'Cover şəklini saxlamaq mümkün olmadı.' }, { status: 400 });
  return NextResponse.json({ path: objectPath, publicUrl: client.storage.from('profile-covers').getPublicUrl(objectPath).data.publicUrl });
}
