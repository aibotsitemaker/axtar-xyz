'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { PageHeader, Spinner } from '../../../components/ui';
import { fmtDate } from '../../../lib/format';

const REASON = { spam: 'Spam və ya reklam', harassment: 'Təhqir və ya təhdid', misinformation: 'Yanlış məlumat', other: 'Digər' };

export default function FeedReportsPage() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('open');
  const [busy, setBusy] = useState(true);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState({});

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    let q = supabase.from('feed_reports').select('id,reporter_id,post_id,comment_id,reason,details,status,resolution_note,created_at,feed_posts(body),feed_comments(body,post_id),profiles:profiles!feed_reports_reporter_id_fkey(full_name)').order('created_at', { ascending: false }).limit(100);
    if (status !== 'all') q = q.eq('status', status);
    const { data, error: e } = await q;
    setBusy(false);
    if (e) { setError(e.message); setRows([]); return; }
    setRows(data || []);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  async function resolve(row, nextStatus) {
    setPending(row.id);
    setError('');
    const { error: e } = await supabase.rpc('admin_resolve_feed_report', { p_id: row.id, p_status: nextStatus, p_note: note[row.id]?.trim() || null });
    setPending('');
    if (e) { setError(e.message); return; }
    await load();
  }

  return <div>
    <PageHeader title="Feed şikayətləri" subtitle="Feed paylaşımı və şərhləri üzrə moderasiya növbəsi" action={<button className="btn btn-secondary btn-sm" disabled={busy} onClick={load}>{busy ? <Spinner /> : 'Yenilə'}</button>} />
    <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Şikayət filtri">{[['open','Açıq'],['resolved','Həll edilib'],['dismissed','Rədd edilib'],['all','Hamısı']].map(([key,label]) => <button key={key} className={`btn btn-sm ${status===key?'btn-primary':'btn-secondary'}`} onClick={() => setStatus(key)}>{label}</button>)}</div>
    {error && <div className="alert alert-error mb-4" role="alert">{error}</div>}
    {busy ? <div className="card flex justify-center p-10"><Spinner /></div> : rows.length === 0 ? <div className="card p-8 text-center text-sm text-muted">Bu filtrdə şikayət yoxdur.</div> : <div className="space-y-3">{rows.map((row) => {
      const postId = row.post_id || row.feed_comments?.post_id;
      const targetText = row.post_id ? row.feed_posts?.body : row.feed_comments?.body;
      return <article className="card p-4 sm:p-5" key={row.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="badge badge-muted">{REASON[row.reason] || row.reason}</span><p className="mt-2 text-xs text-muted">{row.profiles?.full_name || 'İstifadəçi'} · {fmtDate(row.created_at)} · {row.status}</p></div>{postId && <Link className="btn btn-secondary btn-sm" href={`/feed?post=${postId}`}>Paylaşımı aç</Link>}</div>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm">{targetText || 'Məzmun mövcud deyil'}</p>
        {row.details && <p className="mt-2 rounded-lg bg-canvas p-3 text-sm">Şikayət qeydi: {row.details}</p>}
        {row.status === 'open' && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><label className="sr-only" htmlFor={`feed-report-note-${row.id}`}>Moderasiya qeydi</label><input id={`feed-report-note-${row.id}`} className="input" maxLength={1000} placeholder="Daxili qərar qeydi (könüllü)" value={note[row.id] || ''} onChange={(e) => setNote((prev) => ({ ...prev, [row.id]: e.target.value }))} /><button disabled={!!pending} onClick={() => resolve(row,'resolved')} className="btn btn-primary btn-sm">{pending===row.id?<Spinner/>:'Həll et'}</button><button disabled={!!pending} onClick={() => resolve(row,'dismissed')} className="btn btn-secondary btn-sm">Rədd et</button></div>}
        {row.resolution_note && <p className="mt-2 text-xs text-muted">Qeyd: {row.resolution_note}</p>}
      </article>;
    })}</div>}
  </div>;
}
