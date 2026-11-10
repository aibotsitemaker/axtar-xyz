'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import AuthorLine from '../../../components/forum/AuthorLine';
import NoteDialog from '../../../components/forum/NoteDialog';
import ModDialog from '../../../components/admin/ModDialog';
import StatusBadge from '../../../components/admin/StatusBadge';
import { useProfileMap } from '../../../components/admin/useProfileMap';
import { Alert, EmptyState, ListSkeleton, LoadMore, PageHeader } from '../../../components/ui';
import { PAGE } from '../../../lib/admin';
import { REASON_LABEL } from '../../../lib/forum';
import { usePaged } from '../../../lib/usePaged';
import { errText, fmtDateTime, timeAgo } from '../../../lib/format';

const FILTERS = [['open', 'Açıq'], ['resolved', 'Həll edilmiş'], ['dismissed', 'Rədd edilmiş'], ['all', 'Hamısı']];
const FILTER_KEYS = FILTERS.map((f) => f[0]);
const REPORT_STATUS = { open: 'Açıq', resolved: 'Həll edilib', dismissed: 'Rədd edilib' };
const REPORT_TONE = {
  open: 'badge border border-warning/30 bg-warning-soft text-warning',
  resolved: 'badge bg-success-soft text-success',
  dismissed: 'badge badge-muted'
};
const COLS = 'id, reporter_id, topic_id, reply_id, reason, details, status, resolved_by, resolved_at, resolution_note, created_at';

// Şikayət olunan mövzu/cavabların cari vəziyyətini yükləyir (version dəyişəndə yenidən).
function useTargets(rows, version) {
  const [t, setT] = useState({ topics: {}, replies: {} });
  const topicKey = [...new Set(rows.map((r) => r.topic_id))].sort().join(',');
  const replyKey = [...new Set(rows.map((r) => r.reply_id).filter(Boolean))].sort().join(',');
  useEffect(() => {
    const tIds = topicKey ? topicKey.split(',') : [];
    const rIds = replyKey ? replyKey.split(',') : [];
    if (!tIds.length) return;
    let stop = false;
    Promise.all([
      supabase.from('forum_topics').select('id, title, status, author_id').in('id', tIds),
      rIds.length ? supabase.from('forum_replies').select('id, topic_id, body, status, author_id').in('id', rIds) : Promise.resolve({ data: [] })
    ]).then(([a, b]) => {
      if (stop) return;
      const topics = {};
      const replies = {};
      (a.data || []).forEach((x) => { topics[x.id] = x; });
      (b.data || []).forEach((x) => { replies[x.id] = x; });
      setT({ topics, replies });
    });
    return () => { stop = true; };
  }, [topicKey, replyKey, version]);
  return t;
}

