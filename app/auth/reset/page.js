'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

export default function ResetPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  async function submit(e) {
    e.preventDefault();
    if (password.length < 8) return setMsg({ type: 'err', text: 'Parol ən azı 8 simvol olmalıdır.' });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMsg({ type: 'err', text: error.message });
    setMsg({ type: 'ok', text: 'Parol yeniləndi. Yönləndirilirsiniz...' });
    setTimeout(() => router.push('/profile'), 1200);
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6 md:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Yeni parol</h1>
        <p className="mt-1 text-sm text-slate-500">E-poçtdakı linkdən gəldikdən sonra yeni parol təyin edin.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label">Yeni parol</label>
            <input type="password" className="input" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {msg.text && <div className={`rounded-xl px-3 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</div>}
          <button disabled={busy} className="btn btn-primary w-full">{busy ? 'Gözləyin...' : 'Parolu yenilə'}</button>
        </form>
      </div>
    </div>
  );
}
