'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import Icon from './Icons';

// me: serverdən (my_context RPC) gələn təsdiqlənmiş kontekst. Admin / hesab tipi / blok məlumatı
// YALNIZ buradan oxunur; interfeys bununla yalnız düymələri göstərir, real icazə bazada yoxlanılır.
const EMPTY_ME = { loaded: false, fullName: '', accountType: null, isAdmin: false, isSuperAdmin: false, blockedUntil: null, unread: 0 };
const Ctx = createContext({ user: null, loading: true, me: EMPTY_ME, refreshMe: () => {} });
export const useAuth = () => useContext(Ctx);

// Yalnız sayt daxilində yönləndirmə: "/..." ilə başlayan, "//" və ya sxem olmayan yollar.
export function safeNext(raw) {
  const v = String(raw || '');
  return v.startsWith('/') && !v.startsWith('//') && !v.includes('\\') && v.length <= 200 ? v : '';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(EMPTY_ME);
  const userId = user?.id || null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshMe = useCallback(async () => {
    if (!userId) { setMe({ ...EMPTY_ME, loaded: true }); return; }
    const { data, error } = await supabase.rpc('my_context');
    // Köhnə bazada (06/07 tətbiq olunmayıb) RPC yoxdur: sayt yenə işləyir, admin/rol məlumatı boş qalır.
    if (error || !data) { setMe({ ...EMPTY_ME, loaded: true }); return; }
    setMe({
      loaded: true,
      fullName: data.full_name || '',
      accountType: data.account_type || null,
      isAdmin: data.is_admin === true,
      isSuperAdmin: data.is_super_admin === true,
      blockedUntil: data.blocked_until || null,
      unread: Number(data.unread_notifications) || 0
    });
  }, [userId]);

  useEffect(() => {
    let stop = false;
    if (!userId) { setMe({ ...EMPTY_ME, loaded: true }); return undefined; }
    setMe((m) => (m.loaded ? { ...m, loaded: false } : m));
    Promise.resolve().then(() => { if (!stop) refreshMe(); });
    return () => { stop = true; };
  }, [userId, refreshMe]);

  const value = useMemo(() => ({ user, loading, me, refreshMe }), [user, loading, me, refreshMe]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function LoginPrompt({ text = 'Bu bölmədən istifadə üçün daxil olun.', next = '' }) {
  const n = safeNext(next);
  const q = n ? `next=${encodeURIComponent(n)}` : '';
  return (
    <div className="card mx-auto my-8 max-w-md px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary"><Icon name="user" className="h-6 w-6" /></div>
      <p className="mb-5 text-muted">{text}</p>
      <div className="flex justify-center gap-2">
        <Link href={q ? `/auth?${q}` : '/auth'} className="btn btn-primary">Daxil ol</Link>
        <Link href={q ? `/auth?mode=register&${q}` : '/auth?mode=register'} className="btn btn-secondary">Qeydiyyat</Link>
      </div>
    </div>
  );
}
