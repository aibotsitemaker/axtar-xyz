'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Icon from '../../components/Icons';
import { Alert, Spinner } from '../../components/ui';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mode') === 'register') setMode('register');
  }, []);

  function switchMode(m) { setMode(m); setMsg({ type: '', text: '' }); }

  async function submit(e) {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    setBusy(true);
    try {
      if (mode === 'register') {
        if (!agree) throw new Error('Davam etmək üçün şərtlərlə razılaşmalısınız.');
        if (password.length < 8) throw new Error('Parol ən azı 8 simvol olmalıdır.');
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
        if (error) throw error;
        if (data.session) router.push('/profile');
        else setMsg({ type: 'success', text: 'Qeydiyyat uğurludur. E-poçtunuza göndərilən təsdiq linkinə klikləyin.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/profile');
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Xəta baş verdi.' });
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    setMsg({ type: '', text: '' });
    if (!email) return setMsg({ type: 'error', text: 'Əvvəlcə e-poçt ünvanınızı yazın.' });
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset` });
    setMsg(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Parol bərpası linki e-poçtunuza göndərildi.' });
  }

  return (
    <div className="mx-auto max-w-md py-4 sm:py-10">
      <div className="card p-6 sm:p-8">
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-canvas p-1" role="tablist" aria-label="Giriş növü">
          {[['login', 'Daxil ol'], ['register', 'Qeydiyyat']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={mode === k} onClick={() => switchMode(k)}
              className={`h-9 rounded-md text-sm font-semibold transition-colors ${mode === k ? 'bg-surface text-primary shadow-card' : 'text-muted hover:text-ink'}`}>{l}</button>
          ))}
        </div>

        <h1 className="text-2xl font-bold tracking-tight">{mode === 'login' ? 'Xoş gəlmisiniz' : 'Hesab yaradın'}</h1>
        <p className="mt-1 text-sm text-muted">{mode === 'login' ? 'Hesabınıza daxil olun.' : 'Bir neçə saniyəyə qeydiyyatdan keçin.'}</p>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate={false}>
          {mode === 'register' && (
            <div>
              <label htmlFor="name" className="label">Ad və soyad</label>
              <input id="name" className="input" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad" />
            </div>
          )}
          <div>
            <label htmlFor="email" className="label">E-poçt</label>
            <input id="email" type="email" className="input" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ad@mail.com" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="label !mb-1.5">Parol</label>
              {mode === 'login' && <button type="button" onClick={forgot} className="mb-1.5 text-xs font-medium text-primary hover:underline">Şifrəni unutdum</button>}
            </div>
            <div className="relative">
              <input id="password" type={show ? 'text' : 'password'} className="input pr-11" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Parolu gizlət' : 'Parolu göstər'}
                className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink">
                <Icon name={show ? 'eyeOff' : 'eye'} className="h-4 w-4" />
              </button>
            </div>
            {mode === 'register' && <p className="hint">Ən azı 8 simvol.</p>}
          </div>
          {mode === 'register' && (
            <label className="flex items-start gap-2.5 text-sm text-muted">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-line accent-primary" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>
                <Link href="/legal/terms" className="font-medium text-primary hover:underline">İstifadə Şərtləri</Link> və{' '}
                <Link href="/legal/privacy" className="font-medium text-primary hover:underline">Məxfilik Siyasəti</Link> ilə razıyam.
              </span>
            </label>
          )}
          {msg.text && <Alert type={msg.type}>{msg.text}</Alert>}
          <button disabled={busy} className="btn btn-primary btn-lg w-full">
            {busy && <Spinner />}{mode === 'login' ? 'Daxil ol' : 'Qeydiyyatdan keç'}
          </button>
        </form>
      </div>
    </div>
  );
}
