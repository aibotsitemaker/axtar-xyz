'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import AdSlot from '../../components/AdSlot';
import Icon from '../../components/Icons';
import { Alert, CardGridSkeleton, EmptyState, PageHeader, Spinner } from '../../components/ui';
import { safeUrl, validateFile } from '../../lib/safe';

const CATS = ['DİM', 'Magistr', 'IELTS', 'Universitet', 'Digər'];
const CONDS = ['Yeni kimi', 'Yaxşı', 'Orta', 'Köhnə'];
const EMPTY = { title: '', author: '', category: 'DİM', condition: 'Yaxşı', price: '', city: 'Bakı', metro: '', whatsapp: '', description: '' };

export default function BooksPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [favs, setFavs] = useState(new Set());
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [city, setCity] = useState('');
  const [fOpen, setFOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    setLoading(true);
    let qb = supabase.from('books').select('*, profiles(full_name)').eq('status', 'active')
      .order('created_at', { ascending: false }).limit(60);
    if (cat) qb = qb.eq('category', cat);
    if (city.trim()) qb = qb.ilike('city', `%${city.trim()}%`);
    if (q.trim()) qb = qb.ilike('title', `%${q.trim()}%`);
    const { data } = await qb;
    setBooks(data || []);
    setLoading(false);
  }, [q, cat, city]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  useEffect(() => {
    if (!user) { setFavs(new Set()); return; }
    supabase.from('favorites').select('book_id').eq('user_id', user.id).eq('item_type', 'book')
      .then(({ data }) => setFavs(new Set((data || []).map((f) => f.book_id))));
  }, [user]);

  async function toggleFav(id) {
    if (!user) return router.push('/auth');
    if (favs.has(id)) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('book_id', id);
      setFavs((s) => { const n = new Set(s); n.delete(id); return n; });
    } else {
      const { error } = await supabase.from('favorites').insert({ user_id: user.id, item_type: 'book', book_id: id });
      if (!error) setFavs((s) => new Set(s).add(id));
    }
  }

  async function openChat(b) {
    if (!user) return router.push('/auth');
    if (b.seller_id === user.id) return setMsg({ type: 'info', text: 'Bu sizin öz elanınızdır.' });
    supabase.rpc('increment_book_view', { p_book_id: b.id });
    const { data, error } = await supabase.rpc('get_or_create_conversation', { p_other_user: b.seller_id, p_book_id: b.id });
    if (error) return setMsg({ type: 'error', text: error.message });
    router.push(`/chat?c=${data}`);
  }

  function openWhatsApp(b) {
    supabase.rpc('increment_book_view', { p_book_id: b.id });
    let num = (b.whatsapp || '').replace(/\D/g, '');
    if (num.startsWith('0')) num = '994' + num.slice(1);
    if (num.length === 9) num = '994' + num;
    const text = encodeURIComponent(`Salam, "${b.title}" elanınız barədə yazıram.`);
    window.open(`https://wa.me/${num}?text=${text}`, '_blank', 'noopener');
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setMsg({ type: '', text: '' });
    try {
      let urls = [];
      if (file) {
        const bad = validateFile(file, ['image/jpeg', 'image/png', 'image/webp'], 5);
        if (bad) throw new Error(bad);
        const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { error: ue } = await supabase.storage.from('book-images').upload(path, file);
        if (ue) throw ue;
        urls = [supabase.storage.from('book-images').getPublicUrl(path).data.publicUrl];
      }
      const { error } = await supabase.from('books').insert({
        ...form, price: Number(form.price), seller_id: user.id, image_urls: urls
      });
      if (error) throw error;
      setForm(EMPTY); setFile(null); setOpen(false);
      setMsg({ type: 'success', text: 'Elanınız uğurla əlavə olundu.' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Xəta baş verdi.' });
    } finally {
      setSaving(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const filtered = Boolean(q.trim() || cat || city.trim());

  return (
    <div>
      <PageHeader title="Kitab elanları" subtitle="İkinci əl dərslik və kitablar"
        action={
          <button className="btn btn-primary" onClick={() => (user ? setOpen(!open) : router.push('/auth'))} aria-expanded={open}>
            <Icon name={open ? 'x' : 'plus'} className="h-4 w-4" />{open ? 'Bağla' : 'Elan ver'}
          </button>
        } />

      {msg.text && <Alert type={msg.type} className="mb-5">{msg.text}</Alert>}

      {open && (
        <form onSubmit={submit} className="card mb-6 grid gap-4 p-5 sm:p-6 md:grid-cols-2">
          <h2 className="text-lg font-semibold md:col-span-2">Yeni elan</h2>
          <div className="md:col-span-2"><label htmlFor="b-title" className="label">Başlıq</label>
            <input id="b-title" className="input" required minLength={3} value={form.title} onChange={set('title')} /></div>
          <div><label htmlFor="b-author" className="label">Müəllif</label><input id="b-author" className="input" value={form.author} onChange={set('author')} /></div>
          <div><label htmlFor="b-price" className="label">Qiymət (AZN)</label>
            <input id="b-price" type="number" min="0" step="0.5" className="input" required value={form.price} onChange={set('price')} /></div>
          <div><label htmlFor="b-cat" className="label">Kateqoriya</label>
            <select id="b-cat" className="input" value={form.category} onChange={set('category')}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label htmlFor="b-cond" className="label">Vəziyyət</label>
            <select id="b-cond" className="input" value={form.condition} onChange={set('condition')}>{CONDS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label htmlFor="b-city" className="label">Şəhər</label><input id="b-city" className="input" required value={form.city} onChange={set('city')} /></div>
          <div><label htmlFor="b-metro" className="label">Metro</label><input id="b-metro" className="input" value={form.metro} onChange={set('metro')} placeholder="28 May" /></div>
          <div><label htmlFor="b-wa" className="label">WhatsApp nömrəsi</label>
            <input id="b-wa" className="input" inputMode="tel" value={form.whatsapp} onChange={set('whatsapp')} placeholder="0501234567" /></div>
          <div><label htmlFor="b-img" className="label">Şəkil</label>
            <input id="b-img" type="file" accept="image/jpeg,image/png,image/webp" className="input h-auto py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <p className="hint">JPG, PNG və ya WebP, maksimum 5 MB.</p></div>
          <div className="md:col-span-2"><label htmlFor="b-desc" className="label">Təsvir</label>
            <textarea id="b-desc" rows={3} className="input" value={form.description} onChange={set('description')} /></div>
          <div className="md:col-span-2"><button disabled={saving} className="btn btn-primary">{saving && <Spinner />}Elanı dərc et</button></div>
        </form>
      )}

      <div className="card mb-5 p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input aria-label="Kitab axtar" className="input pl-9" placeholder="Kitab adı ilə axtar" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button type="button" className="btn btn-secondary md:hidden" aria-expanded={fOpen} onClick={() => setFOpen(!fOpen)}>
            <Icon name="sliders" className="h-4 w-4" />Filtr
          </button>
        </div>
        <div className={`${fOpen ? 'grid' : 'hidden'} mt-3 grid-cols-1 gap-3 sm:grid-cols-2 md:grid`}>
          <select aria-label="Kateqoriya" className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Bütün kateqoriyalar</option>{CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input aria-label="Şəhər" className="input" placeholder="Şəhər" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>

      {loading ? <CardGridSkeleton />
        : books.length === 0 ? (
          <EmptyState icon="book" title={filtered ? 'Heç nə tapılmadı' : 'Hələ elan yoxdur'}
            text={filtered ? 'Axtarış və ya filtrləri dəyişib yenidən cəhd edin.' : 'İlk elanı siz əlavə edə bilərsiniz.'}
            action={filtered ? <button className="btn btn-secondary" onClick={() => { setQ(''); setCat(''); setCity(''); }}>Filtrləri təmizlə</button>
              : <button className="btn btn-primary" onClick={() => (user ? setOpen(true) : router.push('/auth'))}>Elan ver</button>} />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">{books.length} elan</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {books.map((b, i) => {
                const img = safeUrl(b.image_urls?.[0]);
                const fav = favs.has(b.id);
                return (
                  <div key={b.id} className="contents">
                    <article className="card flex flex-col overflow-hidden transition-shadow hover:shadow-pop">
                      <div className="relative aspect-[16/10] bg-canvas sm:aspect-[4/3]">
                        {img
                          ? <img src={img} alt={b.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
                          : <div className="grid h-full place-items-center text-muted/50"><Icon name="image" className="h-10 w-10" /></div>}
                        <button onClick={() => toggleFav(b.id)} aria-pressed={fav} aria-label={fav ? 'Favorilərdən çıxar' : 'Favorilərə əlavə et'}
                          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-surface/95 text-muted shadow-card transition-colors hover:text-danger">
                          <Icon name="heart" filled={fav} className={`h-4 w-4 ${fav ? 'text-danger' : ''}`} />
                        </button>
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <div className="mb-2 flex items-center gap-2"><span className="badge">{b.category}</span><span className="text-xs text-muted">{b.condition}</span></div>
                        <h3 className="line-clamp-2 font-semibold">{b.title}</h3>
                        {b.author && <p className="text-sm text-muted">{b.author}</p>}
                        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <span className="inline-flex items-center gap-1"><Icon name="pin" className="h-3.5 w-3.5" />{b.city}{b.metro ? ` · ${b.metro}` : ''}</span>
                          <span className="inline-flex items-center gap-1"><Icon name="eye" className="h-3.5 w-3.5" />{b.view_count}</span>
                        </p>
                        <div className="mt-auto pt-4">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xl font-bold text-primary">{Number(b.price).toFixed(2)} ₼</span>
                            <span className="truncate text-xs text-muted">{b.profiles?.full_name}</span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button onClick={() => openChat(b)} className="btn btn-primary btn-sm"><Icon name="chat" className="h-4 w-4" />Çat</button>
                            <button onClick={() => openWhatsApp(b)} disabled={!b.whatsapp} className="btn btn-secondary btn-sm">WhatsApp</button>
                          </div>
                        </div>
                      </div>
                    </article>
                    {(i + 1) % 6 === 0 && <div className="col-span-full"><AdSlot className="!my-2" /></div>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      <AdSlot />
    </div>
  );
}
