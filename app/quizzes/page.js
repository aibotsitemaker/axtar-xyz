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

  useEffect(()=>{let live=true;(async()=>{
    const [{data:questions,error:qError},{data:run,error:rError}]=await Promise.all([
      supabase.from('quiz_questions').select('id, quiz_id, position, question_text, options').eq('quiz_id',quiz.id).order('position'),
      supabase.rpc('start_quiz_session',{p_quiz_id:quiz.id})
    ]);
    if(!live)return;if(qError||rError||!run?.[0]){setErr(rError?.message||qError?.message||'Sınağı başlatmaq olmadı.');setSessionReady(true);return;}
    const qlist=questions||[];const data=run[0];const savedAnswers=Object.entries(data.answers||{}).map(([q,p])=>({q,picked:Number(p)}));
    const map=new Map(savedAnswers.map(a=>[a.q,a.picked]));const first=qlist.findIndex(q=>!map.has(q.id));const at=first<0?Math.max(0,qlist.length-1):first;
    setQs(qlist);setAnswers(savedAnswers);setIndex(at);setPicked(qlist[at]?map.get(qlist[at].id)??null:null);setSessionId(data.session_id);setDeadline(data.ends_at);setLeft(Math.max(0,Math.ceil((new Date(data.ends_at).getTime()-Date.now())/1000)));setSessionReady(true);
    if(qlist.length&&first<0)setDone(true);
  })();return()=>{live=false;};},[quiz.id]);

  useEffect(()=>{if(!deadline||done)return undefined;const tick=()=>{const remaining=Math.max(0,Math.ceil((new Date(deadline).getTime()-Date.now())/1000));setLeft(remaining);if(remaining<=0)setDone(true);};tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[deadline,done]);
  const correct=Number(result?.r_correct)||0;const percent=Number(result?.r_percent)||0;
  useEffect(()=>{if(!done||!sessionId||submitted.current)return;submitted.current=true;setSaveState('saving');supabase.rpc('finish_quiz_session',{p_session_id:sessionId}).then(({data,error})=>{if(error)setSaveState('error');else{setResult(data?.[0]||null);setSaveState('ok');}});},[done,sessionId]);

  async function pick(option){if(picked!==null||savingAnswer||done||!qs[index]||!sessionId)return;setErr('');setSavingAnswer(true);const {error}=await supabase.rpc('save_quiz_session_answer',{p_session_id:sessionId,p_question_id:qs[index].id,p_picked:option});setSavingAnswer(false);if(error){setErr('Cavab serverdə saxlanmadı. Bağlantını yoxlayıb yenidən cəhd edin.');return;}setPicked(option);setAnswers(all=>[...all.filter(x=>x.q!==qs[index].id),{q:qs[index].id,picked:option}]);}
  function next(){if(index+1>=qs.length)setDone(true);else{const n=index+1;setIndex(n);setPicked(answers.find(a=>a.q===qs[n].id)?.picked??null);}}
  if(!sessionReady||(!err&&!qs.length))return <div className="mx-auto max-w-2xl space-y-3" aria-busy="true"><div className="skeleton h-10"/><div className="skeleton h-64"/></div>;
  if(err&&!sessionId)return <div className="card mx-auto max-w-xl p-6"><Alert type="error">{err}</Alert><button className="btn btn-secondary mt-4" onClick={onExit}>Sınaqlara qayıt</button></div>;
  if(done)return <div className="card mx-auto max-w-lg p-6 text-center sm:p-8"><Ring percent={percent}/><h1 className="mt-5 text-2xl font-bold">{saveState==='saving'?'Nəticə hesablanır…':saveState==='error'?'Nəticəni hesablamaq mümkün olmadı':percent>=70?'Əla nəticə!':percent>=40?'Yaxşı cəhd!':'Təkrar çalışın!'}</h1><p className="mt-1 text-sm text-muted">{quiz.title}</p><div className="mt-6 grid grid-cols-3 gap-3 text-sm"><div className="rounded-lg bg-success-soft p-3"><div className="text-xl font-bold text-success">{saveState==='ok'?correct:'—'}</div><div className="text-muted">Düzgün</div></div><div className="rounded-lg bg-danger-soft p-3"><div className="text-xl font-bold text-danger">{saveState==='ok'?Number(result?.r_total)-correct:'—'}</div><div className="text-muted">Səhv</div></div><div className="rounded-lg bg-canvas p-3"><div className="text-xl font-bold">{fmt(quiz.duration_seconds-left)}</div><div className="text-muted">Vaxt</div></div></div><div className="mt-5">{saveState==='saving'&&<p className="flex items-center justify-center gap-2 text-xs text-muted"><Spinner/>Nəticə saxlanılır…</p>}{saveState==='ok'&&<Alert type="success" className="text-left">Nəticə kabinetinizdə saxlanıldı.</Alert>}{saveState==='error'&&<Alert type="error" className="text-left">Nəticəni saxlamaq mümkün olmadı.</Alert>}</div><button className="btn btn-secondary mt-6" onClick={onExit}>Sınaqlara qayıt</button></div>;
  const current=qs[index];return <div className="mx-auto max-w-2xl"><div className="mb-4 flex items-center justify-between gap-3"><button onClick={onExit} className="text-sm font-medium text-muted">Sınaqlardan çıx</button><span className={`rounded-full px-3 py-1 text-sm font-semibold ${left<30?'bg-danger-soft text-danger':'bg-primary-soft text-primary'}`}><Icon name="clock" className="mr-1 inline h-4 w-4"/>{fmt(left)}</span></div><div className="mb-5" role="progressbar" aria-valuemin={0} aria-valuemax={qs.length} aria-valuenow={index+(picked!==null?1:0)} aria-label="Sınaq irəliləyişi"><div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-primary transition-all" style={{width:`${((index+(picked!==null?1:0))/qs.length)*100}%`}}/></div></div><div className="card p-5 sm:p-7"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Sual {index+1} / {qs.length} · Cavablar avtomatik saxlanır</p><h1 className="mt-2 text-lg font-semibold leading-snug sm:text-xl">{current.question_text}</h1><div className="mt-5 space-y-3" role="group" aria-label="Cavab variantları">{current.options.map((opt,n)=>{const selected=picked===n;return <button key={n} onClick={()=>pick(n)} disabled={picked!==null||savingAnswer} className={`flex min-h-12 w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm font-medium ${selected?'border-primary bg-primary-soft':'border-line bg-surface hover:border-primary'}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${selected?'bg-primary text-white':'bg-canvas text-muted'}`}>{String.fromCharCode(65+n)}</span><span className="min-w-0 flex-1 break-words">{opt}</span>{savingAnswer&&selected&&<Spinner/>}</button>;})}</div>{err&&<Alert type="error" className="mt-4">{err}</Alert>}{picked!==null&&<button onClick={next} className="btn btn-primary btn-lg mt-5 w-full">{index+1>=qs.length?'Nəticəni gör':'Növbəti sual'}<Icon name="arrowRight" className="h-4 w-4"/></button>}</div></div>;
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
