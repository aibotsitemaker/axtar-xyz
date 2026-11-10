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
import { useAuth } from '../../../components/AuthProvider';
import SaveContentButton from '../../../components/SaveContentButton';

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
  const { user } = useAuth();
  const [reviews,setReviews]=useState([]); const [rating,setRating]=useState(5); const [reviewBody,setReviewBody]=useState(''); const [reviewMsg,setReviewMsg]=useState(''); const [reviewBusy,setReviewBusy]=useState(false); const [ratingSummary,setRatingSummary]=useState({avg_rating:0,review_count:0});

  useEffect(() => {
    if (!id) return undefined;
    let stop = false;
    Promise.all([
      supabase.from('profiles').select('id, full_name, city, bio, account_type, created_at, is_verified').eq('id', id).maybeSingle(),
      supabase.from('forum_topics').select('id, title, category_id, reply_count, last_activity_at, created_at', { count: 'exact' })
        .eq('author_id', id).eq('status', 'active').order('created_at', { ascending: false }).limit(20),
      supabase.from('forum_replies').select('id', { count: 'exact', head: true }).eq('author_id', id).eq('status', 'active'),
      loadCategories(),
      supabase.from('teacher_reviews').select('id,author_id,rating,body,created_at,profiles!teacher_reviews_author_id_fkey(full_name)').eq('teacher_id',id).eq('status','active').order('created_at',{ascending:false}).limit(50),
      supabase.rpc('review_rating_summary',{p_teacher:id})
    ]).then(([p, t, r, c,rv,rs]) => {
      if (stop) return;
      if (p.error) { setState('error'); return; }
      if (!p.data) { setState('missing'); return; }
      setProfile(p.data);
      setTopics(t.data || []);
      setTopicTotal(t.count ?? (t.data || []).length);
      setReplyTotal(r.count ?? 0);
      setCats(Object.fromEntries(c.map((x) => [x.id, x])));
      setReviews(rv.data||[]);setRatingSummary(rs.data?.[0]||{avg_rating:0,review_count:0});
      setState('ready');
      document.title = `${p.data.full_name || 'İstifadəçi'} | TəhsilHub`;
    }).catch(() => { if (!stop) setState('error'); });
    return () => { stop = true; };
  }, [id]);
  useEffect(()=>{if(state==='ready'&&id)fetch('/api/views',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contentType:'profile',contentId:id}),keepalive:true}).catch(()=>{});},[state,id]);

  async function submitReview(e){e.preventDefault();if(!user)return;setReviewBusy(true);setReviewMsg('');const {error}=await supabase.from('teacher_reviews').insert({teacher_id:id,author_id:user.id,rating:Number(rating),body:reviewBody.trim()});setReviewBusy(false);if(error)setReviewMsg(error.code==='23505'?'Bu müəllimə artıq rəy yazmısınız.':error.message);else{setReviewBody('');setReviewMsg('Rəyiniz dərc edildi.');const [{data:rv},{data:rs}]=await Promise.all([supabase.from('teacher_reviews').select('id,author_id,rating,body,created_at,profiles!teacher_reviews_author_id_fkey(full_name)').eq('teacher_id',id).eq('status','active').order('created_at',{ascending:false}).limit(50),supabase.rpc('review_rating_summary',{p_teacher:id})]);setReviews(rv||[]);setRatingSummary(rs?.[0]||{avg_rating:0,review_count:0});}}

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
            <h1 id="u-name" className="break-words text-xl font-bold tracking-tight sm:text-2xl">{name} {profile.is_verified&&<span className="text-blue-500" title="TəhsilHub tərəfindən doğrulanıb" aria-label="Doğrulanmış hesab">✓</span>}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
              <AccountBadge type={profile.account_type} />
              {profile.city && <span className="inline-flex items-center gap-1"><Icon name="pin" className="h-3.5 w-3.5" />{profile.city}</span>}
              <span>Qeydiyyat: {fmtDate(profile.created_at)}</span>
              {profile.account_type==='teacher'&&<SaveContentButton type="teacher_profile" id={id}/>}
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
      {profile.account_type==='teacher'&&<section className="mt-8" aria-labelledby="u-reviews"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="u-reviews" className="text-lg font-semibold">Müəllim rəyləri</h2><p className="text-sm text-muted">★ {ratingSummary.avg_rating||'0.00'} · {ratingSummary.review_count||0} rəy</p></div>
        {user&&user.id!==id&&<form onSubmit={submitReview} className="card mb-4 space-y-3 p-4"><label className="label" htmlFor="review-rating">Qiymət</label><select id="review-rating" className="input" value={rating} onChange={e=>setRating(e.target.value)}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}</select><label className="label" htmlFor="review-body">Rəyiniz</label><textarea id="review-body" className="input w-full" rows={3} minLength={5} maxLength={1500} value={reviewBody} onChange={e=>setReviewBody(e.target.value)} required placeholder="Müəllimin dərsləri və təcrübəniz haqqında…"/>{reviewMsg&&<p role="status" className="text-sm text-muted">{reviewMsg}</p>}<button disabled={reviewBusy||reviewBody.trim().length<5} className="btn btn-primary">{reviewBusy?'Göndərilir…':'Rəy yaz'}</button></form>}
        {reviews.length===0?<div className="card p-6 text-center text-sm text-muted">Hələ rəy yoxdur.</div>:<div className="space-y-3">{reviews.map(rv=><article key={rv.id} className="card p-4"><div className="flex justify-between gap-3"><Link href={`/u/${rv.author_id}`} className="font-medium hover:text-primary">{rv.profiles?.full_name||'İstifadəçi'}</Link><span className="text-amber-500" aria-label={`${rv.rating} ulduz`}>{'★'.repeat(rv.rating)}{'☆'.repeat(5-rv.rating)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{rv.body}</p><time className="mt-2 block text-xs text-muted">{fmtDate(rv.created_at)}</time></article>)}</div>}</section>}
    </div>
  );
}
