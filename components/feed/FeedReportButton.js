'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../AuthProvider';
import { Alert } from '../ui';

const REASONS = [['spam','Spam və ya reklam'],['harassment','Təhqir və ya təhdid'],['misinformation','Yanlış məlumat'],['other','Digər']];

export default function FeedReportButton({ postId, commentId = null }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (!user) { setMessage({ type: 'error', text: 'Şikayət etmək üçün daxil olun.' }); return; }
    setBusy(true);
    const { error } = await supabase.from('feed_reports').insert({ reporter_id: user.id, post_id: commentId ? null : postId, comment_id: commentId, reason, details: details.trim() || null });
    setBusy(false);
    if (error) setMessage({ type: 'error', text: error.code === '23505' ? 'Bu məzmun barədə artıq şikayət göndərmisiniz.' : error.message });
    else { setMessage({ type: 'success', text: 'Şikayət moderasiya növbəsinə göndərildi.' }); setOpen(false); setDetails(''); }
  }

  return <span className="inline-block">
    <button type="button" className="text-xs text-muted hover:text-danger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>Şikayət et</button>
    {open && <form onSubmit={submit} className="mt-2 grid gap-2 rounded-lg border border-line bg-canvas p-3 sm:grid-cols-[1fr_1.5fr_auto]">
      <label className="sr-only" htmlFor={`feed-report-reason-${commentId||postId}`}>Səbəb</label>
      <select id={`feed-report-reason-${commentId||postId}`} className="input" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select>
      <label className="sr-only" htmlFor={`feed-report-details-${commentId||postId}`}>Əlavə məlumat</label>
      <input id={`feed-report-details-${commentId||postId}`} className="input" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Əlavə məlumat (könüllü)" />
      <button className="btn btn-danger btn-sm" disabled={busy}>{busy ? 'Göndərilir…' : 'Göndər'}</button>
    </form>}
    {message && <span className={`ml-2 text-xs ${message.type === 'error' ? 'text-danger' : 'text-success'}`} role="status">{message.text}</span>}
  </span>;
}
