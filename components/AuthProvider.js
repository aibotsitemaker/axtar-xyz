'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import Icon from './Icons';

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
    <div className="card mx-auto my-8 max-w-md px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary"><Icon name="user" className="h-6 w-6" /></div>
      <p className="mb-5 text-muted">{text}</p>
      <div className="flex justify-center gap-2">
        <Link href="/auth" className="btn btn-primary">Daxil ol</Link>
        <Link href="/auth?mode=register" className="btn btn-secondary">Qeydiyyat</Link>
      </div>
    </div>
  );
}
