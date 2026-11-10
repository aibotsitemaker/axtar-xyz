'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth, LoginPrompt } from '../../components/AuthProvider';
import Icon from '../../components/Icons';
import { Alert, EmptyState, Modal, Spinner } from '../../components/ui';
import { safeUrl } from '../../lib/safe';
import AccountBadge from '../../components/AccountBadge';
import AccountTypePicker from '../../components/AccountTypePicker';
import { isAccountType } from '../../lib/roles';
import { errText } from '../../lib/format';

const fmtDate = (d) => new Date(d).toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtSec = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function ProfilePage() {
  const { user, loading, refreshMe } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('books');
  const [books, setBooks] = useState([]);
  const [pdfs, setPdfs] = useState([]);
  const [favs, setFavs] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [verification, setVerification] = useState(null);
  const [verifyForm, setVerifyForm] = useState({ account_kind: 'Müəllim', work_details: '' });
  const [verifyMsg, setVerifyMsg] = useState({ type: '', text: '' });
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [edit, setEdit] = useState({ full_name: '', city: '', bio: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState('');
  const [pickType, setPickType] = useState('');
  const [typeBusy, setTypeBusy] = useState(false);
  const [typeMsg, setTypeMsg] = useState({ type: '', text: '' });
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState({ type: '', text: '' });
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverMsg, setCoverMsg] = useState({ type: '', text: '' });

  const load = useCallback(async () => {
    if (!user) return;
    const [p, b, f, d, a, s, v] = await Promise.all([
      supabase.from('profiles').select('id, full_name, username, avatar_url, cover_url, city, bio, created_at, account_type, is_verified').eq('id', user.id).single(),
      supabase.from('books').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }),
      supabase.from('favorites').select('*, books(*), pdfs(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('pdfs').select('*').eq('uploader_id', user.id).order('created_at', { ascending: false }),
      supabase.from('quiz_attempts').select('id, correct_count, total_questions, score_percent, earned_points, max_points, seconds_used, created_at, quizzes(title)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('saved_content').select('content_type,content_id,created_at').eq('user_id', user.id).order('created_at',{ascending:false}),
      supabase.from('verification_requests').select('id,status,admin_note,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle()
    ]);
    if (p.data) { setProfile(p.data); setEdit({ full_name: p.data.full_name || '', city: p.data.city || '', bio: p.data.bio || '' }); }
    setBooks(b.data || []);
    setFavs(f.data || []);
    setPdfs(d.data || []);
    setAttempts(a.data || []);
    setSavedItems(s.data || []);
    setVerification(v.data || null);
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get('tab');
    if (['books','pdfs','favs','saved','results','settings'].includes(selected)) setTab(selected);
  }, []);

  async function save(e) {
    e.preventDefault();
    const { error } = await supabase.from('profiles').update(edit).eq('id', user.id);
    setMsg(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Profil yeniləndi.' });
    load();
  }

  // Köhnə hesab (tipi hələ seçilməyib): tip YALNIZ BİR DƏFƏ seçilir, serverdə RPC ilə yoxlanılır. Sonra yalnız admin dəyişir.
  async function saveType(e) {
    e.preventDefault();
    setTypeMsg({ type: '', text: '' });
    if (!isAccountType(pickType)) return setTypeMsg({ type: 'error', text: 'Müəllim, şagird və ya tələbə seçin.' });
    setTypeBusy(true);
    const { error } = await supabase.rpc('set_my_account_type', { p_type: pickType });
    setTypeBusy(false);
    if (error) return setTypeMsg({ type: 'error', text: errText(error) });
    setTypeMsg({ type: 'success', text: 'Hesab tipi saxlanıldı.' });
    await load();
    refreshMe();
  }

  async function submitVerification(e) {
    e.preventDefault(); setVerifyMsg({type:'',text:''});
    if ((verifyForm.work_details||'').trim().length<20) { setVerifyMsg({type:'error',text:'Ətraflı məlumat ən azı 20 simvol olmalıdır.'}); return; }
    setVerifyBusy(true);
    const {error}=await supabase.from('verification_requests').insert({user_id:user.id,account_name:profile?.full_name||user.user_metadata?.full_name||'',username:profile?.username||null,account_kind:verifyForm.account_kind,work_details:verifyForm.work_details.trim()});
    setVerifyBusy(false);
    if(error) setVerifyMsg({type:'error',text:error.code==='23505'?'Müraciət artıq mövcuddur.':error.message});
    else { setVerifyMsg({type:'success',text:'Müraciət adminə göndərildi.'}); await load(); }
  }
  async function removeSaved(item) { const {error}=await supabase.rpc('toggle_saved_content',{p_type:item.content_type,p_id:item.content_id}); if(error) setMsg({type:'error',text:error.message}); else setSavedItems(items=>items.filter(x=>x!==item)); }

  async function changeAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const allowed = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    if (!allowed[file.type] || file.size > 2 * 1024 * 1024) {
      setAvatarMsg({ type: 'error', text: 'JPG, PNG və ya WebP şəkli seçin (maksimum 2 MB).' });
      return;
    }
    try {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(file);
        const valid = bitmap.width > 0 && bitmap.height > 0 && bitmap.width <= 6000 && bitmap.height <= 6000;
        bitmap.close();
        if (!valid) throw new Error('Şəkil ölçüsü yanlışdır.');
      }
    } catch {
      setAvatarMsg({ type: 'error', text: 'Fayl etibarlı şəkil kimi oxunmadı.' });
      return;
    }
    setAvatarBusy(true);
    setAvatarMsg({ type: '', text: '' });
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) { setAvatarMsg({ type: 'error', text: 'Şəkil yükləmək üçün yenidən daxil olun.' }); return; }
    const uploadForm = new FormData(); uploadForm.append('file', file);
    const uploadResponse = await fetch('/api/avatar', { method: 'POST', headers: { Authorization: `Bearer ${sessionData.session.access_token}` }, body: uploadForm });
    const uploadData = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) { setAvatarBusy(false); setAvatarMsg({ type: 'error', text: uploadData.error || 'Şəkli yükləmək mümkün olmadı.' }); return; }
    const path = uploadData.path;
    const url = uploadData.publicUrl;
    const storage = supabase.storage.from('avatars');
    const previousPath = (() => {
      const marker = '/storage/v1/object/public/avatars/';
      const oldUrl = profile?.avatar_url || '';
      if (!oldUrl.includes(marker)) return null;
      try {
        const oldPath = decodeURIComponent(oldUrl.split(marker)[1].split('?')[0]);
        return oldPath.startsWith(`${user.id}/`) ? oldPath : null;
      } catch { return null; }
    })();
    const { error: profileError } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
    if (profileError) {
      await storage.remove([path]);
      setAvatarBusy(false);
      setAvatarMsg({ type: 'error', text: errText(profileError, 'Profil şəklini saxlamaq mümkün olmadı.') });
      return;
    }
    if (previousPath) await storage.remove([previousPath]);
    setProfile((old) => ({ ...old, avatar_url: url }));
    setAvatarBusy(false);
    setAvatarMsg({ type: 'success', text: 'Profil şəkli yeniləndi.' });
  }

  async function removeAvatar() {
    if (!profile?.avatar_url || avatarBusy) return;
    setAvatarBusy(true);
    setAvatarMsg({ type: '', text: '' });
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
    if (error) {
      setAvatarBusy(false);
      setAvatarMsg({ type: 'error', text: errText(error, 'Profil şəklini silmək mümkün olmadı.') });
      return;
    }
    const marker = '/storage/v1/object/public/avatars/';
    try {
      const objectPath = decodeURIComponent(profile.avatar_url.split(marker)[1]?.split('?')[0] || '');
      if (objectPath.startsWith(`${user.id}/`)) await supabase.storage.from('avatars').remove([objectPath]);
    } catch { /* Profil dəyəri artıq silinib; köhnə fayl təmizlənməsə də şəkil görünməyəcək. */ }
    setProfile((old) => ({ ...old, avatar_url: null }));
    setAvatarBusy(false);
    setAvatarMsg({ type: 'success', text: 'Profil şəkli silindi.' });
  }

  async function changeCover(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setCoverMsg({type:'error',text:'JPG, PNG və ya WebP şəkli seçin (maksimum 5 MB).'}); return; }
    try { if (typeof createImageBitmap === 'function') { const bitmap = await createImageBitmap(file); const valid = bitmap.width > 0 && bitmap.height > 0 && bitmap.width <= 10000 && bitmap.height <= 10000; bitmap.close(); if (!valid) throw new Error(); } } catch { setCoverMsg({type:'error',text:'Fayl etibarlı şəkil kimi oxunmadı.'}); return; }
    setCoverBusy(true); setCoverMsg({type:'',text:''});
    const {data:sessionData}=await supabase.auth.getSession();
    if (!sessionData.session?.access_token) { setCoverBusy(false); setCoverMsg({type:'error',text:'Şəkil yükləmək üçün yenidən daxil olun.'}); return; }
    const form=new FormData(); form.append('file',file);
    const response=await fetch('/api/profile-cover',{method:'POST',headers:{Authorization:`Bearer ${sessionData.session.access_token}`},body:form});
    const result=await response.json().catch(()=>({}));
    if(!response.ok){setCoverBusy(false);setCoverMsg({type:'error',text:result.error||'Cover şəkli yüklənmədi.'});return;}
    const previousPath=(()=>{const marker='/storage/v1/object/public/profile-covers/';try{const url=profile?.cover_url||'';const path=decodeURIComponent(url.split(marker)[1]?.split('?')[0]||'');return path.startsWith(`${user.id}/`)?path:null;}catch{return null;}})();
    const {error}=await supabase.from('profiles').update({cover_url:result.publicUrl}).eq('id',user.id);
    if(error){await supabase.storage.from('profile-covers').remove([result.path]);setCoverBusy(false);setCoverMsg({type:'error',text:errText(error,'Cover şəkli saxlanmadı.')});return;}
    if(previousPath) await supabase.storage.from('profile-covers').remove([previousPath]);
    setProfile(old=>({...old,cover_url:result.publicUrl}));setCoverBusy(false);setCoverMsg({type:'success',text:'Profil örtük şəkli yeniləndi.'});
  }

  async function removeCover() {
    if(!profile?.cover_url||coverBusy)return;setCoverBusy(true);setCoverMsg({type:'',text:''});
    const {error}=await supabase.from('profiles').update({cover_url:null}).eq('id',user.id);
    if(error){setCoverBusy(false);setCoverMsg({type:'error',text:errText(error,'Cover şəklini silmək mümkün olmadı.')});return;}
    try{const marker='/storage/v1/object/public/profile-covers/';const path=decodeURIComponent(profile.cover_url.split(marker)[1]?.split('?')[0]||'');if(path.startsWith(`${user.id}/`))await supabase.storage.from('profile-covers').remove([path]);}catch{}
    setProfile(old=>({...old,cover_url:null}));setCoverBusy(false);setCoverMsg({type:'success',text:'Profil örtük şəkli silindi.'});
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
      for (const bucket of ['book-images', 'pdf-files', 'avatars', 'profile-covers']) {
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
    ['saved', 'Yadda saxlanılanlar', savedItems.length],
    ['results', 'Sınaq nəticələrim', attempts.length],
    ['settings', 'Profil', null]
  ];
  const name = profile?.full_name || user.email;
  const confirmOk = /^s[iİı]l$/i.test(delText.trim());

  return (
    <div>
      <div className="profile-hero card mb-6 overflow-hidden p-0">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-indigo-100 to-sky-100 sm:h-36">{profile?.cover_url&&<img src={profile.cover_url} alt="Profil örtük şəkli" className="h-full w-full object-cover"/>}</div>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="-mt-12 grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-surface bg-primary text-xl font-bold text-white sm:-mt-14 sm:h-20 sm:w-20">{profile?.avatar_url ? <img src={profile.avatar_url} alt="Profil şəkli" className="h-full w-full object-cover" /> : name[0].toUpperCase()}</div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">{profile?.full_name || 'İstifadəçi'}</h1>
            <p className="truncate text-sm text-muted">{user.email}</p>
          {profile?.is_verified && <p className="mt-1"><span className="verified-mark" aria-label="Doğrulanmış hesab">✓</span> Doğrulanmış hesab</p>}
          {profile?.account_type && <p className="mt-1"><AccountBadge type={profile.account_type} /></p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/forum" className="btn btn-secondary btn-sm"><Icon name="message" className="h-4 w-4" />Forum</Link>
          <Link href="/chat" className="btn btn-secondary btn-sm"><Icon name="chat" className="h-4 w-4" />Mesajlar</Link>
          <button onClick={logout} className="btn btn-secondary btn-sm"><Icon name="logout" className="h-4 w-4" />Çıxış</button>
        </div>
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

      {tab === 'saved' && <div className="space-y-3">{savedItems.length===0?<EmptyState icon="heart" title="Yadda saxlanılan məzmun yoxdur" text="Forum və Feed məzmununu buradan idarə edə bilərsiniz."/>:savedItems.map(item=><div key={`${item.content_type}-${item.content_id}`} className="card flex items-center justify-between gap-3 p-4"><div><span className="badge badge-muted">{item.content_type}</span><p className="text-xs text-muted">Saxlanılıb: {fmtDate(item.created_at)}</p></div><div className="flex gap-2"><Link className="btn btn-secondary btn-sm" href={item.content_type==='forum_topic'?`/forum/${item.content_id}`:item.content_type==='feed_post'?`/feed?post=${item.content_id}`:item.content_type==='teacher_profile'?`/u/${item.content_id}`:item.content_type==='project'?'/projects':item.content_type==='pdf'?'/pdfs':'/books'}>Aç</Link><button onClick={()=>removeSaved(item)} className="btn btn-secondary btn-sm">Siyahıdan sil</button></div></div>)}</div>}

      {tab === 'results' && (
        <div className="space-y-3">
          {attempts.length === 0 && <EmptyState icon="quiz" title="Hələ sınaq nəticəniz yoxdur" text="Sınaqdan keçdikdən sonra nəticələr burada görünəcək." action={<Link href="/quizzes" className="btn btn-primary">Sınaqlara keç</Link>} />}
          {attempts.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{a.quizzes?.title || 'Sınaq'}</p>
                <p className="mt-0.5 text-xs text-muted">{fmtDate(a.created_at)} · {a.correct_count}/{a.total_questions} düzgün · {Number(a.earned_points||0).toFixed(2)}/{Number(a.max_points||a.total_questions||0).toFixed(2)} bal · {fmtSec(a.seconds_used)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${Number(a.score_percent) >= 70 ? 'bg-success-soft text-success' : Number(a.score_percent) >= 40 ? 'bg-primary-soft text-primary' : 'bg-danger-soft text-danger'}`}>{Math.round(Number(a.score_percent))}%</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'settings' && (
        <div className="max-w-lg space-y-6">
          <section className="card space-y-3 p-5 sm:p-6" aria-labelledby="cover-title">
            <h2 id="cover-title" className="text-lg font-semibold">Profil örtük şəkli</h2>
            <div className="relative h-28 overflow-hidden rounded-2xl bg-gradient-to-r from-primary/20 via-indigo-100 to-sky-100 sm:h-40">{profile?.cover_url&&<img src={profile.cover_url} alt="Profil örtük şəkli" className="h-full w-full object-cover"/>}</div>
            <p className="text-sm text-muted">JPG, PNG və WebP · maksimum 5 MB.</p>
            <div className="flex flex-wrap gap-2"><label className="btn btn-secondary cursor-pointer">{coverBusy?<Spinner/>:<Icon name="upload" className="h-4 w-4"/>}Şəkil seç<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={coverBusy} onChange={changeCover}/></label>{profile?.cover_url&&<button type="button" className="btn btn-danger" disabled={coverBusy} onClick={removeCover}>Şəkli sil</button>}</div>
            {coverMsg.text&&<Alert type={coverMsg.type}>{coverMsg.text}</Alert>}
          </section>
          <section className="card space-y-3 p-5 sm:p-6" aria-labelledby="avatar-title">
            <h2 id="avatar-title" className="text-lg font-semibold">Profil şəkli</h2>
            <p className="text-sm text-muted">JPG, PNG və WebP qəbul edilir. Maksimum ölçü 2 MB-dır.</p>
            <div className="flex flex-wrap gap-2">
              <label className="btn btn-secondary cursor-pointer">{avatarBusy ? <Spinner /> : <Icon name="upload" className="h-4 w-4" />}Şəkil seç<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={avatarBusy} onChange={changeAvatar} /></label>
              {profile?.avatar_url && <button type="button" className="btn btn-danger" disabled={avatarBusy} onClick={removeAvatar}>Şəkli sil</button>}
            </div>
            {avatarMsg.text && <Alert type={avatarMsg.type}>{avatarMsg.text}</Alert>}
          </section>
          <form onSubmit={save} className="card space-y-4 p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Profil məlumatları</h2>
            <div><label htmlFor="f-name" className="label">Ad və soyad</label><input id="f-name" className="input" value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></div>
            <div><label htmlFor="f-city" className="label">Şəhər</label><input id="f-city" className="input" value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></div>
            <div><label htmlFor="f-bio" className="label">Haqqında</label><textarea id="f-bio" rows={3} className="input" value={edit.bio} onChange={(e) => setEdit({ ...edit, bio: e.target.value })} /></div>
            {msg.text && <Alert type={msg.type}>{msg.text}</Alert>}
            <button className="btn btn-primary">Yadda saxla</button>
          </form>

          {profile && !profile.account_type && (
            <form onSubmit={saveType} className="card space-y-4 p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Hesab tipini seçin</h2>
              <p className="text-sm text-muted">Hesabınızın tipi hələ seçilməyib. Seçim forumda adınızın yanında göstəriləcək. Bunu yalnız bir dəfə edə bilərsiniz; sonradan dəyişmək üçün administrasiyaya müraciət edin.</p>
              <AccountTypePicker value={pickType} onChange={setPickType} name="profile_account_type" />
              {typeMsg.text && <Alert type={typeMsg.type}>{typeMsg.text}</Alert>}
              <button className="btn btn-primary" disabled={typeBusy}>{typeBusy && <Spinner />}Seçimi saxla</button>
            </form>
          )}
          {profile?.account_type && (
            <div className="card p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Hesab tipi</h2>
              <p className="mt-2"><AccountBadge type={profile.account_type} /></p>
              <p className="mt-2 text-xs text-muted">Hesab tipi təhlükəsizlik üçün özbaşına dəyişdirilmir. Dəyişiklik lazımdırsa, administrasiyaya müraciət edin.</p>
            </div>
          )}

          <section className="card space-y-4 p-5 sm:p-6" aria-labelledby="verification-heading">
            <h2 id="verification-heading" className="text-lg font-semibold">Doğrulanmış hesab</h2>
            {profile?.is_verified&&<Alert type="success">Hesabınız TəhsilHub tərəfindən doğrulanıb.</Alert>}
            {verification&&<div className="rounded-lg bg-canvas p-3 text-sm">Müraciət statusu: <strong>{({pending:'Baxılır',approved:'Təsdiqlənib',rejected:'Rədd edilib',more_info:'Əlavə məlumat tələb olunur',revoked:'Ləğv edilib'})[verification.status]||verification.status}</strong>{verification.admin_note&&<p className="mt-1 text-muted">{verification.admin_note}</p>}</div>}
            {(!verification||['rejected','more_info','revoked'].includes(verification.status))&&<form onSubmit={submitVerification} className="space-y-3"><div><label className="label" htmlFor="verify-kind">Hesabın növü</label><input id="verify-kind" className="input" maxLength={80} value={verifyForm.account_kind} onChange={e=>setVerifyForm(v=>({...v,account_kind:e.target.value}))}/></div><div><label className="label" htmlFor="verify-details">Fəaliyyətiniz və doğrulama səbəbi</label><textarea id="verify-details" className="input w-full" rows={4} maxLength={2000} value={verifyForm.work_details} onChange={e=>setVerifyForm(v=>({...v,work_details:e.target.value}))} placeholder="İş təcrübəniz, müəssisə və ya fəaliyyət sahəniz…"/></div>{verifyMsg.text&&<Alert type={verifyMsg.type}>{verifyMsg.text}</Alert>}<button className="btn btn-primary" disabled={verifyBusy}>{verifyBusy&&<Spinner/>}Doğrulama üçün müraciət et</button><p className="text-xs text-muted">Şəxsi sənəd yükləməyin; bu formda həssas sənəd qəbul edilmir.</p></form>}
          </section>

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
