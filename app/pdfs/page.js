'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import AdSlot from '../../components/AdSlot';
import Icon from '../../components/Icons';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui';
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
  const [fOpen, setFOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

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
    if (!file) return setMsg({ type: 'error', text: 'PDF faylı seçin.' });
    const bad = validateFile(file, ['application/pdf'], 30);
    if (bad) return setMsg({ type: 'error', text: bad });
    setSaving(true);
    setMsg({ type: '', text: '' });
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
      setMsg({ type: 'success', text: 'PDF uğurla yükləndi.' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Xəta baş verdi.' });
    } finally {
      setSaving(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const filtered = Boolean(q.trim() || level || subject.trim() || year);

  return (
    <div>
      <PageHeader title="PDF və konspekt arxivi" subtitle="Pillə, fənn və ilə görə axtarın"
        action={
          <button className="btn btn-primary" onClick={() => (user ? setOpen(!open) : router.push('/auth'))} aria-expanded={open}>
            <Icon name={open ? 'x' : 'upload'} className="h-4 w-4" />{open ? 'Bağla' : 'PDF yüklə'}
          </button>
        } />

      {msg.text && <Alert type={msg.type} className="mb-5">{msg.text}</Alert>}

      {open && (
        <form onSubmit={submit} className="card mb-6 grid gap-4 p-5 sm:p-6 md:grid-cols-2">
          <h2 className="text-lg font-semibold md:col-span-2">Yeni PDF</h2>
          <div className="md:col-span-2"><label htmlFor="p-title" className="label">Başlıq</label>
            <input id="p-title" className="input" required minLength={3} value={form.title} onChange={set('title')} /></div>
          <div><label htmlFor="p-level" className="label">Təhsil pilləsi</label>
            <select id="p-level" className="input" value={form.level} onChange={set('level')}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></div>
          <div><label htmlFor="p-subject" className="label">Fənn</label>
            <input id="p-subject" className="input" required value={form.subject} onChange={set('subject')} placeholder="Riyaziyyat" /></div>
          <div><label htmlFor="p-year" className="label">İl</label>
            <select id="p-year" className="input" value={form.year} onChange={set('year')}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select></div>
          <div><label htmlFor="p-file" className="label">PDF faylı</label>
            <input id="p-file" type="file" accept="application/pdf" className="input h-auto py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <p className="hint">Maksimum 30 MB.</p></div>
          <div className="md:col-span-2"><label htmlFor="p-desc" className="label">Təsvir</label>
            <textarea id="p-desc" rows={2} className="input" value={form.description} onChange={set('description')} /></div>
          <div className="md:col-span-2">
            <p className="mb-3 text-xs text-muted">Yalnız müəllif hüququ sizə məxsus və ya sərbəst yayılan materialları yükləyin.</p>
            <button disabled={saving} className="btn btn-primary">{saving && <Spinner />}Yüklə</button>
          </div>
        </form>
      )}

      <div className="card mb-5 p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input aria-label="Axtar" className="input pl-9" placeholder="Başlıq ilə axtar" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button type="button" className="btn btn-secondary md:hidden" aria-expanded={fOpen} onClick={() => setFOpen(!fOpen)}>
            <Icon name="sliders" className="h-4 w-4" />Filtr
          </button>
        </div>
        <div className={`${fOpen ? 'grid' : 'hidden'} mt-3 grid-cols-1 gap-3 sm:grid-cols-2 md:grid md:grid-cols-4`}>
          <select aria-label="Təhsil pilləsi" className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">Bütün pillələr</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
          <input aria-label="Fənn" className="input" placeholder="Fənn" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <select aria-label="İl" className="input" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Bütün illər</option>{YEARS.map((y) => <option key={y}>{y}</option>)}</select>
          <select aria-label="Sıralama" className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="created_at">Ən yeni</option><option value="view_count">Ən çox baxılan</option><option value="download_count">Ən çox yüklənən</option></select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Yüklənir">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="file" title={filtered ? 'Heç nə tapılmadı' : 'Hələ PDF yoxdur'}
          text={filtered ? 'Axtarış və ya filtrləri dəyişib yenidən cəhd edin.' : 'İlk resursu siz yükləyə bilərsiniz.'}
          action={filtered ? <button className="btn btn-secondary" onClick={() => { setQ(''); setLevel(''); setSubject(''); setYear(''); }}>Filtrləri təmizlə</button>
            : <button className="btn btn-primary" onClick={() => (user ? setOpen(true) : router.push('/auth'))}>PDF yüklə</button>} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">{items.length} resurs</p>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((p) => {
              const fav = favs.has(p.id);
              return (
                <article key={p.id} className="card flex gap-4 p-4 transition-shadow hover:shadow-pop sm:p-5">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon name="file" className="h-6 w-6" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 font-semibold">{p.title}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="badge">{p.level}</span>
                      <span className="text-xs text-muted">{p.subject}{p.year ? ` · ${p.year}` : ''}</span>
                    </div>
                    {p.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{p.description}</p>}
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="inline-flex items-center gap-1"><Icon name="eye" className="h-3.5 w-3.5" />{p.view_count}</span>
                      <span className="inline-flex items-center gap-1"><Icon name="download" className="h-3.5 w-3.5" />{p.download_count}</span>
                      {p.file_size_kb ? <span>{(p.file_size_kb / 1024).toFixed(1)} MB</span> : null}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => view(p)} className="btn btn-secondary btn-sm"><Icon name="eye" className="h-4 w-4" />Bax</button>
                      <button onClick={() => download(p)} className="btn btn-primary btn-sm"><Icon name="download" className="h-4 w-4" />Yüklə</button>
                      <button onClick={() => toggleFav(p.id)} aria-pressed={fav} aria-label={fav ? 'Favorilərdən çıxar' : 'Favorilərə əlavə et'} className="btn btn-secondary btn-sm !px-2.5">
                        <Icon name="heart" filled={fav} className={`h-4 w-4 ${fav ? 'text-danger' : ''}`} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
      <AdSlot />
    </div>
  );
}
