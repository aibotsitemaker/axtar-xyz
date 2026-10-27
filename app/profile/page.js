'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth, LoginPrompt } from '../../components/AuthProvider';
import Icon from '../../components/Icons';
import { Alert, EmptyState, Modal, Spinner } from '../../components/ui';
import { safeUrl } from '../../lib/safe';

const fmtDate = (d) => new Date(d).toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtSec = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('books');
  const [books, setBooks] = useState([]);
  const [pdfs, setPdfs] = useState([]);
  const [favs, setFavs] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [edit, setEdit] = useState({ full_name: '', city: '', bio: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const [p, b, f, d, a] = await Promise.all([
      supabase.from('profiles').select('id, full_name, username, avatar_url, city, bio, created_at').eq('id', user.id).single(),
      supabase.from('books').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }),
      supabase.from('favorites').select('*, books(*), pdfs(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('pdfs').select('*').eq('uploader_id', user.id).order('created_at', { ascending: false }),
      supabase.from('quiz_attempts').select('id, correct_count, total_questions, score_percent, seconds_used, created_at, quizzes(title)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
    ]);
    if (p.data) { setProfile(p.data); setEdit({ full_name: p.data.full_name || '', city: p.data.city || '', bio: p.data.bio || '' }); }
    setBooks(b.data || []);
    setFavs(f.data || []);
    setPdfs(d.data || []);
    setAttempts(a.data || []);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault();
    const { error } = await supabase.from('profiles').update(edit).eq('id', user.id);
    setMsg(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Profil yeniləndi.' });
    load();
  }

  async function markSold(id) { await supabase.from('books').update({ status: 'sold' }).eq('id', id); load(); }
  async function delBook(id) { if (confirm('Elan silinsin?')) { await supabase.from('books').delete().eq('id', id); load(); } }
  async function delPdf(id) { if (confirm('PDF silinsin?')) { await supabase.from('pdfs').delete().eq('id', id); load(); } }
  async function unfav(id) { await supabase.from('favorites').delete().eq('id', id); load(); }
  async function logout() { await supabase.auth.signOut(); router.push('/'); }

  async function delAccount() {
    setDelErr('');
    setDelBusy(true);
    try {
      for (const bucket of ['book-images', 'pdf-files', 'avatars']) {
        const { data: files } = await supabase.storage.from(bucket).list(user.id);
        if (files && files.length) await supabase.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
      }
    } catch (e) { /* fayl təmizliyi alınmasa da hesab silinməsi davam edir */ }
    const { error } = await supabase.rpc('delete_my_account');
    if (error) { setDelBusy(false); setDelErr(error.message); return; }
    await supabase.auth.signOut({ scope: 'local' });
    router.push('/');
  }

  if (loading) return <div className="space-y-4" aria-busy="true"><div className="skeleton h-24" /><div className="skeleton h-64" /></div>;
  if (!user) return <LoginPrompt text="Kabinetə daxil olmaq üçün giriş edin." />;

  const TABS = [
    ['books', 'Elanlarım', books.length],
    ['pdfs', 'PDF-lərim', pdfs.length],
    ['favs', 'Favorilər', favs.length],
    ['results', 'Sınaq nəticələrim', attempts.length],
    ['settings', 'Profil', null]
  ];
  const name = profile?.full_name || user.email;
  const confirmOk = /^s[iİı]l$/i.test(delText.trim());

  return (
    <div>
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-xl font-bold text-white">{name[0].toUpperCase()}</div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">{profile?.full_name || 'İstifadəçi'}</h1>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/chat" className="btn btn-secondary btn-sm"><Icon name="chat" className="h-4 w-4" />Mesajlar</Link>
          <button onClick={logout} className="btn btn-secondary btn-sm"><Icon name="logout" className="h-4 w-4" />Çıxış</button>
        </div>
      </div>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Kabinet bölmələri">
        {TABS.map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`btn btn-sm shrink-0 ${tab === k ? 'btn-primary' : 'btn-secondary'}`}>
            {l}{n !== null && <span className={`rounded-full px-1.5 text-xs ${tab === k ? 'bg-white/20' : 'bg-canvas text-muted'}`}>{n}</span>}
          </button>
        ))}
      </div>

      {tab === 'books' && (
        <div className="space-y-3">
          {books.length === 0 && <EmptyState icon="book" title="Hələ elanınız yoxdur" action={<Link href="/books" className="btn btn-primary">Elan ver</Link>} />}
          {books.map((b) => (
            <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{b.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                  <span className="font-semibold text-primary">{Number(b.price).toFixed(2)} ₼</span><span>{b.category}</span>
                  <span className="inline-flex items-center gap-1"><Icon name="eye" className="h-3.5 w-3.5" />{b.view_count}</span>
                  <span className={`badge ${b.status === 'active' ? '' : 'badge-muted'}`}>{b.status === 'sold' ? 'Satılıb' : b.status === 'active' ? 'Aktiv' : 'Gizli'}</span>
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {b.status === 'active' && <button onClick={() => markSold(b.id)} className="btn btn-secondary btn-sm">Satıldı</button>}
                <button onClick={() => delBook(b.id)} className="btn btn-danger btn-sm" aria-label={`${b.title} elanını sil`}><Icon name="trash" className="h-4 w-4" />Sil</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'pdfs' && (
        <div className="space-y-3">
          {pdfs.length === 0 && <EmptyState icon="file" title="Hələ PDF yükləməmisiniz" action={<Link href="/pdfs" className="btn btn-primary">PDF yüklə</Link>} />}
          {pdfs.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.title}</p>
                <p className="mt-0.5 text-xs text-muted">{p.level} · {p.subject} · {p.view_count} baxış · {p.download_count} yükləmə</p>
              </div>
              <button onClick={() => delPdf(p.id)} className="btn btn-danger btn-sm" aria-label={`${p.title} PDF-ini sil`}><Icon name="trash" className="h-4 w-4" />Sil</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'favs' && (
        <div className="space-y-3">
          {favs.length === 0 && <EmptyState icon="heart" title="Favori siyahınız boşdur" text="Elan və ya PDF kartındakı ürək işarəsinə klikləyin." />}
          {favs.map((f) => {
            const it = f.item_type === 'book' ? f.books : f.pdfs;
            if (!it) return null;
            return (
              <div key={f.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon name={f.item_type === 'book' ? 'book' : 'file'} className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{it.title}</p>
                    <p className="text-xs text-muted">{f.item_type === 'book' ? `${Number(it.price).toFixed(2)} ₼ · ${it.city}` : `${it.level} · ${it.subject}`}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {f.item_type === 'pdf' && <a href={safeUrl(it.file_url) || '#'} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">Aç</a>}
                  <button onClick={() => unfav(f.id)} className="btn btn-secondary btn-sm" aria-label="Favorilərdən çıxar"><Icon name="heart" filled className="h-4 w-4 text-danger" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'results' && (
        <div className="space-y-3">
          {attempts.length === 0 && <EmptyState icon="quiz" title="Hələ sınaq nəticəniz yoxdur" text="Sınaqdan keçdikdən sonra nəticələr burada görünəcək." action={<Link href="/quizzes" className="btn btn-primary">Sınaqlara keç</Link>} />}
          {attempts.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{a.quizzes?.title || 'Sınaq'}</p>
                <p className="mt-0.5 text-xs text-muted">{fmtDate(a.created_at)} · {a.correct_count}/{a.total_questions} düzgün · {fmtSec(a.seconds_used)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${Number(a.score_percent) >= 70 ? 'bg-success-soft text-success' : Number(a.score_percent) >= 40 ? 'bg-primary-soft text-primary' : 'bg-danger-soft text-danger'}`}>{Math.round(Number(a.score_percent))}%</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'settings' && (
        <div className="max-w-lg space-y-6">
          <form onSubmit={save} className="card space-y-4 p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Profil məlumatları</h2>
            <div><label htmlFor="f-name" className="label">Ad və soyad</label><input id="f-name" className="input" value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></div>
            <div><label htmlFor="f-city" className="label">Şəhər</label><input id="f-city" className="input" value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></div>
            <div><label htmlFor="f-bio" className="label">Haqqında</label><textarea id="f-bio" rows={3} className="input" value={edit.bio} onChange={(e) => setEdit({ ...edit, bio: e.target.value })} /></div>
            {msg.text && <Alert type={msg.type}>{msg.text}</Alert>}
            <button className="btn btn-primary">Yadda saxla</button>
          </form>

          <div className="card border-danger/30 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-danger">Hesabı sil</h2>
            <p className="mt-1 text-sm text-muted">Hesabınız, elanlarınız, PDF-ləriniz, favorilər və mesajlarınız birdəfəlik silinir. Bu əməliyyat geri qaytarıla bilməz.</p>
            <button onClick={() => { setDelOpen(true); setDelText(''); setDelErr(''); }} className="btn btn-danger mt-4"><Icon name="trash" className="h-4 w-4" />Hesabımı sil</button>
          </div>
        </div>
      )}

      <Modal open={delOpen} onClose={() => !delBusy && setDelOpen(false)} title="Hesabı birdəfəlik sil">
        <p className="mt-2 text-sm text-muted">Bütün məlumatlarınız silinəcək və geri qaytarıla bilməyəcək. Təsdiq üçün aşağıya <strong className="text-ink">SİL</strong> yazın.</p>
        <label htmlFor="del-confirm" className="sr-only">Təsdiq sözü</label>
        <input id="del-confirm" className="input mt-4" value={delText} onChange={(e) => setDelText(e.target.value)} autoComplete="off" placeholder="SİL" />
        {delErr && <Alert type="error" className="mt-3">{delErr}</Alert>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-secondary" disabled={delBusy} onClick={() => setDelOpen(false)}>Ləğv et</button>
          <button className="btn bg-danger text-white hover:bg-danger/90" disabled={!confirmOk || delBusy} onClick={delAccount}>{delBusy && <Spinner />}Hesabı sil</button>
        </div>
      </Modal>
    </div>
  );
}
