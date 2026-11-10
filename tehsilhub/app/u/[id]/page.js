'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import Icon from '../../../components/Icons';
import AccountBadge from '../../../components/AccountBadge';
import { Alert, EmptyState, ListSkeleton } from '../../../components/ui';
import { isUuid, loadCategories } from '../../../lib/forum';
import { fmtDate, timeAgo } from '../../../lib/format';

// İctimai profil: yalnız ad, hesab tipi, şəhər, haqqında və forum fəaliyyəti. E-poçt və digər şəxsi məlumat göstərilmir.
export default function PublicProfilePage() {
  const params = useParams();
  const raw = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const id = isUuid(raw) ? raw : '';
  const [state, setState] = useState('loading'); // loading | ready | missing | error
  const [profile, setProfile] = useState(null);
  const [topics, setTopics] = useState([]);
  const [topicTotal, setTopicTotal] = useState(0);
  const [replyTotal, setReplyTotal] = useState(0);
  const [cats, setCats] = useState({});

  useEffect(() => {
    if (!id) return undefined;
    let stop = false;
    Promise.all([
      supabase.from('profiles').select('id, full_name, city, bio, account_type, created_at').eq('id', id).maybeSingle(),
      supabase.from('forum_topics').select('id, title, category_id, reply_count, last_activity_at, created_at', { count: 'exact' })
        .eq('author_id', id).eq('status', 'active').order('created_at', { ascending: false }).limit(20),
      supabase.from('forum_replies').select('id', { count: 'exact', head: true }).eq('author_id', id).eq('status', 'active'),
      loadCategories()
    ]).then(([p, t, r, c]) => {
      if (stop) return;
      if (p.error) { setState('error'); return; }
      if (!p.data) { setState('missing'); return; }
      setProfile(p.data);
      setTopics(t.data || []);
      setTopicTotal(t.count ?? (t.data || []).length);
      setReplyTotal(r.count ?? 0);
      setCats(Object.fromEntries(c.map((x) => [x.id, x])));
      setState('ready');
      document.title = `${p.data.full_name || 'İstifadəçi'} | TəhsilHub`;
    }).catch(() => { if (!stop) setState('error'); });
    return () => { stop = true; };
  }, [id]);

  if (!id || state === 'missing') {
    return <EmptyState icon="user" title="İstifadəçi tapılmadı" text="Profil mövcud deyil və ya silinib." action={<Link href="/forum" className="btn btn-primary">Foruma qayıt</Link>} />;
  }
  if (state === 'loading') return <div className="mx-auto max-w-3xl"><ListSkeleton count={2} /></div>;
  if (state === 'error') return <Alert type="error">Profili yükləmək mümkün olmadı. Səhifəni yeniləyin.</Alert>;

  const name = (profile.full_name || '').trim() || 'İstifadəçi';
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/forum" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"><Icon name="arrowLeft" className="h-4 w-4" />Foruma qayıt</Link>

      <section className="card p-5 sm:p-6" aria-labelledby="u-name">
        <div className="flex items-start gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary text-2xl font-bold text-white" aria-hidden="true">{name[0].toUpperCase()}</div>
          <div className="min-w-0">
            <h1 id="u-name" className="break-words text-xl font-bold tracking-tight sm:text-2xl">{name}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
              <AccountBadge type={profile.account_type} />
              {profile.city && <span className="inline-flex items-center gap-1"><Icon name="pin" className="h-3.5 w-3.5" />{profile.city}</span>}
              <span>Qeydiyyat: {fmtDate(profile.created_at)}</span>
            </p>
          </div>
        </div>
        {profile.bio && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/85">{profile.bio}</p>}
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-center">
          <div className="rounded-lg bg-canvas px-3 py-2"><dt className="text-xs text-muted">Mövzu</dt><dd className="text-lg font-bold">{topicTotal}</dd></div>
          <div className="rounded-lg bg-canvas px-3 py-2"><dt className="text-xs text-muted">Cavab</dt><dd className="text-lg font-bold">{replyTotal}</dd></div>
        </dl>
      </section>

      <section className="mt-8" aria-labelledby="u-topics">
        <h2 id="u-topics" className="mb-3 text-lg font-semibold">Mövzuları</h2>
        {topics.length === 0 ? (
          <div className="card px-6 py-10 text-center text-sm text-muted">Hələ mövzu yaratmayıb.</div>
        ) : (
          <ul className="space-y-3">
            {topics.map((t) => (
              <li key={t.id} className="card flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  {cats[t.category_id] && <span className="badge badge-muted mb-1.5">{cats[t.category_id].name}</span>}
                  <h3 className="break-words font-semibold leading-snug"><Link href={`/forum/${t.id}`} className="hover:text-primary hover:underline">{t.title}</Link></h3>
                  <p className="mt-1 text-xs text-muted">{fmtDate(t.created_at)} · Son aktivlik: {timeAgo(t.last_activity_at)}</p>
                </div>
                <div className="shrink-0 rounded-lg bg-canvas px-3 py-2 text-center" aria-label={`${t.reply_count} cavab`}>
                  <div className="text-base font-bold leading-none">{t.reply_count}</div>
                  <div className="mt-1 text-[11px] text-muted">cavab</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
