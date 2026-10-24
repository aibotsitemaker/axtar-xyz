'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  async function submit(e) {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    setBusy(true);
    try {
      if (mode === 'register') {
        if (!agree) throw new Error('Davam etmək üçün şərtlərlə razılaşmalısınız.');
        if (password.length < 8) throw new Error('Parol ən azı 8 simvol olmalıdır.');
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: name } }
        });
        if (error) throw error;
        if (data.session) router.push('/profile');
        else setMsg({ type: 'ok', text: 'Qeydiyyat uğurludur. E-poçtunuza göndərilən təsdiq linkinə klikləyin.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/profile');
      }
    } catch (err) {
      setMsg({ type: 'err', text: err.message || 'Xəta baş verdi.' });
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    setMsg({ type: '', text: '' });
    if (!email) return setMsg({ type: 'err', text: 'Əvvəlcə e-poçt ünvanınızı yazın.' });
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset` });
    setMsg(error ? { type: 'err', text: error.message } : { type: 'ok', text: 'Parol bərpası linki e-poçtunuza göndərildi.' });
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6 md:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{mode === 'login' ? 'Xoş gəldiniz' : 'Hesab yaradın'}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'login' ? 'Hesabınıza daxil olun.' : 'Bir neçə saniyəyə qeydiyyatdan keçin.'}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="label">Ad və soyad</label>
              <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad" />
            </div>
          )}
          <div>
            <label className="label">E-poçt</label>
            <input type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ad@mail.com" />
          </div>
          <div>
            <label className="label">Parol</label>
            <input type="password" className="input" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {mode === 'login' && (
            <button type="button" onClick={forgot} className="text-xs text-brand hover:underline">Şifrəni unutdum</button>
          )}
          {mode === 'register' && (
            <label className="flex items-start gap-2 text-xs text-slate-500">
              <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>
                <Link href="/legal/terms" className="text-brand underline">İstifadə Şərtləri</Link> və{' '}
                <Link href="/legal/privacy" className="text-brand underline">Məxfilik Siyasəti</Link> ilə razıyam.
              </span>
            </label>
          )}
          {msg.text && (
            <div className={`rounded-xl px-3 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</div>
          )}
          <button disabled={busy} className="btn btn-primary w-full">
            {busy ? 'Gözləyin...' : mode === 'login' ? 'Daxil ol' : 'Qeydiyyatdan keç'}
          </button>
        </form>

        <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMsg({ type: '', text: '' }); }}
          className="mt-5 w-full text-center text-sm text-slate-500 hover:text-ink">
          {mode === 'login' ? 'Hesabınız yoxdur? Qeydiyyat' : 'Artıq hesabınız var? Daxil olun'}
        </button>
      </div>
    </div>
  );
}
