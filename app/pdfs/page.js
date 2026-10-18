'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import AdSlot from '../../components/AdSlot';
import { safeUrl, validateFile } from '../../lib/safe';

const LEVELS = ['Orta məktəb', 'DİM', 'Bakalavr', 'Magistr', 'IELTS', 'Digər'];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 12 }, (_, i) => THIS_YEAR - i);
const EMPTY = { title: '', description: '', level: 'DİM', subject: '', year: String(THIS_YEAR) };

export default function PdfsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [favs, setFavs] = useState(new Set());
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('');
  const [subject, setSubject] = useState('');
  const [year, setYear] = useState('');
  const [sort, setSort] = useState('created_at');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let qb = supabase.from('pdfs').select('*, profiles(full_name)').eq('status', 'active')
      .order(sort, { ascending: false }).limit(80);
    if (level) qb = qb.eq('level', level);
    if (year) qb = qb.eq('year', Number(year));
    if (subject.trim()) qb = qb.ilike('subject', `%${subject.trim()}%`);
    if (q.trim()) qb = qb.ilike('title', `%${q.trim()}%`);
    const { data } = await qb;
    setItems(data || []);
    setLoading(false);
  }, [q, level, subject, year, sort]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  useEffect(() => {
    if (!user) { setFavs(new Set()); return; }
    supabase.from('favorites').select('pdf_id').eq('user_id', user.id).eq('item_type', 'pdf')
      .then(({ data }) => setFavs(new Set((data || []).map((f) => f.pdf_id))));
  }, [user]);

  async function toggleFav(id) {
    if (!user) return router.push('/auth');
    if (favs.has(id)) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('pdf_id', id);
      setFavs((s) => { const n = new Set(s); n.delete(id); return n; });
    } else {
      const { error } = await supabase.from('favorites').insert({ user_id: user.id, item_type: 'pdf', pdf_id: id });
      if (!error) setFavs((s) => new Set(s).add(id));
    }
  }

  function bump(id, field) {
    setItems((list) => list.map((p) => (p.id === id ? { ...p, [field]: p[field] + 1 } : p)));
  }

  function view(p) {
    supabase.rpc('increment_pdf_view', { p_pdf_id: p.id });
    bump(p.id, 'view_count');
    const u = safeUrl(p.file_url);
    if (u) window.open(u, '_blank', 'noopener');
  }

  function download(p) {
    supabase.rpc('increment_pdf_download', { p_pdf_id: p.id });
    bump(p.id, 'download_count');
    const a = document.createElement('a');
    const u = safeUrl(p.file_url);
    if (!u) return;
    a.href = u; a.target = '_blank'; a.rel = 'noopener'; a.download = `${p.title}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function submit(e) {
    e.preventDefault();
    if (!file) return setMsg('PDF faylı seçin.');
    const bad = validateFile(file, ['application/pdf'], 30);
    if (bad) return setMsg(bad);
    setSaving(true);
    setMsg('');
    try {
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const { error: ue } = await supabase.storage.from('pdf-files').upload(path, file);
      if (ue) throw ue;
      const file_url = supabase.storage.from('pdf-files').getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from('pdfs').insert({
        title: form.title, description: form.description, level: form.level, subject: form.subject,
        year: Number(form.year), file_url, file_size_kb: Math.round(file.size / 1024), uploader_id: user.id
      });
      if (error) throw error;
      setForm(EMPTY); setFile(null); setOpen(false);
      setMsg('PDF uğurla yükləndi.');
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
          <h1 className="text-2xl font-bold tracking-tight">PDF & Konspekt Arxivi</h1>
          <p className="text-sm text-slate-500">Pillə, fənn və ilə görə axtar</p>
        </div>
        <button className="btn btn-primary" onClick={() => (user ? setOpen(!open) : router.push('/auth'))}>
          {open ? 'Bağla' : '+ PDF yüklə'}
        </button>
      </div>

      {msg && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{msg}</div>}

      {open && (
        <form onSubmit={submit} className="card mb-6 grid gap-4 p-5 md:grid-cols-2">
          <div className="md:col-span-2"><label className="label">Başlıq</label>
            <input className="input" required minLength={3} value={form.title} onChange={set('title')} /></div>
          <div><label className="label">Təhsil pilləsi</label>
            <select className="input" value={form.level} onChange={set('level')}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></div>
          <div><label className="label">Fənn</label>
            <input className="input" required value={form.subject} onChange={set('subject')} placeholder="Riyaziyyat" /></div>
          <div><label className="label">İl</label>
            <select className="input" value={form.year} onChange={set('year')}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select></div>
          <div><label className="label">PDF faylı (maks. 30 MB)</label>
            <input type="file" accept="application/pdf" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <div className="md:col-span-2"><label className="label">Təsvir</label>
            <textarea rows={2} className="input" value={form.description} onChange={set('description')} /></div>
          <div className="md:col-span-2">
            <p className="mb-3 text-xs text-slate-400">Yalnız müəllif hüququ sizə məxsus və ya sərbəst yayılan materialları yükləyin.</p>
            <button disabled={saving} className="btn btn-primary">{saving ? 'Yüklənir...' : 'Yüklə'}</button>
          </div>
        </form>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input" placeholder="Axtar..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">Bütün pillələr</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
        <input className="input" placeholder="Fənn" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <select className="input" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">Bütün illər</option>{YEARS.map((y) => <option key={y}>{y}</option>)}</select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="created_at">Ən yeni</option><option value="view_count">Ən çox baxılan</option><option value="download_count">Ən çox yüklənən</option></select>
      </div>

      {loading ? <p className="py-16 text-center text-slate-400">Yüklənir...</p>
        : items.length === 0 ? <p className="py-16 text-center text-slate-400">Heç nə tapılmadı.</p>
        : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((p) => (
            <article key={p.id} className="card flex gap-4 p-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-red-50 text-2xl">📕</div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{p.title}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="chip">{p.level}</span>
                  <span className="text-xs text-slate-500">{p.subject}</span>
                  {p.year && <span className="text-xs text-slate-400">{p.year}</span>}
                </div>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.description}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  👁 {p.view_count} · ⬇ {p.download_count}{p.file_size_kb ? ` · ${(p.file_size_kb / 1024).toFixed(1)} MB` : ''}
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => view(p)} className="btn btn-ghost !px-3 !py-1.5">Bax</button>
                  <button onClick={() => download(p)} className="btn btn-primary !px-3 !py-1.5">Yüklə</button>
                  <button onClick={() => toggleFav(p.id)} aria-label="Favori" className="btn btn-ghost !px-3 !py-1.5">{favs.has(p.id) ? '❤️' : '🤍'}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <AdSlot />
    </div>
  );
}
