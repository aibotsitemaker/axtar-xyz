'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import Icon from '../../components/Icons';
import AuthorLine from '../../components/forum/AuthorLine';
import { Alert, EmptyState, ListSkeleton, LoadMore, PageHeader } from '../../components/ui';
import { PAGE_SIZE, TOPIC_COLS, loadCategories, loadProfiles, searchTerm } from '../../lib/forum';
import { fmtDate, timeAgo } from '../../lib/format';

const SORTS = [['activity', 'Son aktiv'], ['replies', 'Ən çox cavab alan'], ['new', 'Yeni mövzular']];
const SORT_KEYS = SORTS.map((s) => s[0]);

function TopicRow({ t, cat, author, lastAuthor }) {
  return (
    <article className="card p-4 transition-shadow hover:shadow-pop sm:p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            {t.is_pinned && <span className="badge"><Icon name="pushpin" className="h-3 w-3" />Sabit</span>}
            {t.is_locked && <span className="badge badge-muted"><Icon name="lock" className="h-3 w-3" />Bağlı</span>}
            {cat && <span className="badge badge-muted">{cat.name}</span>}
          </div>
          <h2 className="text-base font-semibold leading-snug sm:text-lg">
            <Link href={`/forum/${t.id}`} className="hover:text-primary hover:underline">{t.title}</Link>
          </h2>
          {t.excerpt && <p className="mt-1 line-clamp-2 break-words text-sm text-muted">{t.excerpt}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
            <AuthorLine id={t.author_id} profile={author} />
            <span>{fmtDate(t.created_at)}</span>
            <span className="inline-flex items-center gap-1"><Icon name="clock" className="h-3.5 w-3.5" />Son aktivlik: {timeAgo(t.last_activity_at)}</span>
            {t.reply_count > 0 && t.last_reply_author_id && (
              <span>Son cavab: <span className="font-medium text-ink">{lastAuthor?.full_name || 'İstifadəçi'}</span></span>
            )}
          </div>
        </div>
        <div className="shrink-0 rounded-lg bg-canvas px-3 py-2 text-center" aria-label={`${t.reply_count} cavab`}>
          <div className="text-lg font-bold leading-none text-ink">{t.reply_count}</div>
          <div className="mt-1 text-[11px] text-muted">cavab</div>
        </div>
      </div>
    </article>
  );
}

function buildQuery(f, from, to) {
  let q = supabase.from('forum_topics').select(TOPIC_COLS, from === 0 ? { count: 'exact' } : undefined).eq('status', 'active');
  if (f.cat) q = q.eq('category_id', f.cat);
  const term = searchTerm(f.q);
  if (term) q = q.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`);
  q = q.order('is_pinned', { ascending: false });
  if (f.sort === 'replies') q = q.order('reply_count', { ascending: false }).order('last_activity_at', { ascending: false });
  else if (f.sort === 'new') q = q.order('created_at', { ascending: false });
  else q = q.order('last_activity_at', { ascending: false });
  return q.range(from, to);
}

export default function ForumPage() {
  const { user } = useAuth();
  const [cats, setCats] = useState([]);
  const [catsReady, setCatsReady] = useState(false);
  const [filters, setFilters] = useState(null); // { q, cat, sort }
  const [draft, setDraft] = useState('');
  const [rows, setRows] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let stop = false;
    loadCategories().then((c) => { if (!stop) { setCats(c); setCatsReady(true); } });
    return () => { stop = true; };
  }, []);

  // Başlanğıc filtrlər ünvandan oxunur (?category=slug&q=...&sort=...)
  useEffect(() => {
    if (!catsReady || filters) return;
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get('category');
    const c = cats.find((x) => x.slug === slug);
    const sort = SORT_KEYS.includes(sp.get('sort')) ? sp.get('sort') : 'activity';
    const q = (sp.get('q') || '').slice(0, 60);
    setDraft(q);
    setFilters({ q, cat: c ? c.id : '', sort });
  }, [catsReady, cats, filters]);

  const attach = useCallback(async (list) => {
    const ids = list.flatMap((t) => [t.author_id, t.last_reply_author_id]);
    const map = await loadProfiles(ids);
    setProfiles((p) => ({ ...p, ...map }));
  }, []);

  useEffect(() => {
    if (!filters) return undefined;
    let stop = false;
    setLoading(true);
    setError('');
    buildQuery(filters, 0, PAGE_SIZE - 1).then(async ({ data, error: err, count }) => {
      if (stop) return;
      if (err) { setError('Mövzuları yükləmək mümkün olmadı. Bir az sonra yenidən cəhd edin.'); setRows([]); setTotal(0); setLoading(false); return; }
      setRows(data || []);
      setTotal(count ?? (data || []).length);
      await attach(data || []);
      if (!stop) setLoading(false);
    });
    return () => { stop = true; };
  }, [filters, attach]);

  function update(next) {
    const f = { ...filters, ...next };
    setFilters(f);
    const sp = new URLSearchParams();
    const c = cats.find((x) => x.id === f.cat);
    if (c) sp.set('category', c.slug);
    if (f.q) sp.set('q', f.q);
    if (f.sort !== 'activity') sp.set('sort', f.sort);
    const qs = sp.toString();
    window.history.replaceState(null, '', qs ? `/forum?${qs}` : '/forum');
  }

  async function more() {
    setMoreLoading(true);
    const { data, error: err } = await buildQuery(filters, rows.length, rows.length + PAGE_SIZE - 1);
    if (err) { setError('Daha çox mövzu yüklənmədi.'); setMoreLoading(false); return; }
    // təkrarlanan sətirlər (yeni mövzu gələndə sürüşmə) süzülür
    const seen = new Set(rows.map((r) => r.id));
    const add = (data || []).filter((r) => !seen.has(r.id));
    setRows((r) => [...r, ...add]);
    await attach(add);
    setMoreLoading(false);
  }

  const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));
  const hasFilter = filters && (filters.q || filters.cat);
  const newHref = user ? '/forum/new' : '/auth?next=/forum/new';

  return (
    <div>
      <PageHeader title="Forum" subtitle="Suallar verin, təcrübə bölüşün, digər istifadəçilərlə müzakirə edin."
        action={<Link href={newHref} className="btn btn-primary"><Icon name="plus" className="h-4 w-4" />Yeni mövzu yarat</Link>} />

      <form role="search" aria-label="Forumda axtarış" className="card mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]"
        onSubmit={(e) => { e.preventDefault(); if (filters) update({ q: searchTerm(draft) }); }}>
        <div className="relative">
          <label htmlFor="forum-q" className="sr-only">Axtarış</label>
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input id="forum-q" type="search" className="input pl-9" placeholder="Mövzu axtarın..." maxLength={60} value={draft} onChange={(e) => setDraft(e.target.value)} />
        </div>
        <div>
          <label htmlFor="forum-cat" className="sr-only">Kateqoriya</label>
          <select id="forum-cat" className="input" value={filters?.cat || ''} disabled={!filters} onChange={(e) => update({ cat: e.target.value })}>
            <option value="">Bütün kateqoriyalar</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active ? '' : ' (arxiv)'}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="forum-sort" className="sr-only">Çeşidləmə</label>
          <select id="forum-sort" className="input" value={filters?.sort || 'activity'} disabled={!filters} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between gap-3 sm:col-span-3">
          <p className="text-xs text-muted" aria-live="polite">{loading ? 'Yüklənir…' : `${total} mövzu`}</p>
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm">Axtar</button>
            {hasFilter && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setDraft(''); update({ q: '', cat: '' }); }}>Filtrləri təmizlə</button>
            )}
          </div>
        </div>
      </form>

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      {loading ? <ListSkeleton /> : rows.length === 0 && !error ? (
        <EmptyState icon="chat" title={hasFilter ? 'Heç nə tapılmadı' : 'Hələ mövzu yoxdur'}
          text={hasFilter ? 'Axtarış sözünü və ya kateqoriyanı dəyişin.' : 'İlk mövzunu siz yaradın və müzakirəni başladın.'}
          action={<Link href={newHref} className="btn btn-primary">Yeni mövzu yarat</Link>} />
      ) : (
        <div className="space-y-3">
          {rows.map((t) => (
            <TopicRow key={t.id} t={t} cat={catMap[t.category_id]} author={profiles[t.author_id]} lastAuthor={profiles[t.last_reply_author_id]} />
          ))}
        </div>
      )}
      <LoadMore onClick={more} loading={moreLoading} hasMore={!loading && rows.length < total} />
    </div>
  );
}
