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
  const [answers, setAnswers] = useState([]);
  const [left, setLeft] = useState(quiz.duration_seconds);
  const [done, setDone] = useState(false);
  const saved = useRef(false);

  useEffect(() => {
    supabase.from('quiz_questions').select('*').eq('quiz_id', quiz.id).order('position')
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
    if (done && !saved.current && user && qs.length) {
      saved.current = true;
      supabase.from('quiz_attempts').insert({
        quiz_id: quiz.id, user_id: user.id, correct_count: correct, total_questions: qs.length,
        score_percent: percent, seconds_used: quiz.duration_seconds - Math.max(left, 0), answers
      }).then(() => {});
    }
  }, [done]);

  function pick(idx) {
    if (picked !== null || done) return;
    setPicked(idx);
    setAnswers((a) => [...a, { q: qs[i].id, picked: idx, ok: idx === qs[i].correct_index }]);
  }

  function next() {
    if (i + 1 >= qs.length) setDone(true);
    else { setI(i + 1); setPicked(null); }
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
        <div className="mt-6 flex justify-center gap-3">
          <button className="btn btn-ghost" onClick={onExit}>Sınaqlar</button>
          <button className="btn btn-primary" onClick={() => { setI(0); setPicked(null); setAnswers([]); setLeft(quiz.duration_seconds); saved.current = false; setDone(false); }}>Yenidən başla</button>
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
            if (picked !== null) {
              if (idx === cur.correct_index) cls = 'border-emerald-500 bg-emerald-50 text-emerald-800';
              else if (idx === picked) cls = 'border-red-400 bg-red-50 text-red-700';
              else cls = 'border-slate-200 bg-white opacity-60';
            }
            return (
              <button key={idx} onClick={() => pick(idx)} disabled={picked !== null}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${cls}`}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{String.fromCharCode(65 + idx)}</span>
                {opt}
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <div className="mt-5">
            <p className={`text-sm font-semibold ${picked === cur.correct_index ? 'text-emerald-600' : 'text-red-600'}`}>
              {picked === cur.correct_index ? '✓ Düzgün!' : '✗ Səhv cavab'}
            </p>
            {cur.explanation && <p className="mt-1 text-sm text-slate-500">{cur.explanation}</p>}
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
