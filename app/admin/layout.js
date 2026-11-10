import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const token = (await cookies()).get('tehsilhub_admin_session')?.value;
  if (!token) redirect('/auth');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) redirect('/auth');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth.user) redirect('/auth');
  const { data: admin } = await db.from('platform_admins').select('user_id').eq('user_id', auth.user.id).maybeSingle();
  if (!admin) redirect('/');
  return children;
}
