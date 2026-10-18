'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

const Ctx = createContext({ user: null, loading: true });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>;
}

export function LoginPrompt({ text = 'Bu bölmədən istifadə üçün daxil olun.' }) {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <p className="mb-4 text-slate-600">{text}</p>
      <Link href="/auth" className="btn btn-primary">Daxil ol / Qeydiyyat</Link>
    </div>
  );
}
