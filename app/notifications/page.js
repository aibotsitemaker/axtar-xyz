'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useAuth, LoginPrompt } from '../../components/AuthProvider';
import Icon from '../../components/Icons';
import { Alert, EmptyState, ListSkeleton, LoadMore, PageHeader, Spinner } from '../../components/ui';
import { errText, timeAgo } from '../../lib/format';

const PAGE = 20;
const ICON = { forum_reply: 'message', forum_reply_to_reply: 'reply', moderation: 'shield', feed_like: 'heart', feed_comment: 'message', feed_mention: 'user', teacher_review: 'teacher', verification: 'shield', admin_announcement: 'bell' };

// Sayt daxili bildirişlər (e-poçt göndərilmir). Yalnız öz bildirişləri oxunur (RLS); oxunmuş işarəsi yalnız is_read sütununu dəyişir.
export default function NotificationsPage() {
  const { user, loading, refreshMe } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState('loading');
  const [moreBusy, setMoreBusy] = useState(false);
  const [allBusy, setAllBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async (from = 0) => {
    const { data, error, count } = await supabase.from('notifications')
      .select('id, type, title, body, link, is_read, created_at', { count: 'exact' })
      .order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    return { data: data || [], error, count };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let stop = false;
    load(0).then(({ data, error, count }) => {
      if (stop) return;
      if (error) { setState('error'); return; }
      setRows(data);
      setTotal(count ?? data.length);
      setState('ready');
    });
    return () => { stop = true; };
  }, [user, load]);

  async function more() {
    setMoreBusy(true);
    const { data, error } = await load(rows.length);
    setMoreBusy(false);
    if (error) { setErr('Daha çox bildiriş yüklənmədi.'); return; }
    const seen = new Set(rows.map((r) => r.id));
    setRows((r) => [...r, ...data.filter((x) => !seen.has(x.id))]);
  }

  async function markOne(n) {
    if (n.is_read) return;
    setRows((r) => r.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    if (error) setRows((r) => r.map((x) => (x.id === n.id ? { ...x, is_read: false } : x)));
    refreshMe();
  }

  async function markAll() {
    setAllBusy(true);
    setErr('');
    const { error } = await supabase.rpc('mark_all_notifications_read');
    setAllBusy(false);
    if (error) { setErr(errText(error)); return; }
    setRows((r) => r.map((x) => ({ ...x, is_read: true })));
    refreshMe();
  }

  if (loading) return <div className="mx-auto max-w-3xl"><ListSkeleton count={3} /></div>;
  if (!user) return <LoginPrompt text="Bildirişlərə baxmaq üçün daxil olun." next="/notifications" />;

  const unread = rows.filter((r) => !r.is_read).length;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Bildirişlər" subtitle="Forum, Feed, rəylər, doğrulama, moderasiya və admin elanları."
        action={<button className="btn btn-secondary btn-sm" onClick={markAll} disabled={allBusy || unread === 0}>{allBusy ? <Spinner /> : <Icon name="check" className="h-4 w-4" />}Hamısını oxunmuş et</button>} />
      {err && <Alert type="error" className="mb-4">{err}</Alert>}
      {state === 'loading' ? <ListSkeleton count={3} /> : state === 'error' ? (
        <Alert type="error">Bildirişləri yükləmək mümkün olmadı. Səhifəni yeniləyin.</Alert>
      ) : rows.length === 0 ? (
        <EmptyState icon="bell" title="Hələ bildiriş yoxdur" text="Mövzunuza və ya cavabınıza cavab yazılanda burada görünəcək." action={<Link href="/forum" className="btn btn-primary">Foruma keç</Link>} />
      ) : (
        <ul className="space-y-2" data-testid="notifications">
          {rows.map((n) => {
            const inner = (
              <>
                <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${n.is_read ? 'bg-canvas text-muted' : 'bg-primary-soft text-primary'}`}><Icon name={ICON[n.type] || 'bell'} className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className={`block break-words text-sm ${n.is_read ? 'text-ink/80' : 'font-semibold text-ink'}`}>{n.title}</span>
                  {n.body && <span className="mt-0.5 block break-words text-xs text-muted">{n.body}</span>}
                  <span className="mt-1 block text-xs text-muted">{timeAgo(n.created_at)}</span>
                </span>
                {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Oxunmamış" />}
              </>
            );
            return (
              <li key={n.id} className={`card flex items-start gap-3 p-3.5 ${n.is_read ? '' : 'border-primary/30'}`}>
                {n.link ? (
                  <Link href={n.link} onClick={() => markOne(n)} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg hover:opacity-90">{inner}</Link>
                ) : <div className="flex min-w-0 flex-1 items-start gap-3">{inner}</div>}
                {!n.is_read && <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={() => markOne(n)} aria-label="Oxunmuş kimi işarələ"><Icon name="check" className="h-4 w-4" /></button>}
              </li>
            );
          })}
        </ul>
      )}
      <LoadMore onClick={more} loading={moreBusy} hasMore={state === 'ready' && rows.length < total} />
    </div>
  );
}
