'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import AdSlot from '../../components/AdSlot';
import Icon from '../../components/Icons';
import { Alert, EmptyState, PageHeader, Spinner } from '../../components/ui';

const CATS = ['', 'DİM', 'Magistr', 'IELTS', 'Universitet', 'Digər'];
const fmt = (s) => `${String(Math.floor(Math.max(s, 0) / 60)).padStart(2, '0')}:${String(Math.max(s, 0) % 60).padStart(2, '0')}`;
const answerLabel = (item, value) => {
  if (value === null || value === undefined) return 'Cavab verilməyib';
  if (item.question_type === 'text' || item.question_type === 'numeric') return String(value);
  const ids = Array.isArray(value) ? value : [value];
  return ids.map((id) => item.options?.[Number(id)]).filter(Boolean).join(', ');
};

function Ring({ percent }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-36 w-36" role="img" aria-label={`Nəticə: ${percent} faiz`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(var(--line))" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(var(--primary))" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * percent) / 100} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-3xl font-bold">{percent}%</div>
    </div>
  );
}

function Engine({ quiz, user, onExit }) {
  const [qs,setQs]=useState([]);const [index,setIndex]=useState(0);const [picked,setPicked]=useState(null);const [answers,setAnswers]=useState([]);
  const [left,setLeft]=useState(quiz.duration_seconds);const [deadline,setDeadline]=useState(null);const [sessionId,setSessionId]=useState(null);const [sessionReady,setSessionReady]=useState(false);
  const [done,setDone]=useState(false);const [err,setErr]=useState('');const [savingAnswer,setSavingAnswer]=useState(false);const [saveState,setSaveState]=useState('');const [result,setResult]=useState(null);const submitted=useRef(false);
  const [review,setReview]=useState([]);const [online,setOnline]=useState(true);const [retryCount,setRetryCount]=useState(0);
  const cacheKey=`tehsilhub:quiz:${user.id}:${quiz.id}`;const cacheRef=useRef(null);

  useEffect(()=>{let live=true;(async()=>{
    let cached=null;try{cached=JSON.parse(localStorage.getItem(cacheKey)||'null');}catch{cached=null;}
    const [{data:questions,error:qError},{data:run,error:rError}]=await Promise.all([
      supabase.from('quiz_questions').select('id, quiz_id, position, question_text, options, question_type, points').eq('quiz_id',quiz.id).order('position'),
      supabase.rpc('start_quiz_session',{p_quiz_id:quiz.id})
    ]);
    if(!live)return;
    if(qError||rError||!run?.[0]){
      if(cached?.sessionId&&cached?.endsAt&&cached?.questions?.length){
        cacheRef.current=cached;setQs(cached.questions);setAnswers(cached.answers||[]);setSessionId(cached.sessionId);setDeadline(cached.endsAt);setLeft(Math.max(0,Math.ceil((new Date(cached.endsAt).getTime()-Date.now())/1000)));const first=cached.questions.findIndex(q=>!(cached.answers||[]).some(a=>a.q===q.id));const at=first<0?Math.max(0,cached.questions.length-1):first;setIndex(at);setPicked(cached.answers?.find(a=>a.q===cached.questions[at]?.id)?.picked??null);setDone(Boolean(cached.finishRequested)||first<0);setErr('Bağlantı yoxdur. Keşdəki sınaq və cavablar bərpa edildi.');setSessionReady(true);return;
      }
      setErr(rError?.message||qError?.message||'Sınağı başlatmaq olmadı.');setSessionReady(true);return;
    }
    const qlist=questions||[];const data=run[0];if(!qlist.length){setErr('Bu sınaqda hələ sual yoxdur.');setSessionReady(true);return;}
    const savedMap=new Map(Object.entries(data.answers||{}));
    if(cached?.sessionId===data.session_id)for(const answer of cached.answers||[])savedMap.set(answer.q,answer.picked);
    const savedAnswers=[...savedMap].map(([q,picked])=>({q,picked}));const first=qlist.findIndex(q=>!savedMap.has(q.id));const at=first<0?Math.max(0,qlist.length-1):first;
    const snapshot={sessionId:data.session_id,endsAt:data.ends_at,questions:qlist,answers:savedAnswers,finishRequested:Boolean(cached?.sessionId===data.session_id&&cached?.finishRequested)};
    cacheRef.current=snapshot;localStorage.setItem(cacheKey,JSON.stringify(snapshot));setQs(qlist);setAnswers(savedAnswers);setIndex(at);setPicked(qlist[at]?savedMap.get(qlist[at].id)??null:null);setSessionId(data.session_id);setDeadline(data.ends_at);setLeft(Math.max(0,Math.ceil((new Date(data.ends_at).getTime()-Date.now())/1000)));setSessionReady(true);
    if(snapshot.finishRequested||first<0)setDone(true);
  })();return()=>{live=false;};},[quiz.id,cacheKey]);

  useEffect(()=>{const on=()=>setOnline(true);const off=()=>setOnline(false);setOnline(navigator.onLine);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);};},[]);
  useEffect(()=>{if(!deadline||done)return undefined;const tick=()=>{const remaining=Math.max(0,Math.ceil((new Date(deadline).getTime()-Date.now())/1000));setLeft(remaining);if(remaining<=0)setDone(true);};tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[deadline,done]);
  const correct=Number(result?.r_correct)||0;const percent=Number(result?.r_percent)||0;
  useEffect(()=>{if(online&&sessionId&&!done&&cacheRef.current?.answers?.length){let live=true;(async()=>{for(const a of cacheRef.current.answers){const {error}=await supabase.rpc('save_quiz_session_answer_v2',{p_session_id:sessionId,p_question_id:a.q,p_answer:a.picked});if(error){if(live)setErr('Bəzi cavablar serverə göndərilmədi. Bağlantı bərpa olunanda yenidən cəhd ediləcək.');return;}}if(live)setErr('');})();return()=>{live=false;};}return undefined;},[online,sessionId,done]);
  useEffect(()=>{if(done&&cacheRef.current){cacheRef.current={...cacheRef.current,finishRequested:true};localStorage.setItem(cacheKey,JSON.stringify(cacheRef.current));}},[done,cacheKey]);
  useEffect(()=>{if(!done||!sessionId||submitted.current||!online)return;submitted.current=true;setSaveState('saving');(async()=>{const snapshot=cacheRef.current; if(snapshot&&new Date(snapshot.endsAt).getTime()>Date.now()){for(const a of snapshot.answers||[]){const {error:answerError}=await supabase.rpc('save_quiz_session_answer_v2',{p_session_id:sessionId,p_question_id:a.q,p_answer:a.picked});if(answerError){submitted.current=false;setSaveState('error');return;}}}const {data,error}=await supabase.rpc('finish_quiz_session_v2',{p_session_id:sessionId});if(error){submitted.current=false;setSaveState('error');return;}setResult(data?.[0]||null);setSaveState('ok');const {data:details}=await supabase.rpc('quiz_session_review_v2',{p_session_id:sessionId});setReview(details||[]);})().catch(()=>{submitted.current=false;setSaveState('error');});},[done,sessionId,online,retryCount]);

  async function pick(option){if(savingAnswer||done||!qs[index]||!sessionId||picked===option)return;setErr('');setSavingAnswer(true);const qid=qs[index].id;const updated=answers.filter(x=>x.q!==qid);if(option!==null)updated.push({q:qid,picked:option});setPicked(option);setAnswers(updated);const snapshot={...(cacheRef.current||{}),sessionId,endsAt:deadline,questions:qs,answers:updated};cacheRef.current=snapshot;try{localStorage.setItem(cacheKey,JSON.stringify(snapshot));}catch{}if(!navigator.onLine){setSavingAnswer(false);setErr('Cavab cihazda saxlanıldı; internet bərpa olunanda serverə göndəriləcək.');return;}const {error}=await supabase.rpc('save_quiz_session_answer_v2',{p_session_id:sessionId,p_question_id:qid,p_answer:option});setSavingAnswer(false);if(error)setErr('Cavab cihazda saxlanıldı; serverə göndərmək mümkün olmadı, bağlantı bərpa olunanda yenidən göndəriləcək.');}
  function next(){if(index+1>=qs.length)setDone(true);else{const n=index+1;setIndex(n);setPicked(answers.find(a=>a.q===qs[n].id)?.picked??null);}}
  if(!sessionReady||(!err&&!qs.length))return <div className="mx-auto max-w-2xl space-y-3" aria-busy="true"><div className="skeleton h-10"/><div className="skeleton h-64"/></div>;
  if(err&&!sessionId)return <div className="card mx-auto max-w-xl p-6"><Alert type="error">{err}</Alert><button className="btn btn-secondary mt-4" onClick={onExit}>Sınaqlara qayıt</button></div>;
  if(done)return <div className="mx-auto max-w-3xl"><div className="card p-6 text-center sm:p-8"><Ring percent={percent}/><h1 className="mt-5 text-2xl font-bold">{saveState==='saving'?'Nəticə hesablanır…':saveState==='error'?'Nəticəni hesablamaq mümkün olmadı':percent>=70?'Əla nəticə!':percent>=40?'Yaxşı cəhd!':'Təkrar çalışın!'}</h1><p className="mt-1 text-sm text-muted">{quiz.title}</p><div className="mt-6 grid grid-cols-3 gap-3 text-sm"><div className="rounded-lg bg-success-soft p-3"><div className="text-xl font-bold text-success">{saveState==='ok'?correct:'—'}</div><div className="text-muted">Düzgün</div></div><div className="rounded-lg bg-danger-soft p-3"><div className="text-xl font-bold text-danger">{saveState==='ok'?Number(result?.r_total)-correct:'—'}</div><div className="text-muted">Səhv</div></div><div className="rounded-lg bg-canvas p-3"><div className="text-xl font-bold">{fmt(quiz.duration_seconds-left)}</div><div className="text-muted">Vaxt</div></div></div><div className="mt-5">{saveState==='saving'&&<p className="flex items-center justify-center gap-2 text-xs text-muted"><Spinner/>Nəticə saxlanılır…</p>}{saveState==='ok'&&<Alert type="success" className="text-left">Nəticə kabinetinizdə saxlanıldı.</Alert>}{saveState==='error'&&<Alert type="error" className="text-left">{online?'Nəticəni hesablamaq mümkün olmadı. Yenidən cəhd edin.':'İnternet bərpa olunanda nəticə avtomatik göndəriləcək.'}</Alert>}</div>{saveState==='error'&&online&&<button className="btn btn-primary mt-6" onClick={()=>{submitted.current=false;setRetryCount(n=>n+1);}}>Yenidən cəhd et</button>}<button className="btn btn-secondary mt-6" onClick={onExit}>Sınaqlara qayıt</button></div>{review.length>0&&<section className="mt-6 space-y-3" aria-labelledby="quiz-review-title"><h2 id="quiz-review-title" className="text-lg font-semibold">Sual təhlili</h2>{review.map((item,i)=><article key={item.question_id} className="card p-4"><h3 className="font-semibold">{i+1}. {item.question_text}</h3><p className={`mt-2 text-sm ${item.is_correct?'text-success':'text-danger'}`}>Sizin cavabınız: {answerLabel(item,item.picked_answer)}</p><p className="mt-1 text-sm text-success">Düzgün cavab: {answerLabel(item,item.correct_answers)}</p>{item.explanation&&<p className="mt-2 text-sm text-muted">İzah: {item.explanation}</p>}</article>)}</section>}</div>;
  const current=qs[index];return <div className="mx-auto max-w-2xl"><div className="mb-4 flex items-center justify-between gap-3"><button onClick={onExit} className="text-sm font-medium text-muted">Sınaqlardan çıx</button><span className={`rounded-full px-3 py-1 text-sm font-semibold ${left<30?'bg-danger-soft text-danger':'bg-primary-soft text-primary'}`}><Icon name="clock" className="mr-1 inline h-4 w-4"/>{fmt(left)}</span></div><div className="mb-4 flex flex-wrap gap-2" role="navigation" aria-label="Sual seçimi">{qs.map((q,i)=><button key={q.id} type="button" onClick={()=>{setIndex(i);setPicked(answers.find(a=>a.q===q.id)?.picked??null);}} aria-current={index===i?'step':undefined} aria-label={`Sual ${i+1}${answers.some(a=>a.q===q.id)?', cavablanıb':', cavablanmayıb'}`} className={`grid h-9 w-9 place-items-center rounded-lg border text-sm font-semibold ${index===i?'border-primary bg-primary text-white':answers.some(a=>a.q===q.id)?'border-success bg-success-soft text-success':'border-line bg-surface text-muted'}`}>{i+1}</button>)}</div><div className="mb-5" role="progressbar" aria-valuemin={0} aria-valuemax={qs.length} aria-valuenow={answers.length} aria-label="Cavablanmış suallar"><div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-primary transition-all" style={{width:`${(answers.length/qs.length)*100}%`}}/></div></div><div className="card p-5 sm:p-7"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Sual {index+1} / {qs.length} · Cavablar avtomatik saxlanır</p><h1 className="mt-2 text-lg font-semibold leading-snug sm:text-xl">{current.question_text}</h1>{current.question_type==='text'||current.question_type==='numeric'?<div className="mt-5"><label htmlFor="quiz-answer" className="label">{current.question_type==='numeric'?'Rəqəm cavabı':'Cavabınız'}</label><input id="quiz-answer" className="input" inputMode={current.question_type==='numeric'?'decimal':'text'} value={picked??''} onChange={e=>current.question_type==='text'?pick(e.target.value):setPicked(e.target.value)} onBlur={e=>{if(current.question_type==='numeric')pick(e.target.value.trim()===''?null:Number(e.target.value));}} /></div>:<div className="mt-5 space-y-3" role="group" aria-label={current.question_type==='multiple'?'Bir neçə cavab seçin':'Cavab variantları'}>{current.options.map((opt,n)=>{const selected=Array.isArray(picked)?picked.includes(n):picked===n;return <button key={n} onClick={()=>pick(current.question_type==='multiple'?(Array.isArray(picked)?(selected?picked.filter(v=>v!==n):[...picked,n]):[n]):n)} disabled={savingAnswer} aria-pressed={selected} className={`flex min-h-12 w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm font-medium ${selected?'border-primary bg-primary-soft':'border-line bg-surface hover:border-primary'}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${selected?'bg-primary text-white':'bg-canvas text-muted'}`}>{String.fromCharCode(65+n)}</span><span className="min-w-0 flex-1 break-words">{opt}</span>{savingAnswer&&<Spinner/>}</button>;})}</div>}{err&&<Alert type="error" className="mt-4">{err}</Alert>}{(picked!==null&&(!Array.isArray(picked)||picked.length>0)&&(typeof picked!=='string'||picked.trim().length>0))&&<button onClick={next} className="btn btn-primary btn-lg mt-5 w-full">{index+1>=qs.length?'Nəticəni gör':'Növbəti sual'}<Icon name="arrowRight" className="h-4 w-4"/></button>}</div></div>;
}
export default function QuizzesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState([]);
  const [cat, setCat] = useState('');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  useEffect(() => {
    setLoading(true);
    let qb = supabase.from('quizzes').select('*, quiz_questions(count)').eq('is_published', true).order('created_at', { ascending: false });
    if (cat) qb = qb.eq('category', cat);
    qb.then(({ data }) => { setQuizzes(data || []); setLoading(false); });
  }, [cat]);

  if (active) return <Engine quiz={active} user={user} onExit={() => setActive(null)} />;

  return (
    <div>
      <PageHeader title="Onlayn sınaqlar" subtitle="Taymerli testlər, dərhal nəticə və izahlar" />
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Kateqoriya">
        {CATS.map((c) => (
          <button key={c || 'all'} role="tab" aria-selected={cat === c} onClick={() => setCat(c)}
            className={`btn btn-sm shrink-0 ${cat === c ? 'btn-primary' : 'btn-secondary'}`}>{c || 'Hamısı'}</button>
        ))}
      </div>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Yüklənir">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-44" />)}</div>
      ) : quizzes.length === 0 ? (
        <EmptyState icon="quiz" title="Sınaq tapılmadı" text={cat ? 'Bu kateqoriyada hələ sınaq yoxdur.' : 'Sınaqlar tezliklə əlavə olunacaq.'}
          action={cat ? <button className="btn btn-secondary" onClick={() => setCat('')}>Bütün sınaqlara bax</button> : null} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((z) => (
            <article key={z.id} className="card flex flex-col p-5 transition-shadow hover:shadow-pop">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary-soft text-primary"><Icon name="quiz" className="h-5 w-5" /></div>
                <span className="badge">{z.category}</span>
              </div>
              <h2 className="mt-4 font-semibold">{z.title}</h2>
              <p className="mt-1 flex-1 text-sm text-muted">{z.description}</p>
              <p className="mt-4 flex items-center gap-4 text-xs text-muted">
                <span className="inline-flex items-center gap-1"><Icon name="file" className="h-3.5 w-3.5" />{z.quiz_questions?.[0]?.count ?? 0} sual</span>
                <span className="inline-flex items-center gap-1"><Icon name="clock" className="h-3.5 w-3.5" />{Math.round(z.duration_seconds / 60)} dəq</span>
              </p>
              <button onClick={() => { if (!user) router.push('/auth?next=%2Fquizzes'); else setActive(z); }} disabled={authLoading} className="btn btn-primary mt-4">{user?'Başla':'Daxil olub başla'}<Icon name="arrowRight" className="h-4 w-4" /></button>
            </article>
          ))}
        </div>
      )}
      <AdSlot />
    </div>
  );
}

