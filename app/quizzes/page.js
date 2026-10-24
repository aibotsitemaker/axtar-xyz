'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import AdSlot from '../../components/AdSlot';

const CATS = ['', 'DİM', 'Magistr', 'IELTS', 'Universitet', 'Digər'];
const fmt = (s) => `${String(Math.floor(Math.max(s, 0) / 60)).padStart(2, '0')}:${String(Math.max(s, 0) % 60).padStart(2, '0')}`;

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

  if (qs.length === 0) return <p className="py-16 text-center text-slate-400">Suallar yüklənir...</p>;

  if (done) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border-8 border-brand text-3xl font-bold text-brand">{percent}%</div>
        <h2 className="mt-5 text-xl font-bold">{percent >= 70 ? 'Əla nəticə!' : percent >= 40 ? 'Yaxşı cəhd!' : 'Təkrar çalışın!'}</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-emerald-50 p-3"><div className="text-xl font-bold text-emerald-700">{correct}</div>Düzgün</div>
          <div className="rounded-xl bg-red-50 p-3"><div className="text-xl font-bold text-red-600">{qs.length - correct}</div>Səhv</div>
          <div className="rounded-xl bg-slate-100 p-3"><div className="text-xl font-bold">{fmt(quiz.duration_seconds - left)}</div>Vaxt</div>
        </div>
        {!user && <p className="mt-4 text-xs text-slate-400">Nəticələrinizin saxlanması üçün daxil olun.</p>}
        {user && saveState === 'ok' && <p className="mt-4 text-xs text-emerald-600">Nəticə kabinetinizdə saxlanıldı.</p>}
        {user && saveState === 'error' && <p className="mt-4 text-xs text-red-500">Nəticə saxlanmadı (limit və ya bağlantı problemi).</p>}
        <div className="mt-6 flex justify-center gap-3">
          <button className="btn btn-ghost" onClick={onExit}>Sınaqlar</button>
          <button className="btn btn-primary" onClick={restart}>Yenidən başla</button>
        </div>
      </div>
    );
  }

  const cur = qs[i];
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onExit} className="text-sm text-slate-500 hover:text-ink">← Çıx</button>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${left < 30 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>⏱ {fmt(left)}</span>
      </div>
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((i + (picked !== null ? 1 : 0)) / qs.length) * 100}%` }} />
      </div>
      <div className="card p-5 md:p-7">
        <p className="text-xs font-medium text-slate-400">Sual {i + 1} / {qs.length}</p>
        <h2 className="mt-2 text-lg font-semibold">{cur.question_text}</h2>
        <div className="mt-5 space-y-3">
          {cur.options.map((opt, idx) => {
            let cls = 'border-slate-200 bg-white hover:border-brand';
            if (picked !== null && fb) {
              if (idx === fb.r_index) cls = 'border-emerald-500 bg-emerald-50 text-emerald-800';
              else if (idx === picked) cls = 'border-red-400 bg-red-50 text-red-700';
              else cls = 'border-slate-200 bg-white opacity-60';
            }
            return (
              <button key={idx} onClick={() => pick(idx)} disabled={picked !== null || checking}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${cls}`}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{String.fromCharCode(65 + idx)}</span>
                {opt}
              </button>
            );
          })}
        </div>
        {err && <p className="mt-4 text-sm text-red-600">{err}</p>}
        {picked !== null && fb && (
          <div className="mt-5">
            <p className={`text-sm font-semibold ${fb.r_correct ? 'text-emerald-600' : 'text-red-600'}`}>
              {fb.r_correct ? '✓ Düzgün!' : '✗ Səhv cavab'}
            </p>
            {fb.r_explanation && <p className="mt-1 text-sm text-slate-500">{fb.r_explanation}</p>}
            <button onClick={next} className="btn btn-primary mt-4 w-full">{i + 1 >= qs.length ? 'Nəticəni gör' : 'Növbəti sual'}</button>
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
      <h1 className="text-2xl font-bold tracking-tight">Onlayn Sınaqlar</h1>
      <p className="mb-5 text-sm text-slate-500">Taymerli testlər, dərhal nəticə</p>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {CATS.map((c) => (
          <button key={c || 'all'} onClick={() => setCat(c)}
            className={`btn shrink-0 !py-1.5 ${cat === c ? 'btn-primary' : 'btn-ghost'}`}>{c || 'Hamısı'}</button>
        ))}
      </div>
      {loading ? <p className="py-16 text-center text-slate-400">Yüklənir...</p>
        : quizzes.length === 0 ? <p className="py-16 text-center text-slate-400">Sınaq tapılmadı.</p>
        : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((z) => (
            <div key={z.id} className="card flex flex-col p-5">
              <span className="chip self-start">{z.category}</span>
              <h3 className="mt-3 font-semibold">{z.title}</h3>
              <p className="mt-1 flex-1 text-sm text-slate-500">{z.description}</p>
              <p className="mt-3 text-xs text-slate-400">{z.quiz_questions?.[0]?.count ?? 0} sual · ⏱ {Math.round(z.duration_seconds / 60)} dəq</p>
              <button onClick={() => setActive(z)} className="btn btn-primary mt-4">Başla</button>
            </div>
          ))}
        </div>
      )}
      <AdSlot />
    </div>
  );
}