function ReportCard({ r, target, targetAuthor, reporter, resolver, onMod, onResolve }) {
  const isReply = !!r.reply_id;
  const content = isReply ? target.reply : target.topic;
  const tStatus = content?.status;
  return (
    <article className="card p-4 sm:p-5" data-testid="report" data-report-status={r.status}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={REPORT_TONE[r.status]}>{REPORT_STATUS[r.status]}</span>
        <span className="badge badge-muted">{REASON_LABEL[r.reason] || r.reason}</span>
        <span className="text-xs text-muted">{isReply ? 'Cavab' : 'Mövzu'} şikayəti · {timeAgo(r.created_at)}</span>
      </div>

      <div className="rounded-lg bg-canvas p-3">
        {content ? (
          <>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Link href={`/forum/${r.topic_id}`} className="break-words text-sm font-semibold text-ink hover:text-primary hover:underline">
                {isReply ? `Cavab: ${target.topic?.title || 'mövzuya keç'}` : content.title}
              </Link>
              {tStatus && tStatus !== 'active' && <StatusBadge status={tStatus} />}
            </div>
            {isReply && <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm text-ink/80">{content.body}</p>}
            <div className="mt-2 text-xs text-muted">Müəllif: <AuthorLine id={content.author_id} profile={targetAuthor} /></div>
          </>
        ) : <p className="text-sm text-muted">Məzmun tapılmadı və ya silinib.</p>}
      </div>

      <p className="mt-3 text-xs text-muted">Şikayət edən: <AuthorLine id={r.reporter_id} profile={reporter} /> · {fmtDateTime(r.created_at)}</p>
      {r.details && <p className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-line px-3 py-2 text-sm">{r.details}</p>}
      {r.status !== 'open' && (
        <p className="mt-2 text-xs text-muted">
          {REPORT_STATUS[r.status]}: {resolver?.full_name || 'Admin'} · {fmtDateTime(r.resolved_at)}
          {r.resolution_note ? <span className="block text-ink/80">Qeyd: {r.resolution_note}</span> : null}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {r.status === 'open' ? (
          <>
            {tStatus === 'active' && <button className="btn btn-secondary btn-sm" onClick={() => onMod(r, 'hide')}>Məzmunu gizlət</button>}
            {tStatus === 'active' && <button className="btn btn-danger btn-sm" onClick={() => onMod(r, 'delete')}>Məzmunu sil</button>}
            {tStatus === 'hidden' && <button className="btn btn-secondary btn-sm" onClick={() => onMod(r, 'restore')}>Məzmunu bərpa et</button>}
            <button className="btn btn-primary btn-sm" onClick={() => onResolve(r, 'resolved')}>Həll edildi</button>
            <button className="btn btn-secondary btn-sm" onClick={() => onResolve(r, 'dismissed')}>Rədd et</button>
          </>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={() => onResolve(r, 'open')}>Yenidən aç</button>
        )}
      </div>
    </article>
  );
}

// Şikayətlərin araşdırılması. Məzmunu gizlətmək/silmək həmin məzmuna aid açıq şikayətləri avtomatik "həll edildi" edir.
export default function AdminReportsPage() {
  const [status, setStatus] = useState(null);
  const [version, setVersion] = useState(0);
  const [mod, setMod] = useState(null);
  const [dlg, setDlg] = useState(null); // { id, status }
  const [busy, setBusy] = useState(false);
  const [dlgErr, setDlgErr] = useState('');
  const [flash, setFlash] = useState('');

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('status');
    setStatus(FILTER_KEYS.includes(s) ? s : 'open');
  }, []);

  const list = usePaged((from, to) => {
    let q = supabase.from('forum_reports').select(COLS, from === 0 ? { count: 'exact' } : undefined);
    if (status !== 'all') q = q.eq('status', status);
    return q.order('created_at', { ascending: false }).range(from, to);
  }, PAGE, status || '', status !== null);

  const targets = useTargets(list.rows, version);
  const ids = [
    ...list.rows.flatMap((r) => [r.reporter_id, r.resolved_by]),
    ...Object.values(targets.topics).map((t) => t.author_id),
    ...Object.values(targets.replies).map((x) => x.author_id)
  ];
  const profiles = useProfileMap(ids);

  function pick(s) {
    setStatus(s);
    setFlash('');
    window.history.replaceState(null, '', s === 'open' ? '/admin/reports' : `/admin/reports?status=${s}`);
  }

  const done = (msg) => { setFlash(msg); setVersion((v) => v + 1); list.reload(); };

  async function resolve(note) {
    setBusy(true);
    setDlgErr('');
    const { error } = await supabase.rpc('admin_resolve_report', { p_id: dlg.id, p_status: dlg.status, p_note: note || null });
    setBusy(false);
    if (error) { setDlgErr(errText(error)); return; }
    setDlg(null);
    done(dlg.status === 'open' ? 'Şikayət yenidən açıldı.' : 'Şikayət qeydə alındı və audit jurnalına yazıldı.');
  }

  const DLG_TEXT = {
    resolved: ['Şikayəti həll edilmiş kimi işarələ', 'Məzmuna toxunulmur; yalnız şikayət "həll edildi" statusu alır.', 'Həll edildi'],
    dismissed: ['Şikayəti rədd et', 'Şikayət əsassız hesab olunur və məzmun olduğu kimi qalır.', 'Rədd et'],
    open: ['Şikayəti yenidən aç', 'Şikayət yenidən "açıq" siyahısına qayıdır.', 'Yenidən aç']
  };

  return (
    <div>
      <PageHeader title="Şikayətlər" subtitle="İstifadəçilərin göndərdiyi şikayətlər. Hər nəticə audit jurnalında qeyd olunur." />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Şikayət statusu">
        {FILTERS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={status === k} onClick={() => pick(k)}
            className={`btn btn-sm ${status === k ? 'btn-primary' : 'btn-secondary'}`}>{l}</button>
        ))}
      </div>
      {flash && <Alert type="success" className="mb-4">{flash}</Alert>}
      {list.error && <Alert type="error" className="mb-4">{list.error}</Alert>}

      {status === null || list.loading ? <ListSkeleton count={3} /> : list.rows.length === 0 && !list.error ? (
        <EmptyState icon="flag" title={status === 'open' ? 'Açıq şikayət yoxdur' : 'Şikayət tapılmadı'} text={status === 'open' ? 'Bütün şikayətlərə baxılıb.' : 'Başqa status seçin.'} />
      ) : (
        <div className="space-y-3">
          {list.rows.map((r) => (
            <ReportCard key={r.id} r={r}
              target={{ topic: targets.topics[r.topic_id], reply: r.reply_id ? targets.replies[r.reply_id] : null }}
              targetAuthor={profiles[(r.reply_id ? targets.replies[r.reply_id] : targets.topics[r.topic_id])?.author_id]}
              reporter={profiles[r.reporter_id]} resolver={profiles[r.resolved_by]}
              onMod={(rep, action) => setMod(rep.reply_id
                ? { scope: 'reply', id: rep.reply_id, action, label: (targets.replies[rep.reply_id]?.body || '').slice(0, 60) }
                : { scope: 'topic', id: rep.topic_id, action, label: (targets.topics[rep.topic_id]?.title || '').slice(0, 60) })}
              onResolve={(rep, st) => { setDlg({ id: rep.id, status: st }); setDlgErr(''); }} />
          ))}
        </div>
      )}
      <LoadMore onClick={list.more} loading={list.moreLoading} hasMore={list.hasMore} />

      <ModDialog mod={mod} onClose={() => setMod(null)} onDone={(m) => { setMod(null); done(m); }} />
      {dlg && (
        <NoteDialog key={`${dlg.id}-${dlg.status}`} open title={DLG_TEXT[dlg.status][0]} text={DLG_TEXT[dlg.status][1]} confirmLabel={DLG_TEXT[dlg.status][2]}
          withNote={dlg.status !== 'open'} noteHint="nəticə qeydi, yalnız adminlərə görünür; könüllü" busy={busy} error={dlgErr} onConfirm={resolve} onClose={() => setDlg(null)} />
      )}
    </div>
  );
}
