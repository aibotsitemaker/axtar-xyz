'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import AdSlot from '../../components/AdSlot';

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
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

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
    if (b.seller_id === user.id) return setMsg('Bu sizin öz elanınızdır.');
    supabase.rpc('increment_book_view', { p_book_id: b.id });
    const { data, error } = await supabase.rpc('get_or_create_conversation', { p_other_user: b.seller_id, p_book_id: b.id });
    if (error) return setMsg(error.message);
    router.push(`/chat?c=${data}`);
  }

  function openWhatsApp(b) {
    supabase.rpc('increment_book_view', { p_book_id: b.id });
    let num = (b.whatsapp || '').replace(/\D/g, '');
    if (num.startsWith('0')) num = '994' + num.slice(1);
    if (num.length === 9) num = '994' + num;
    const text = encodeURIComponent(`Salam, "${b.title}" elanınız barədə yazıram.`);
    window.open(`https://wa.me/${num}?text=${text}`, '_blank');
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      let urls = [];
      if (file) {
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
      setMsg('Elanınız uğurla əlavə olundu.');
      load();
    } catch (err) {
      setMsg(err.message || 'Xəta baş verdi.');
    } finally {
      setSaving(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kitab Bazarı</h1>
          <p className="text-sm text-slate-500">İkinci əl dərslik və kitablar</p>
        </div>
        <button className="btn btn-primary" onClick={() => (user ? setOpen(!open) : router.push('/auth'))}>
          {open ? 'Bağla' : '+ Elan ver'}
        </button>
      </div>

      {msg && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{msg}</div>}

      {open && (
        <form onSubmit={submit} className="card mb-6 grid gap-4 p-5 md:grid-cols-2">
          <div className="md:col-span-2"><label className="label">Başlıq</label>
            <input className="input" required minLength={3} value={form.title} onChange={set('title')} /></div>
          <div><label className="label">Müəllif</label><input className="input" value={form.author} onChange={set('author')} /></div>
          <div><label className="label">Qiymət (AZN)</label>
            <input type="number" min="0" step="0.5" className="input" required value={form.price} onChange={set('price')} /></div>
          <div><label className="label">Kateqoriya</label>
            <select className="input" value={form.category} onChange={set('category')}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Vəziyyət</label>
            <select className="input" value={form.condition} onChange={set('condition')}>{CONDS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label">Şəhər</label><input className="input" required value={form.city} onChange={set('city')} /></div>
          <div><label className="label">Metro</label><input className="input" value={form.metro} onChange={set('metro')} placeholder="28 May" /></div>
          <div><label className="label">WhatsApp nömrəsi</label>
            <input className="input" value={form.whatsapp} onChange={set('whatsapp')} placeholder="0501234567" /></div>
          <div><label className="label">Şəkil</label>
            <input type="file" accept="image/*" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <div className="md:col-span-2"><label className="label">Təsvir</label>
            <textarea rows={3} className="input" value={form.description} onChange={set('description')} /></div>
          <div className="md:col-span-2"><button disabled={saving} className="btn btn-primary">{saving ? 'Yüklənir...' : 'Elanı dərc et'}</button></div>
        </form>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <input className="input" placeholder="Kitab axtar..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Bütün kateqoriyalar</option>{CATS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input className="input" placeholder="Şəhər" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>

      {loading ? <p className="py-16 text-center text-slate-400">Yüklənir...</p>
        : books.length === 0 ? <p className="py-16 text-center text-slate-400">Elan tapılmadı.</p>
        : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((b, i) => (
            <div key={b.id} className="contents">
              <article className="card overflow-hidden">
                <div className="relative aspect-[4/3] bg-slate-100">
                  {b.image_urls?.[0]
                    ? <img src={b.image_urls[0]} alt={b.title} className="h-full w-full object-cover" loading="lazy" />
                    : <div className="grid h-full place-items-center text-4xl">📖</div>}
                  <button onClick={() => toggleFav(b.id)} aria-label="Favori"
                    className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-lg shadow">
                    {favs.has(b.id) ? '❤️' : '🤍'}
                  </button>
                </div>
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2"><span className="chip">{b.category}</span><span className="text-xs text-slate-400">{b.condition}</span></div>
                  <h3 className="line-clamp-2 font-semibold">{b.title}</h3>
                  {b.author && <p className="text-sm text-slate-500">{b.author}</p>}
                  <p className="mt-1 text-xs text-slate-400">📍 {b.city}{b.metro ? ` · ${b.metro}` : ''} · 👁 {b.view_count}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xl font-bold text-brand">{Number(b.price).toFixed(2)} ₼</span>
                    <span className="text-xs text-slate-400">{b.profiles?.full_name}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => openChat(b)} className="btn btn-primary !py-2">💬 Çat</button>
                    <button onClick={() => openWhatsApp(b)} disabled={!b.whatsapp} className="btn btn-ghost !py-2">WhatsApp</button>
                  </div>
                </div>
              </article>
              {(i + 1) % 6 === 0 && <div className="col-span-full"><AdSlot /></div>}
            </div>
          ))}
        </div>
      )}
      <AdSlot />
    </div>
  );
}
