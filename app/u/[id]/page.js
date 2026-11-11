'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import Icon from '../../../components/Icons';
import AccountBadge from '../../../components/AccountBadge';
import { Alert, EmptyState, ListSkeleton, Spinner } from '../../../components/ui';
import { isUuid, loadCategories } from '../../../lib/forum';
import { fmtDate, timeAgo } from '../../../lib/format';
import { useAuth } from '../../../components/AuthProvider';
import SaveContentButton from '../../../components/SaveContentButton';
import TeacherFollowButton from '../../../components/TeacherFollowButton';

// İctimai profil: yalnız ad, hesab tipi, şəhər, haqqında və forum fəaliyyəti. E-poçt və digər şəxsi məlumat göstərilmir.
export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const raw = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const id = isUuid(raw) ? raw : '';
  const [state, setState] = useState('loading'); // loading | ready | missing | error
  const [profile, setProfile] = useState(null);
  const [topics, setTopics] = useState([]);
  const [feedPosts, setFeedPosts] = useState([]);
  const [topicTotal, setTopicTotal] = useState(0);
  const [replyTotal, setReplyTotal] = useState(0);
  const [cats, setCats] = useState({});
  const { user } = useAuth();
  const [reviews,setReviews]=useState([]); const [reviewSort,setReviewSort]=useState('newest'); const [rating,setRating]=useState(5); const [reportId,setReportId]=useState(''); const [reportReason,setReportReason]=useState('other'); const [reportMsg,setReportMsg]=useState(''); const [reviewBody,setReviewBody]=useState(''); const [reviewMsg,setReviewMsg]=useState(''); const [reviewBusy,setReviewBusy]=useState(false); const [ratingSummary,setRatingSummary]=useState({avg_rating:0,review_count:0}); const [profileStats,setProfileStats]=useState({});
  const [messageBusy,setMessageBusy]=useState(false);const [messageError,setMessageError]=useState('');

  useEffect(() => {
    if (!id) return undefined;
    let stop = false;
    Promise.all([
      supabase.from('profiles').select('id, full_name, username, avatar_url, cover_url, city, bio, account_type, created_at, is_verified').eq('id', id).maybeSingle(),
      supabase.from('forum_topics').select('id, title, category_id, reply_count, last_activity_at, created_at', { count: 'exact' })
        .eq('author_id', id).eq('status', 'active').order('created_at', { ascending: false }).limit(20),
      supabase.from('forum_replies').select('id', { count: 'exact', head: true }).eq('author_id', id).eq('status', 'active'),
      loadCategories(),
      supabase.from('teacher_reviews').select('id,author_id,rating,body,created_at,profiles!teacher_reviews_author_id_fkey(full_name)').eq('teacher_id',id).eq('status','active').order('created_at',{ascending:false}).limit(50),
      supabase.from('feed_posts').select('id,body,created_at,view_count').eq('author_id',id).eq('status','active').order('created_at',{ascending:false}).limit(6),
      supabase.rpc('review_rating_summary',{p_teacher:id}),
      supabase.rpc('public_profile_stats',{p_user:id})
    ]).then(([p, t, r, c,rv,fp,rs,ps]) => {
      if (stop) return;
      if (p.error) { setState('error'); return; }
      if (!p.data) { setState('missing'); return; }
      setProfile(p.data);
      setTopics(t.data || []);
      setTopicTotal(t.count ?? (t.data || []).length);
      setReplyTotal(r.count ?? 0);
      setCats(Object.fromEntries(c.map((x) => [x.id, x])));
      setReviews(rv.data||[]);setRatingSummary(rs.data?.[0]||{avg_rating:0,review_count:0});
      setFeedPosts(fp.data||[]);
      setProfileStats(ps.data||{});
      setState('ready');
      document.title = `${p.data.full_name || 'İstifadəçi'} | TəhsilHub`;
    }).catch(() => { if (!stop) setState('error'); });
    return () => { stop = true; };
  }, [id]);
  useEffect(()=>{if(state==='ready'&&id)fetch('/api/views',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contentType:'profile',contentId:id}),keepalive:true}).catch(()=>{});},[state,id]);

  async function submitReview(e){e.preventDefault();if(!user)return;setReviewBusy(true);setReviewMsg('');const {error}=await supabase.from('teacher_reviews').insert({teacher_id:id,author_id:user.id,rating:Number(rating),body:reviewBody.trim()});setReviewBusy(false);if(error)setReviewMsg(error.code==='23505'?'Bu müəllimə artıq rəy yazmısınız.':error.message);else{setReviewBody('');setReviewMsg('Rəyiniz dərc edildi.');const [{data:rv},{data:rs}]=await Promise.all([supabase.from('teacher_reviews').select('id,author_id,rating,body,created_at,profiles!teacher_reviews_author_id_fkey(full_name)').eq('teacher_id',id).eq('status','active').order('created_at',{ascending:false}).limit(50),supabase.rpc('review_rating_summary',{p_teacher:id})]);setReviews(rv||[]);setRatingSummary(rs?.[0]||{avg_rating:0,review_count:0});}}
  async function reportReview(reviewId){if(!user)return;const {error}=await supabase.from('teacher_review_reports').insert({review_id:reviewId,reporter_id:user.id,reason:reportReason,details:null});if(error)setReportMsg(error.code==='23505'?'Bu rəy üçün artıq şikayət etmisiniz.':error.message);else{setReportMsg('Şikayətiniz moderatorlara göndərildi.');setReportId('');}}
  async function startMessage(){if(!user){router.push(`/auth?next=${encodeURIComponent(`/u/${id}`)}`);return;}if(user.id===id)return;setMessageBusy(true);setMessageError('');const {data,error}=await supabase.rpc('get_or_create_conversation',{p_other_user:id,p_book_id:null});setMessageBusy(false);if(error||!data){setMessageError(error?.message||'Şəxsi mesajlaşmanı başlatmaq mümkün olmadı.');return;}router.push(`/chat?c=${encodeURIComponent(data)}`);}

  if (!id || state === 'missing') {
    return <EmptyState icon="user" title="İstifadəçi tapılmadı" text="Profil mövcud deyil və ya silinib." action={<Link href="/forum" className="btn btn-primary">Foruma qayıt</Link>} />;
  }
  if (state === 'loading') return <div className="mx-auto max-w-3xl"><ListSkeleton count={2} /></div>;
  if (state === 'error') return <Alert type="error">Profili yükləmək mümkün olmadı. Səhifəni yeniləyin.</Alert>;

  const name = (profile.full_name || '').trim() || 'İstifadəçi';
  const visibleReviews=[...reviews].sort((a,b)=>reviewSort==='highest'?b.rating-a.rating:reviewSort==='lowest'?a.rating-b.rating:new Date(b.created_at)-new Date(a.created_at));
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/forum" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"><Icon name="arrowLeft" className="h-4 w-4" />Foruma qayıt</Link>

      <section className="teacher-profile-hero card overflow-hidden p-0" aria-labelledby="u-name">
        <div className="h-32 bg-gradient-to-r from-primary/20 via-indigo-100 to-sky-100 sm:h-48">{profile.cover_url&&<img src={profile.cover_url} alt="Profil örtük şəkli" className="h-full w-full object-cover"/>}</div>
        <div className="px-5 pb-5 sm:px-7 sm:pb-7">
        <div className="-mt-10 flex items-end gap-4 sm:-mt-14 sm:gap-5">
          <div className="teacher-profile-avatar grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-2xl font-bold text-white sm:h-28 sm:w-28" aria-hidden="true">{profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : name[0].toUpperCase()}</div>
          <div className="min-w-0">
            <h1 id="u-name" className="break-words text-xl font-bold tracking-tight sm:text-2xl">{name} {profile.is_verified&&<span className="text-blue-500" title="TəhsilHub tərəfindən doğrulanıb" aria-label="Doğrulanmış hesab">✓</span>}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
              <AccountBadge type={profile.account_type} />
              {profile.account_type==='teacher'&&<TeacherFollowButton teacherId={id}/>}
              {user?.id!==id&&<button type="button" onClick={startMessage} disabled={messageBusy} className="btn btn-primary btn-sm">{messageBusy?<Spinner/>:<Icon name="chat" className="h-4 w-4"/>}Mesaj yaz</button>}
              {profile.city && <span className="inline-flex items-center gap-1"><Icon name="pin" className="h-3.5 w-3.5" />{profile.city}</span>}
              <span>Qeydiyyat: {fmtDate(profile.created_at)}</span>
              {profile.account_type==='teacher'&&<SaveContentButton type="teacher_profile" id={id}/>}
            </p>
          </div>
        </div>
        {profile.bio && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/85">{profile.bio}</p>}
        <dl className="profile-stats mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5 text-center sm:grid-cols-3">
          <div className="rounded-lg bg-canvas px-3 py-2"><dt className="text-xs text-muted">Mövzu</dt><dd className="text-lg font-bold">{topicTotal}</dd></div>
          <div className="rounded-lg bg-canvas px-3 py-2"><dt className="text-xs text-muted">Cavab</dt><dd className="text-lg font-bold">{replyTotal}</dd></div>
          <div className="rounded-lg bg-canvas px-3 py-2"><dt className="text-xs text-muted">Feed paylaşımı</dt><dd className="text-lg font-bold">{profileStats.feed_posts||0}</dd></div>
          <div className="rounded-lg bg-canvas px-3 py-2"><dt className="text-xs text-muted">Bəyənmə</dt><dd className="text-lg font-bold">{profileStats.feed_likes_received||0}</dd></div>
          <div className="rounded-lg bg-canvas px-3 py-2"><dt className="text-xs text-muted">Ümumi baxış</dt><dd className="text-lg font-bold">{profileStats.total_views||0}</dd></div>
          {profile.account_type==='teacher'&&<div className="rounded-lg bg-canvas px-3 py-2"><dt className="text-xs text-muted">Orta rəy</dt><dd className="text-lg font-bold">★ {profileStats.avg_rating||'0.00'} · {profileStats.review_count||0}</dd></div>}
        </dl>
        {messageError&&<Alert type="error" className="mt-4">{messageError}</Alert>}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="u-feed"><div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="u-feed" className="text-lg font-bold">Paylaşımlar</h2><p className="mt-1 text-sm text-muted">TəhsilHub Feed-də paylaşdığı fikirlər</p></div><Link href="/feed" className="text-sm font-semibold text-primary">Feed-ə keç</Link></div>
        {feedPosts.length===0?<div className="card px-6 py-9 text-center"><span className="feed-empty-icon"><Icon name="feed" className="h-6 w-6"/></span><p className="mt-3 text-sm text-muted">Hələ paylaşım yoxdur.</p></div>:<div className="space-y-3">{feedPosts.map(post=><article key={post.id} className="profile-post card p-4"><p className="whitespace-pre-wrap break-words text-sm leading-6">{post.body}</p><div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-muted"><time>{fmtDate(post.created_at)}</time><span className="inline-flex items-center gap-1"><Icon name="eye" className="h-3.5 w-3.5"/>{post.view_count||0} baxış</span><Link href={`/feed?post=${post.id}`} className="font-semibold text-primary">Müzakirəyə bax</Link></div></article>)}</div>}
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
      {profile.account_type==='teacher'&&<section className="mt-8" aria-labelledby="u-reviews"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="u-reviews" className="text-lg font-semibold">Müəllim rəyləri</h2><div className="flex items-center gap-3"><p className="text-sm text-muted">★ {ratingSummary.avg_rating||'0.00'} · {ratingSummary.review_count||0} rəy</p><select aria-label="Rəyləri sırala" className="input w-auto py-2" value={reviewSort} onChange={e=>setReviewSort(e.target.value)}><option value="newest">Ən yeni</option><option value="highest">Yüksək reytinq</option><option value="lowest">Aşağı reytinq</option></select></div></div>
        {user&&user.id!==id&&<form onSubmit={submitReview} className="card mb-4 space-y-3 p-4"><label className="label" htmlFor="review-rating">Qiymət</label><select id="review-rating" className="input" value={rating} onChange={e=>setRating(e.target.value)}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}</select><label className="label" htmlFor="review-body">Rəyiniz</label><textarea id="review-body" className="input w-full" rows={3} minLength={5} maxLength={1500} value={reviewBody} onChange={e=>setReviewBody(e.target.value)} required placeholder="Müəllimin dərsləri və təcrübəniz haqqında…"/>{reviewMsg&&<p role="status" className="text-sm text-muted">{reviewMsg}</p>}<button disabled={reviewBusy||reviewBody.trim().length<5} className="btn btn-primary">{reviewBusy?'Göndərilir…':'Rəy yaz'}</button></form>}
        {reportMsg&&<p role="status" className="mb-3 text-sm text-muted">{reportMsg}</p>}{reviews.length===0?<div className="card p-6 text-center text-sm text-muted">Hələ rəy yoxdur.</div>:<div className="space-y-3">{visibleReviews.map(rv=><article key={rv.id} className="card p-4"><div className="flex justify-between gap-3"><Link href={`/u/${rv.author_id}`} className="font-medium hover:text-primary">{rv.profiles?.full_name||'İstifadəçi'}</Link><span className="text-amber-500" aria-label={`${rv.rating} ulduz`}>{'★'.repeat(rv.rating)}{'☆'.repeat(5-rv.rating)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{rv.body}</p><time className="mt-2 block text-xs text-muted">{fmtDate(rv.created_at)}</time>{user&&user.id!==rv.author_id&&<div className="mt-2">{reportId===rv.id?<div className="flex flex-wrap gap-2"><select aria-label="Şikayət səbəbi" className="input w-auto" value={reportReason} onChange={e=>setReportReason(e.target.value)}><option value="spam">Spam</option><option value="abuse">Təhqir</option><option value="false_info">Yanlış məlumat</option><option value="other">Digər</option></select><button className="btn btn-danger btn-sm" onClick={()=>reportReview(rv.id)}>Şikayəti göndər</button><button className="btn btn-secondary btn-sm" onClick={()=>setReportId('')}>Ləğv et</button></div>:<button className="text-xs text-muted underline" onClick={()=>{setReportId(rv.id);setReportMsg('');}}>Rəyi şikayət et</button>}</div>}</article>)}</div>}</section>}
    </div>
  );
}
