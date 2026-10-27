'use client';
import { useEffect, useRef, useState } from 'react';
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
  const [qs, setQs] = useState([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [fb, setFb] = useState(null);
  const [checking, setChecking] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [left, setLeft] = useState(quiz.duration_seconds);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [saveState, setSaveState] = useState('');
  const saved = useRef(false);

  useEffect(() => {
    supabase.from('quiz_questions').select('id, quiz_id, position, question_text, options')
      .eq('quiz_id', quiz.id).order('position')
      .then(({ data }) => setQs(data || []));
  }, [quiz.id]);

  useEffect(() => {
    if (done || qs.length === 0) return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [done, qs.length]);

  useEffect(() => { if (left <= 0 && !done && qs.length) setDone(true); }, [left, done, qs.length]);

  const correct = answers.filter((a) => a.ok).length;
  const percent = qs.length ? Math.round((correct * 100) / qs.length) : 0;

  useEffect(() => {
    if (!done || saved.current || !user || qs.length === 0) return;
    saved.current = true;
    setSaveState('saving');
    supabase.rpc('submit_quiz_attempt', {
      p_quiz_id: quiz.id,
      p_answers: answers.map((a) => ({ q: a.q, picked: a.picked })),
      p_seconds: quiz.duration_seconds - Math.max(left, 0)
    }).then(({ error }) => setSaveState(error ? 'error' : 'ok'));
    // Yalnız test bitəndə bir dəfə işləməlidir (answers/left həmin anda sabitdir).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  async function pick(idx) {
    if (picked !== null || checking || done) return;
    setChecking(true);
    setErr('');
    const { data, error } = await supabase.rpc('check_answer', { p_question_id: qs[i].id, p_picked: idx });
    setChecking(false);
    const r = data && data[0];
    if (error || !r) { setErr('Cavab yoxlanıla bilmədi. Bağlantınızı yoxlayıb yenidən cəhd edin.'); return; }
    setPicked(idx);
    setFb(r);
    setAnswers((a) => [...a, { q: qs[i].id, picked: idx, ok: r.r_correct }]);
  }

  function next() {
    if (i + 1 >= qs.length) setDone(true);
    else { setI(i + 1); setPicked(null); setFb(null); }
  }

  function restart() {
    setI(0); setPicked(null); setFb(null); setAnswers([]); setErr('');
    setLeft(quiz.duration_seconds); setSaveState(''); saved.current = false; setDone(false);
  }

  if (qs.length === 0) {
    return <div className="mx-auto max-w-2xl space-y-3" aria-busy="true"><div className="skeleton h-10" /><div className="skeleton h-64" /></div>;
  }

  if (done) {
    return (
      <div className="card mx-auto max-w-lg p-6 text-center sm:p-8">
        <Ring percent={percent} />
        <h1 className="mt-5 text-2xl font-bold tracking-tight">{percent >= 70 ? 'Əla nəticə!' : percent >= 40 ? 'Yaxşı cəhd!' : 'Təkrar çalışın!'}</h1>
        <p className="mt-1 text-sm text-muted">{quiz.title}</p>
        <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-success-soft p-3"><div className="text-xl font-bold text-success">{correct}</div><div className="text-muted">Düzgün</div></div>
          <div className="rounded-lg bg-danger-soft p-3"><div className="text-xl font-bold text-danger">{qs.length - correct}</div><div className="text-muted">Səhv</div></div>
          <div className="rounded-lg bg-canvas p-3"><div className="text-xl font-bold">{fmt(quiz.duration_seconds - left)}</div><div className="text-muted">Vaxt</div></div>
        </div>
        <div className="mt-5 space-y-2">
          {!user && <Alert type="info" className="text-left">Nəticələrinizin saxlanması üçün daxil olun.</Alert>}
          {user && saveState === 'saving' && <p className="flex items-center justify-center gap-2 text-xs text-muted"><Spinner />Nəticə saxlanılır...</p>}
          {user && saveState === 'ok' && <Alert type="success" className="text-left">Nəticə kabinetinizdə saxlanıldı.</Alert>}
          {user && saveState === 'error' && <Alert type="error" className="text-left">Nəticə saxlanmadı (limit və ya bağlantı problemi).</Alert>}
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <button className="btn btn-secondary" onClick={onExit}>Sınaqlar</button>
          <button className="btn btn-primary" onClick={restart}><Icon name="rotate" className="h-4 w-4" />Yenidən başla</button>
        </div>
      </div>
    );
  }

  const cur = qs[i];
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button onClick={onExit} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"><Icon name="arrowLeft" className="h-4 w-4" />Çıx</button>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${left < 30 ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary'}`}>
          <Icon name="clock" className="h-4 w-4" />{fmt(left)}
        </span>
      </div>
      <div className="mb-5" role="progressbar" aria-valuemin={0} aria-valuemax={qs.length} aria-valuenow={i + (picked !== null ? 1 : 0)} aria-label="Sınaq irəliləyişi">
        <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((i + (picked !== null ? 1 : 0)) / qs.length) * 100}%` }} /></div>
      </div>
      <div className="card p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sual {i + 1} / {qs.length}</p>
        <h1 className="mt-2 text-lg font-semibold leading-snug sm:text-xl">{cur.question_text}</h1>
        <div className="mt-5 space-y-3" role="group" aria-label="Cavab variantları">
          {cur.options.map((opt, idx) => {
            let cls = 'border-line bg-surface hover:border-primary hover:bg-primary-soft/50';
            let badge = 'bg-canvas text-muted';
            if (picked !== null && fb) {
              if (idx === fb.r_index) { cls = 'border-success bg-success-soft text-ink'; badge = 'bg-success text-white'; }
              else if (idx === picked) { cls = 'border-danger bg-danger-soft text-ink'; badge = 'bg-danger text-white'; }
              else { cls = 'border-line bg-surface opacity-60'; }
            }
            return (
              <button key={idx} onClick={() => pick(idx)} disabled={picked !== null || checking}
                className={`flex min-h-12 w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition-colors sm:text-base ${cls}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${badge}`}>{String.fromCharCode(65 + idx)}</span>
                <span className="min-w-0 flex-1 break-words">{opt}</span>
              </button>
            );
          })}
        </div>
        {err && <Alert type="error" className="mt-4">{err}</Alert>}
        {picked !== null && fb && (
          <div className="mt-5">
            <Alert type={fb.r_correct ? 'success' : 'error'}>
              <p className="font-semibold">{fb.r_correct ? 'Düzgün cavab!' : 'Səhv cavab'}</p>
              {fb.r_explanation && <p className="mt-0.5 text-ink/80">{fb.r_explanation}</p>}
            </Alert>
            <button onClick={next} className="btn btn-primary btn-lg mt-4 w-full">
              {i + 1 >= qs.length ? 'Nəticəni gör' : 'Növbəti sual'}<Icon name="arrowRight" className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuizzesPage() {
  const { user } = useAuth();
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
              <button onClick={() => setActive(z)} className="btn btn-primary mt-4">Başla<Icon name="arrowRight" className="h-4 w-4" /></button>
            </article>
          ))}
        </div>
      )}
      <AdSlot />
    </div>
  );
}
