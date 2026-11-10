'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../AuthProvider';
import Icon from '../Icons';

export default function FeedPoll({ postId }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('feed_poll_results', { p_post: postId });
    setRows(data || []); setError(e?.message || ''); setLoading(false);
  }, [postId]);
  useEffect(() => { load(); }, [load]);
  async function vote(id) {
    if (!user) return;
    setBusy(true); setError('');
    const { error: e } = await supabase.rpc('vote_feed_poll', { p_post: postId, p_option: id });
    setBusy(false);
    if (e) setError(e.message); else await load();
  }
  const hasVoted = rows.some((r) => r.has_voted);
  return <section className="feed-poll" aria-label="Sorğu">
    {loading ? <div className="space-y-2" aria-busy="true"><div className="skeleton h-10 w-full"/><div className="skeleton h-10 w-full"/></div> : rows.map((r) => <button type="button" key={r.option_id} disabled={busy || !user} onClick={() => vote(r.option_id)} className={`poll-option ${r.selected ? 'poll-option-selected' : ''}`} aria-pressed={r.selected}>
      <span className="poll-option-copy"><span className="min-w-0 flex-1 truncate">{r.label}</span>{hasVoted&&<span className="text-xs font-bold">{r.percentage}%</span>}</span>
      {hasVoted&&<span className="poll-option-bar" style={{ width: `${r.percentage}%` }}/>} {r.selected&&<Icon name="check" className="poll-check h-4 w-4"/>}
    </button>)}
    {!loading&&rows.length>0&&<div className="mt-2 flex items-center justify-between text-xs text-muted"><span>{rows[0].total_votes} səs · {hasVoted?'Səsiniz qeydə alındı':'Səs vermək üçün seçim edin'}</span>{!user&&!hasVoted&&<Link href="/auth" className="font-semibold text-primary">Daxil ol</Link>}</div>}
    {error&&<p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
  </section>;
}
