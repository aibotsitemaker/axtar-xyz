'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useAuth, LoginPrompt } from '../../../components/AuthProvider';
import Icon from '../../../components/Icons';
import CharCount from '../../../components/forum/CharCount';
import { Alert, PageHeader, Spinner } from '../../../components/ui';
import { loadCategories } from '../../../lib/forum';
import { errText, fmtBlockUntil } from '../../../lib/format';

const TITLE_MAX = 150;
const BODY_MAX = 10000;

export default function NewTopicPage() {
  const { user, loading, me } = useAuth();
  const router = useRouter();
  const [cats, setCats] = useState([]);
  const [catId, setCatId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lock = useRef(false);

  useEffect(() => {
    let stop = false;
    loadCategories().then((c) => { if (!stop) setCats(c.filter((x) => x.is_active)); });
    return () => { stop = true; };
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (lock.current) return; // təkrar klikdən qorunma
    setErr('');
    const t = title.trim().replace(/\s+/g, ' ');
    const b = body.trim();
    if (!catId) return setErr('Kateqoriya seçin.');
    if (t.length < 5) return setErr('Başlıq ən azı 5 simvol olmalıdır.');
    if (b.length < 10) return setErr('Müzakirə mətni ən azı 10 simvol olmalıdır.');
    lock.current = true;
    setBusy(true);
    const { data, error } = await supabase.rpc('forum_create_topic', { p_category: catId, p_title: t, p_body: b });
    if (error || !data) {
      setErr(errText(error));
      setBusy(false);
      lock.current = false;
      return;
    }
    router.push(`/forum/${data}`);
  }

  if (loading) return <div className="skeleton h-96" aria-busy="true" />;
  if (!user) return <LoginPrompt text="Mövzu yaratmaq üçün daxil olun." next="/forum/new" />;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/forum" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"><Icon name="arrowLeft" className="h-4 w-4" />Foruma qayıt</Link>
      <PageHeader title="Yeni mövzu" subtitle="Aydın başlıq və qısa izah daha tez cavab almağa kömək edir." />
      {me.blockedUntil && <Alert type="warning" className="mb-4">Hesabınız {fmtBlockUntil(me.blockedUntil)} məhdudlaşdırılıb. Bu müddətdə yeni mövzu yarada bilməzsiniz.</Alert>}
      <form onSubmit={submit} className="card space-y-5 p-5 sm:p-6" noValidate>
        <div>
          <label htmlFor="nt-cat" className="label">Kateqoriya</label>
          <select id="nt-cat" className="input" required value={catId} onChange={(e) => setCatId(e.target.value)}>
            <option value="">Seçin…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="nt-title" className="label">Başlıq</label>
          <input id="nt-title" className="input" required maxLength={TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Qısa və aydın başlıq" />
          <p className="hint flex justify-between"><span>5–{TITLE_MAX} simvol</span><CharCount value={title} max={TITLE_MAX} min={5} /></p>
        </div>
        <div>
          <label htmlFor="nt-body" className="label">Müzakirə mətni</label>
          <textarea id="nt-body" rows={10} className="input" required maxLength={BODY_MAX} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Sualınızı və ya fikrinizi ətraflı yazın…" />
          <p className="hint flex justify-between"><span>Sadə mətn. HTML işlənmir; yalnız https:// ünvanları keçid olur.</span><CharCount value={body} max={BODY_MAX} min={10} /></p>
        </div>
        {err && <Alert type="error">{err}</Alert>}
        <div className="flex justify-end gap-2">
          <Link href="/forum" className="btn btn-secondary">Ləğv et</Link>
          <button className="btn btn-primary" disabled={busy || !!me.blockedUntil}>{busy && <Spinner />}Mövzunu yarat</button>
        </div>
      </form>
    </div>
  );
}
