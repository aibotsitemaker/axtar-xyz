'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import AuthorLine from '../../../components/forum/AuthorLine';
import ModDialog from '../../../components/admin/ModDialog';
import StatusBadge from '../../../components/admin/StatusBadge';
import { useProfileMap } from '../../../components/admin/useProfileMap';
import { Table, Td } from '../../../components/admin/Table';
import Icon from '../../../components/Icons';
import { Alert, EmptyState, ListSkeleton, LoadMore, PageHeader } from '../../../components/ui';
import { PAGE } from '../../../lib/admin';
import { TOPIC_COLS, loadCategories, searchTerm } from '../../../lib/forum';
import { usePaged } from '../../../lib/usePaged';
import { fmtDateTime, timeAgo } from '../../../lib/format';

const STATUS_OPTS = [['', 'Bütün statuslar'], ['active', 'Aktiv'], ['hidden', 'Gizli'], ['deleted', 'Silinmiş']];
const STATUS_KEYS = STATUS_OPTS.map((s) => s[0]);

function FilterForm({ f, onApply, cats, label, placeholder }) {
  const [draft, setDraft] = useState(f.q);
  const has = f.q || f.status || f.cat;
  return (
    <form role="search" aria-label={label} className={`card mb-5 grid gap-3 p-4 ${cats ? 'sm:grid-cols-[1fr_auto_auto_auto]' : 'sm:grid-cols-[1fr_auto_auto]'}`}
      onSubmit={(e) => { e.preventDefault(); onApply({ q: searchTerm(draft) }); }}>
      <div className="relative">
        <label htmlFor="af-q" className="sr-only">Axtarış</label>
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input id="af-q" type="search" className="input pl-9" maxLength={60} placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} />
      </div>
      <div>
        <label htmlFor="af-status" className="sr-only">Status</label>
        <select id="af-status" className="input" value={f.status} onChange={(e) => onApply({ status: e.target.value })}>
          {STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {cats && (
        <div>
          <label htmlFor="af-cat" className="sr-only">Kateqoriya</label>
          <select id="af-cat" className="input" value={f.cat} onChange={(e) => onApply({ cat: e.target.value })}>
            <option value="">Bütün kateqoriyalar</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (deaktiv)'}</option>)}
          </select>
        </div>
      )}
      <div className="flex gap-2">
        <button className="btn btn-primary">Axtar</button>
        {has && <button type="button" className="btn btn-secondary" onClick={() => { setDraft(''); onApply({ q: '', status: '', cat: '' }); }}>Təmizlə</button>}
      </div>
    </form>
  );
}

