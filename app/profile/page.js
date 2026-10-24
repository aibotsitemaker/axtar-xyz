'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth, LoginPrompt } from '../../components/AuthProvider';
import { safeUrl } from '../../lib/safe';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('books');
  const [books, setBooks] = useState([]);
  const [pdfs, setPdfs] = useState([]);
  const [favs, setFavs] = useState([]);
  const [edit, setEdit] = useState({ full_name: '', city: '', bio: '' });
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const [p, b, f, d] = await Promise.all([
      supabase.from('profiles').select('id, full_name, username, avatar_url, city, bio, created_at').eq('id', user.id).single(),
      supabase.from('books').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }),
      supabase.from('favorites').select('*, books(*), pdfs(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('pdfs').select('*').eq('uploader_id', user.id).order('created_at', { ascending: false })
    ]);
    if (p.data) { setProfile(p.data); setEdit({ full_name: p.data.full_name || '', city: p.data.city || '', bio: p.data.bio || '' }); }
    setBooks(b.data || []);
    setFavs(f.data || []);
    setPdfs(d.data || []);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault();
    const { error } = await supabase.from('profiles').update(edit).eq('id', user.id);
    setMsg(error ? error.message : 'Profil yeniləndi.');
    load();
  }

  async function markSold(id) { await supabase.from('books').update({ status: 'sold' }).eq('id', id); load(); }
  async function delBook(id) { if (confirm('Elan silinsin?')) { await supabase.from('books').delete().eq('id', id); load(); } }
  async function delPdf(id) { if (confirm('PDF silinsin?')) { await supabase.from('pdfs').delete().eq('id', id); load(); } }
  async function unfav(id) { await supabase.from('favorites').delete().eq('id', id); load(); }
  async function delAccount() {
    const w = window.prompt('Hesab, elanlar, PDF-lər, favorilər və mesajlar birdəfəlik silinəcək. Təsdiq üçün SİL yazın:');
    if (!w || !/^s[iİı]l$/i.test(w.trim())) return;
    try {
      for (const bucket of ['book-images', 'pdf-files', 'avatars']) {
        const { data: files } = await supabase.storage.from(bucket).list(user.id);
        if (files && files.length) await supabase.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
      }
    } catch (e) { /* fayl təmizliyi alınmasa da hesab silinməsi davam edir */ }
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return setMsg(error.message);
    await supabase.auth.signOut({ scope: 'local' });
    router.push('/');
  }
  async function logout() { await supabase.auth.signOut(); router.push('/'); }

  if (loading) return <p className="py-16 text-center text-slate-400">Yüklənir...</p>;
  if (!user) return <LoginPrompt text="Kabinetə daxil olmaq üçün giriş edin." />;

  const TABS = [['books', `Elanlarım (${books.length})`], ['pdfs', `PDF-lərim (${pdfs.length})`], ['favs', `Favorilər (${favs.length})`], ['settings', 'Profil']];

  return (
    <div>
      <div className="card mb-5 flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-brand text-xl font-bold text-white">{(profile?.full_name || user.email)[0].toUpperCase()}</div>
          <div>
            <h1 className="text-lg font-bold">{profile?.full_name || 'İstifadəçi'}</h1>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>
        <button onClick={logout} className="btn btn-ghost">Çıxış</button>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`btn shrink-0 !py-1.5 ${tab === k ? 'btn-primary' : 'btn-ghost'}`}>{l}</button>
        ))}
      </div>

      {tab === 'books' && (
        <div className="space-y-3">
          {books.length === 0 && <p className="py-12 text-center text-slate-400">Hələ elanınız yoxdur.</p>}
          {books.map((b) => (
            <div key={b.id} className="card flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{b.title}</p>
                <p className="text-xs text-slate-400">{Number(b.price).toFixed(2)} ₼ · {b.category} · 👁 {b.view_count} · <span className="font-medium">{b.status === 'sold' ? 'Satılıb' : 'Aktiv'}</span></p>
              </div>
              <div className="flex shrink-0 gap-2">
                {b.status === 'active' && <button onClick={() => markSold(b.id)} className="btn btn-ghost !px-3 !py-1.5">Satıldı</button>}
                <button onClick={() => delBook(b.id)} className="btn btn-danger !px-3 !py-1.5">Sil</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'pdfs' && (
        <div className="space-y-3">
          {pdfs.length === 0 && <p className="py-12 text-center text-slate-400">Hələ PDF yükləməmisiniz.</p>}
          {pdfs.map((p) => (
            <div key={p.id} className="card flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.title}</p>
                <p className="text-xs text-slate-400">{p.level} · {p.subject} · 👁 {p.view_count} · ⬇ {p.download_count}</p>
              </div>
              <button onClick={() => delPdf(p.id)} className="btn btn-danger !px-3 !py-1.5">Sil</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'favs' && (
        <div className="space-y-3">
          {favs.length === 0 && <p className="py-12 text-center text-slate-400">Favori siyahınız boşdur.</p>}
          {favs.map((f) => {
            const it = f.item_type === 'book' ? f.books : f.pdfs;
            if (!it) return null;
            return (
              <div key={f.id} className="card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{f.item_type === 'book' ? '📖' : '📕'} {it.title}</p>
                  <p className="text-xs text-slate-400">{f.item_type === 'book' ? `${Number(it.price).toFixed(2)} ₼ · ${it.city}` : `${it.level} · ${it.subject}`}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {f.item_type === 'pdf' && <a href={safeUrl(it.file_url) || '#'} target="_blank" rel="noopener noreferrer" className="btn btn-ghost !px-3 !py-1.5">Aç</a>}
                  <button onClick={() => unfav(f.id)} className="btn btn-ghost !px-3 !py-1.5">❤️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'settings' && (
        <form onSubmit={save} className="card max-w-lg space-y-4 p-5">
          <div><label className="label">Ad və soyad</label><input className="input" value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></div>
          <div><label className="label">Şəhər</label><input className="input" value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></div>
          <div><label className="label">Haqqında</label><textarea rows={3} className="input" value={edit.bio} onChange={(e) => setEdit({ ...edit, bio: e.target.value })} /></div>
          {msg && <p className="text-sm text-emerald-700">{msg}</p>}
          <button className="btn btn-primary">Yadda saxla</button>
        </form>
      )}

      {tab === 'settings' && (
        <div className="card mt-6 max-w-lg border-red-200 p-5">
          <h2 className="font-semibold text-red-600">Hesabı sil</h2>
          <p className="mt-1 text-sm text-slate-500">Hesabınız, elanlarınız, PDF-ləriniz, favorilər və mesajlarınız birdəfəlik silinir. Bu əməliyyat geri qaytarıla bilməz.</p>
          <button onClick={delAccount} className="btn btn-danger mt-4">Hesabımı birdəfəlik sil</button>
        </div>
      )}
    </div>
  );
}
