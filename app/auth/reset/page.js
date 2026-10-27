'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import Icon from '../../../components/Icons';
import { Alert, Spinner } from '../../../components/ui';

export default function ResetPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  async function submit(e) {
    e.preventDefault();
    if (password.length < 8) return setMsg({ type: 'error', text: 'Parol ən azı 8 simvol olmalıdır.' });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMsg({ type: 'error', text: error.message });
    setMsg({ type: 'success', text: 'Parol yeniləndi. Yönləndirilirsiniz...' });
    setTimeout(() => router.push('/profile'), 1200);
  }

  return (
    <div className="mx-auto max-w-md py-4 sm:py-10">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Yeni parol</h1>
        <p className="mt-1 text-sm text-muted">E-poçtdakı linkdən gəldikdən sonra yeni parol təyin edin.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="np" className="label">Yeni parol</label>
            <div className="relative">
              <input id="np" type={show ? 'text' : 'password'} className="input pr-11" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Parolu gizlət' : 'Parolu göstər'}
                className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink">
                <Icon name={show ? 'eyeOff' : 'eye'} className="h-4 w-4" />
              </button>
            </div>
            <p className="hint">Ən azı 8 simvol.</p>
          </div>
          {msg.text && <Alert type={msg.type}>{msg.text}</Alert>}
          <button disabled={busy} className="btn btn-primary btn-lg w-full">{busy && <Spinner />}Parolu yenilə</button>
        </form>
      </div>
    </div>
  );
}