function TopicsPanel({ initial, cats, onFlash }) {
  const [f, setF] = useState(initial);
  const [mod, setMod] = useState(null);
  const key = `${f.q}|${f.status}|${f.cat}`;

  const list = usePaged((from, to) => {
    let q = supabase.from('forum_topics').select(TOPIC_COLS, from === 0 ? { count: 'exact' } : undefined);
    if (f.status) q = q.eq('status', f.status);
    if (f.cat) q = q.eq('category_id', f.cat);
    const t = searchTerm(f.q);
    if (t) q = q.or(`title.ilike.%${t}%,excerpt.ilike.%${t}%`);
    return q.order('last_activity_at', { ascending: false }).range(from, to);
  }, PAGE, key);

  const profiles = useProfileMap(list.rows.map((t) => t.author_id));
  const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));
  const ask = (t, action) => setMod({ scope: 'topic', id: t.id, action, label: t.title.slice(0, 60) });

  function apply(next) {
    const n = { ...f, ...next };
    setF(n);
    const sp = new URLSearchParams({ view: 'topics' });
    if (n.q) sp.set('q', n.q);
    if (n.status) sp.set('status', n.status);
    window.history.replaceState(null, '', `/admin/forum?${sp.toString()}`);
  }

  return (
    <div>
      <FilterForm f={f} onApply={apply} cats={cats} label="Mövzu axtarışı" placeholder="Başlıq və ya mətn axtarın..." />
      <p className="mb-3 text-xs text-muted" aria-live="polite">{list.loading ? 'Yüklənir…' : `${list.total} mövzu`}</p>
      {list.error && <Alert type="error" className="mb-4">{list.error}</Alert>}
      {list.loading ? <ListSkeleton count={4} /> : list.rows.length === 0 && !list.error ? (
        <EmptyState icon="message" title="Mövzu tapılmadı" text="Axtarışı və ya filtrləri dəyişin." />
      ) : list.rows.length > 0 && (
        <Table label="Forum mövzuları" head={['Mövzu', 'Müəllif', 'Kateqoriya', 'Cavab', 'Son aktivlik', 'Vəziyyət', 'Əməliyyatlar']}>
          {list.rows.map((t) => (
            <tr key={t.id} data-testid="topic-row">
              <Td className="max-w-xs">
                <Link href={`/forum/${t.id}`} className="break-words font-medium text-ink hover:text-primary hover:underline">{t.title}</Link>
                <div className="text-xs text-muted">{fmtDateTime(t.created_at)}</div>
              </Td>
              <Td><AuthorLine id={t.author_id} profile={profiles[t.author_id]} /></Td>
              <Td className="text-muted">{catMap[t.category_id]?.name || '—'}</Td>
              <Td className="text-muted">{t.reply_count}</Td>
              <Td className="whitespace-nowrap text-muted">{timeAgo(t.last_activity_at)}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <StatusBadge status={t.status} />
                  {t.is_pinned && <span className="badge"><Icon name="pushpin" className="h-3 w-3" />Sabit</span>}
                  {t.is_locked && <span className="badge badge-muted"><Icon name="lock" className="h-3 w-3" />Bağlı</span>}
                </div>
              </Td>
              <Td>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Link href={`/forum/${t.id}`} className="btn btn-secondary btn-sm">Aç</Link>
                  {t.status === 'active' && <button className="btn btn-secondary btn-sm" onClick={() => ask(t, 'hide')}>Gizlət</button>}
                  {t.status !== 'active' && <button className="btn btn-secondary btn-sm" onClick={() => ask(t, 'restore')}>Bərpa et</button>}
                  {t.status !== 'deleted' && <button className="btn btn-danger btn-sm" onClick={() => ask(t, 'delete')}>Sil</button>}
                  {t.status === 'active' && <button className="btn btn-ghost btn-sm" onClick={() => ask(t, t.is_pinned ? 'unpin' : 'pin')}>{t.is_pinned ? 'Sabiti götür' : 'Sabitlə'}</button>}
                  {t.status === 'active' && <button className="btn btn-ghost btn-sm" onClick={() => ask(t, t.is_locked ? 'unlock' : 'lock')}>{t.is_locked ? 'Aç (cavablara)' : 'Bağla'}</button>}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <LoadMore onClick={list.more} loading={list.moreLoading} hasMore={list.hasMore} />
      <ModDialog mod={mod} onClose={() => setMod(null)} onDone={(m) => { setMod(null); onFlash(m); list.reload(); }} />
    </div>
  );
}

function RepliesPanel({ initial, onFlash }) {
  const [f, setF] = useState(initial);
  const [mod, setMod] = useState(null);
  const [topics, setTopics] = useState({});
  const key = `${f.q}|${f.status}`;

  const list = usePaged((from, to) => {
    let q = supabase.from('forum_replies').select('id, topic_id, parent_id, author_id, body, status, created_at, edited_at', from === 0 ? { count: 'exact' } : undefined);
    if (f.status) q = q.eq('status', f.status);
    const t = searchTerm(f.q);
    if (t) q = q.ilike('body', `%${t}%`);
    return q.order('created_at', { ascending: false }).range(from, to);
  }, PAGE, key);

  const profiles = useProfileMap(list.rows.map((r) => r.author_id));
  const topicKey = [...new Set(list.rows.map((r) => r.topic_id))].sort().join(',');
  useEffect(() => {
    const ids = topicKey ? topicKey.split(',') : [];
    if (!ids.length) return;
    supabase.from('forum_topics').select('id, title, status').in('id', ids).then(({ data }) => {
      const m = {};
      (data || []).forEach((t) => { m[t.id] = t; });
      setTopics((p) => ({ ...p, ...m }));
    });
  }, [topicKey]);

  const ask = (r, action) => setMod({ scope: 'reply', id: r.id, action, label: r.body.slice(0, 60) });

  function apply(next) {
    const n = { ...f, ...next };
    setF(n);
    const sp = new URLSearchParams({ view: 'replies' });
    if (n.q) sp.set('q', n.q);
    if (n.status) sp.set('status', n.status);
    window.history.replaceState(null, '', `/admin/forum?${sp.toString()}`);
  }

  return (
    <div>
      <FilterForm f={{ ...f, cat: '' }} onApply={apply} label="Cavab axtarışı" placeholder="Cavab mətnində axtarın..." />
      <p className="mb-3 text-xs text-muted" aria-live="polite">{list.loading ? 'Yüklənir…' : `${list.total} cavab`}</p>
      {list.error && <Alert type="error" className="mb-4">{list.error}</Alert>}
      {list.loading ? <ListSkeleton count={4} /> : list.rows.length === 0 && !list.error ? (
        <EmptyState icon="message" title="Cavab tapılmadı" text="Axtarışı və ya filtrləri dəyişin." />
      ) : list.rows.length > 0 && (
        <Table label="Forum cavabları" head={['Cavab', 'Müəllif', 'Mövzu', 'Tarix', 'Vəziyyət', 'Əməliyyatlar']}>
          {list.rows.map((r) => (
            <tr key={r.id} data-testid="reply-row">
              <Td className="max-w-xs"><p className="line-clamp-3 whitespace-pre-wrap break-words">{r.body}</p></Td>
              <Td><AuthorLine id={r.author_id} profile={profiles[r.author_id]} /></Td>
              <Td className="max-w-[14rem]">
                <Link href={`/forum/${r.topic_id}`} className="break-words text-primary hover:underline">{topics[r.topic_id]?.title || 'Mövzuya keç'}</Link>
              </Td>
              <Td className="whitespace-nowrap text-muted">{fmtDateTime(r.created_at)}</Td>
              <Td><StatusBadge status={r.status} /></Td>
              <Td>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {r.status === 'active' && <button className="btn btn-secondary btn-sm" onClick={() => ask(r, 'hide')}>Gizlət</button>}
                  {r.status !== 'active' && <button className="btn btn-secondary btn-sm" onClick={() => ask(r, 'restore')}>Bərpa et</button>}
                  {r.status !== 'deleted' && <button className="btn btn-danger btn-sm" onClick={() => ask(r, 'delete')}>Sil</button>}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <LoadMore onClick={list.more} loading={list.moreLoading} hasMore={list.hasMore} />
      <ModDialog mod={mod} onClose={() => setMod(null)} onDone={(m) => { setMod(null); onFlash(m); list.reload(); }} />
    </div>
  );
}

// Forum moderasiyası: bütün mövzular və cavablar (gizli və silinmişlər də). Əməliyyatlar admin RPC-ləri ilə gedir və audit jurnalına yazılır.
export default function AdminForumPage() {
  const [init, setInit] = useState(null);
  const [cats, setCats] = useState([]);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const status = STATUS_KEYS.includes(sp.get('status')) ? sp.get('status') : '';
    setInit({ view: sp.get('view') === 'replies' ? 'replies' : 'topics', q: (sp.get('q') || '').slice(0, 60), status, cat: '' });
    loadCategories().then(setCats);
  }, []);

  const [view, setView] = useState(null);
  const current = view || init?.view;

  function switchView(v) {
    setView(v);
    setFlash('');
    window.history.replaceState(null, '', `/admin/forum?view=${v}`);
  }

  return (
    <div>
      <PageHeader title="Forum moderasiyası" subtitle="Bütün mövzular və cavablar. Gizlətmə və silmə yumşaqdır: tarixçə saxlanılır, istənilən vaxt bərpa edilə bilər." />
      <div className="mb-4 inline-grid grid-cols-2 gap-1 rounded-lg bg-surface p-1 shadow-card ring-1 ring-line" role="tablist" aria-label="Forum bölmələri">
        {[['topics', 'Mövzular'], ['replies', 'Cavablar']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={current === k} onClick={() => switchView(k)}
            className={`h-9 rounded-md px-5 text-sm font-semibold transition-colors ${current === k ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}>{l}</button>
        ))}
      </div>
      {flash && <Alert type="success" className="mb-4">{flash}</Alert>}
      {!init ? <ListSkeleton count={3} /> : current === 'replies'
        ? <RepliesPanel key="replies" initial={{ ...init, cat: '' }} onFlash={setFlash} />
        : <TopicsPanel key="topics" initial={init} cats={cats} onFlash={setFlash} />}
    </div>
  );
}
