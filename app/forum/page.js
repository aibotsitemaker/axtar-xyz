'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import { Alert, PageHeader } from '../../components/ui';

const labels = { teacher: 'Müəllim', student: 'Şagird', university_student: 'Tələbə' };

export default function ForumPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [topics, setTopics] = useState([]);
  const [categories, setCategories] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [counts, setCounts] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('recent');
  const [search, setSearch] = useState('');
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    const [c, t] = await Promise.all([
      supabase.from('forum_categories').select('id,name,slug').eq('is_active', true).order('name'),
      supabase.rpc('forum_search_topics', { p_query: search || null, p_category_id: category ? Number(category) : null, p_sort: sort, p_offset: 0, p_limit: more ? 60 : 30 })
    ]);
    if (c.error || t.error) { setNotice({ type: 'error', text: 'Forum məlumatları yüklənmədi. Miqrasiyanın tətbiq olunduğunu yoxlayın.' }); return; }
    const rows = t.data || [];
    setCategories(c.data || []); setTopics(rows);
    const statsResult = rows.length ? await supabase.rpc('forum_topic_stats', { p_topic_ids: rows.map((x) => x.id) }) : { data: [] };
    const stats = Object.fromEntries((statsResult.data || []).map((x) => [x.topic_id, { count: Number(x.reply_count), last: x.last_author_id }]));
    setCounts(Object.fromEntries(rows.map((topic) => [topic.id, stats[topic.id] || { count: 0, last: null }])));
    const ids = [...new Set([...rows.map((x) => x.author_id), ...Object.values(stats).map((x) => x.last)].filter(Boolean))];
    if (ids.length) { const p = await supabase.from('profiles').select('id,full_name,user_type').in('id', ids); setProfiles(Object.fromEntries((p.data || []).map((x) => [x.id, x]))); }
    if (user) {
      const n = await supabase.from('forum_notifications').select('id,topic_id,created_at').eq('user_id', user.id).eq('is_read', false).order('created_at', { ascending: false }).limit(10);
      setNotifications(n.data || []);
    } else setNotifications([]);
  }, [more, user, search, category, sort]);

  useEffect(() => { const timer = setTimeout(() => load(), 0); return () => clearTimeout(timer); }, [load]);

  const visible = topics;

  async function createTopic(e) {
    e.preventDefault(); setNotice({ type: '', text: '' });
    if (busy) return;
    if (!user) { router.push('/auth'); return; }
    setBusy(true);
    const { error } = await supabase.from('forum_topics').insert({ author_id: user.id, category_id: Number(categoryId), title: title.trim(), body: body.trim() });
    setBusy(false);
    if (error) { setNotice({ type: 'error', text: error.message || 'Mövzu yaradılmadı.' }); return; }
    setTitle(''); setBody(''); setCategoryId(''); setOpen(false); setNotice({ type: 'success', text: 'Mövzu yaradıldı.' }); await load();
  }
  async function markNotificationsRead() {
    if (!user || !notifications.length) return;
    const { error } = await supabase.from('forum_notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    if (error) setNotice({ type: 'error', text: error.message }); else setNotifications([]);
  }

  if (loading) return <div className="skeleton h-64" aria-busy="true" />;
  return <div>
    <PageHeader title="Forum" subtitle="Mövzu açın, təcrübə bölüşün və suallara birlikdə cavab tapın." />
    {notice.text && <Alert type={notice.type}>{notice.text}</Alert>}
    {notifications.length > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary-soft p-3 text-sm"><span>Sizə yeni cavablarla bağlı {notifications.length} bildiriş var.</span><button className="text-xs font-semibold text-primary underline" onClick={markNotificationsRead}>Oxunmuş kimi işarələ</button></div>}
    <div className="card mt-5 flex flex-col gap-3 p-4 sm:flex-row">
      <input aria-label="Forumda axtar" className="input flex-1" placeholder="Mövzularda axtar..." value={search} onChange={(e) => setSearch(e.target.value)} />
      <select aria-label="Kateqoriya" className="input sm:max-w-56" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Bütün kateqoriyalar</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select aria-label="Sıralama" className="input sm:max-w-48" value={sort} onChange={(e) => setSort(e.target.value)}><option value="recent">Son aktiv</option><option value="replies">Ən çox cavab</option><option value="new">Ən yeni</option></select>
      <button className="btn btn-primary shrink-0" onClick={() => user ? setOpen(!open) : router.push('/auth')}>{open ? 'Bağla' : '+ Yeni mövzu'}</button>
    </div>
    {open && <form onSubmit={createTopic} className="card mt-4 space-y-3 p-4 sm:p-5">
      <h2 className="font-semibold">Yeni müzakirə</h2>
      <label className="block"><span className="label">Başlıq</span><input className="input" required minLength={8} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="block"><span className="label">Kateqoriya</span><select className="input" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Seçin</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="block"><span className="label">Mətn</span><textarea className="input min-h-32" required minLength={10} maxLength={12000} value={body} onChange={(e) => setBody(e.target.value)} /></label>
      <p className="text-xs text-muted">Maksimum 12 000 simvol. HTML və skript kimi deyil, adi mətn kimi göstərilir.</p>
      <button disabled={busy} className="btn btn-primary">{busy ? 'Yaradılır…' : 'Mövzunu dərc et'}</button>
    </form>}
    <div className="mt-5 space-y-3">
      {!visible.length && <div className="card p-10 text-center text-sm text-muted">{topics.length ? 'Axtarışa uyğun mövzu tapılmadı.' : 'Hələ mövzu yoxdur. İlk müzakirəni siz başladın.'}</div>}
      {visible.map((t) => {
        const owner = profiles[t.author_id]; const info = counts[t.id] || { count: 0, last: null };
        return <article key={t.id} className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap gap-2">{t.is_pinned && <span className="badge bg-primary-soft text-primary">Sabitlənib</span>}<span className="badge bg-canvas text-muted">{categories.find((c) => c.id === t.category_id)?.name || 'Kateqoriya'}</span>{t.is_locked && <span className="badge bg-canvas text-muted">Bağlıdır</span>}</div>
              <Link href={`/forum/${t.id}`} className="text-lg font-semibold hover:text-primary">{t.title}</Link><p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-muted">{t.body}</p>
            </div><div className="shrink-0 text-right text-xs text-muted">{info.count} cavab{info.count === 1 ? '' : ''}</div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-muted">
            <span>{owner?.full_name || 'İstifadəçi'} {owner?.user_type && <span className="ml-1 rounded-full bg-primary-soft px-2 py-0.5 text-primary">{labels[owner.user_type]}</span>}</span>
            <time dateTime={t.created_at}>{new Date(t.created_at).toLocaleDateString('az-AZ')}</time>
            {info.last && <span>Son cavab: {profiles[info.last]?.full_name || 'İstifadəçi'}</span>}
            <Link className="ml-auto font-medium text-primary hover:underline" href={`/forum/${t.id}`}>Müzakirəyə keç →</Link>
          </div>
        </article>;
      })}
    </div>
    {!more && topics.length >= 30 && <div className="mt-5 text-center"><button className="btn btn-secondary" onClick={() => setMore(true)}>Daha çox yüklə</button></div>}
  </div>;
}
