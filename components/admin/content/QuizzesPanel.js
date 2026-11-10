'use client';
import { useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import ContentFilter from './ContentFilter';
import { Table, Td } from '../Table';
import Icon from '../../Icons';
import { Alert, ConfirmDialog, EmptyState, ListSkeleton, LoadMore, Modal, Spinner } from '../../ui';
import { PAGE } from '../../../lib/admin';
import { usePaged } from '../../../lib/usePaged';
import { errText, fmtDate } from '../../../lib/format';

// Dəyərlər 01_supabase_schema.sql və admin_create_quiz() qaydaları ilə eynidir.
const CATS = ['DİM', 'Magistr', 'IELTS', 'Universitet', 'Digər'];
const STATUSES = [['', 'Hamısı'], ['published', 'Dərc olunub'], ['draft', 'Qaralama']];
const MAX_Q = 50;
const blankQ = () => ({ text: '', options: ['', ''], correct: 0, explanation: '' });
const minutes = (s) => (s % 60 === 0 ? `${s / 60} dəq.` : `${Math.floor(s / 60)} dəq. ${s % 60} san.`);

// İstemci tərəfi yoxlama (server admin_create_quiz() həmin qaydaları təkrar yoxlayır).
function validate(title, mins, questions) {
  if (title.trim().length < 3 || title.trim().length > 150) return 'Sınaq adı 3–150 simvol olmalıdır.';
  const m = Number(mins);
  if (!Number.isFinite(m) || m < 0.5 || m > 240) return 'Müddət 0.5–240 dəqiqə arasında olmalıdır.';
  if (questions.length < 1 || questions.length > MAX_Q) return `Sınaqda 1–${MAX_Q} sual olmalıdır.`;
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const t = q.text.trim();
    if (t.length < 3 || t.length > 500) return `${i + 1}-ci sual: mətn 3–500 simvol olmalıdır.`;
    const opts = q.options.map((o) => o.trim());
    if (opts.length < 2 || opts.length > 6 || opts.some((o) => o.length < 1 || o.length > 300)) return `${i + 1}-ci sual: 2–6 variant olmalıdır (hər biri 1–300 simvol, boş olmaz).`;
    if (q.correct < 0 || q.correct >= opts.length) return `${i + 1}-ci sual: düzgün cavabı seçin.`;
    if (q.explanation.trim().length > 500) return `${i + 1}-ci sual: izah 500 simvoldan çox ola bilməz.`;
  }
  return '';
}

function CreateForm({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATS[0]);
  const [mins, setMins] = useState('10');
  const [qs, setQs] = useState([blankQ()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lock = useRef(false);

  const setQ = (i, patch) => setQs((a) => a.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const setOpt = (i, j, v) => setQs((a) => a.map((q, k) => (k === i ? { ...q, options: q.options.map((o, x) => (x === j ? v : o)) } : q)));
  const addOpt = (i) => setQs((a) => a.map((q, k) => (k === i && q.options.length < 6 ? { ...q, options: [...q.options, ''] } : q)));
  const delOpt = (i, j) => setQs((a) => a.map((q, k) => {
    if (k !== i || q.options.length <= 2) return q;
    const options = q.options.filter((_, x) => x !== j);
    let correct = q.correct;
    if (j < correct) correct -= 1; else if (j === correct) correct = 0;
    return { ...q, options, correct };
  }));

  async function submit(e) {
    e.preventDefault();
    if (lock.current) return;
    const msg = validate(title, mins, qs);
    if (msg) { setErr(msg); return; }
    lock.current = true;
    setBusy(true);
    setErr('');
    const { error } = await supabase.rpc('admin_create_quiz', {
      p_title: title.trim(), p_description: description.trim() || null, p_category: category, p_duration: Math.round(Number(mins) * 60),
      p_questions: qs.map((q) => ({ text: q.text.trim(), options: q.options.map((o) => o.trim()), correct_index: q.correct, explanation: q.explanation.trim() || null }))
    });
    setBusy(false);
    lock.current = false;
    if (error) { setErr(errText(error)); return; }
    onCreated('Sınaq qaralama kimi yaradıldı. İstifadəçilərə göstərmək üçün «Dərc et» düyməsini basın.');
  }

  return (
    <form onSubmit={submit} className="card mb-6 space-y-5 p-5" aria-label="Yeni sınaq" noValidate>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Yeni sınaq</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Bağla</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <label htmlFor="qz-title" className="label">Ad</label>
          <input id="qz-title" className="input" maxLength={150} required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="qz-cat" className="label">Kateqoriya</label>
          <select id="qz-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="qz-mins" className="label">Müddət (dəq.)</label>
          <input id="qz-mins" type="number" inputMode="decimal" min={0.5} max={240} step="0.5" className="input sm:w-28" value={mins} onChange={(e) => setMins(e.target.value)} />
        </div>
      </div>
      <div>
        <label htmlFor="qz-desc" className="label">Təsvir <span className="font-normal text-muted">(könüllü)</span></label>
        <textarea id="qz-desc" rows={2} maxLength={500} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="space-y-4">
        {qs.map((q, i) => (
          <fieldset key={i} className="rounded-xl border border-line p-4">
            <legend className="px-1 text-sm font-semibold">{i + 1}-ci sual</legend>
            <div>
              <label htmlFor={`q-${i}-text`} className="label">Sual mətni</label>
              <textarea id={`q-${i}-text`} rows={2} maxLength={500} className="input" value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
            </div>
            <div className="mt-3 space-y-2" role="radiogroup" aria-label={`${i + 1}-ci sualın variantları; düzgün cavabı seçin`}>
              {q.options.map((o, j) => (
                <div key={j} className="flex items-center gap-2">
                  <input type="radio" name={`q-${i}-correct`} checked={q.correct === j} onChange={() => setQ(i, { correct: j })}
                    aria-label={`${j + 1}-ci variant düzgün cavabdır`} className="h-4 w-4 shrink-0 accent-primary" />
                  <input className="input" maxLength={300} aria-label={`${i + 1}-ci sual, ${j + 1}-ci variant`} placeholder={`Variant ${j + 1}`} value={o} onChange={(e) => setOpt(i, j, e.target.value)} />
                  <button type="button" className="btn btn-ghost btn-sm shrink-0" disabled={q.options.length <= 2} onClick={() => delOpt(i, j)} aria-label={`${j + 1}-ci variantı sil`}><Icon name="x" className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button type="button" className="btn btn-secondary btn-sm" disabled={q.options.length >= 6} onClick={() => addOpt(i)}><Icon name="plus" className="h-4 w-4" />Variant əlavə et</button>
              {qs.length > 1 && <button type="button" className="btn btn-danger btn-sm" onClick={() => setQs((a) => a.filter((_, k) => k !== i))}><Icon name="trash" className="h-4 w-4" />Sualı sil</button>}
            </div>
            <div className="mt-3">
              <label htmlFor={`q-${i}-exp`} className="label">İzah <span className="font-normal text-muted">(könüllü)</span></label>
              <input id={`q-${i}-exp`} className="input" maxLength={500} value={q.explanation} onChange={(e) => setQ(i, { explanation: e.target.value })} />
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn btn-secondary" disabled={qs.length >= MAX_Q} onClick={() => setQs((a) => [...a, blankQ()])}><Icon name="plus" className="h-4 w-4" />Sual əlavə et ({qs.length}/{MAX_Q})</button>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Ləğv et</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}Sınağı yarat</button>
        </div>
      </div>
      {err && <Alert type="error">{err}</Alert>}
    </form>
  );
}

function EditForm({ quiz, onClose, onSaved }) {
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description || '');
  const [category, setCategory] = useState(quiz.category);
  const [mins, setMins] = useState(String(quiz.duration_seconds / 60));
  const [published, setPublished] = useState(quiz.is_published);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lock = useRef(false);

  async function submit(e) {
    e.preventDefault();
    if (lock.current) return;
    const m = Number(mins);
    if (title.trim().length < 3 || title.trim().length > 150) { setErr('Sınaq adı 3–150 simvol olmalıdır.'); return; }
    if (!Number.isFinite(m) || m < 0.5 || m > 240) { setErr('Müddət 0.5–240 dəqiqə arasında olmalıdır.'); return; }
    lock.current = true;
    setBusy(true);
    setErr('');
    const { error } = await supabase.rpc('admin_update_quiz', {
      p_id: quiz.id, p_title: title.trim(), p_description: description.trim() || null, p_category: category, p_duration: Math.round(m * 60), p_published: published
    });
    setBusy(false);
    lock.current = false;
    if (error) { setErr(errText(error)); return; }
    onSaved('Sınaq yeniləndi.');
  }

  return (
    <Modal open onClose={() => { if (!busy) onClose(); }} title="Sınağı redaktə et">
      <form onSubmit={submit} className="mt-3 space-y-4" noValidate>
        <div>
          <label htmlFor="qe-title" className="label">Ad</label>
          <input id="qe-title" className="input" maxLength={150} required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="qe-cat" className="label">Kateqoriya</label>
            <select id="qe-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="qe-mins" className="label">Müddət (dəq.)</label>
            <input id="qe-mins" type="number" inputMode="decimal" min={0.5} max={240} step="0.5" className="input" value={mins} onChange={(e) => setMins(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="qe-desc" className="label">Təsvir</label>
          <textarea id="qe-desc" rows={2} maxLength={500} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 rounded border-line accent-primary" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          İstifadəçilərə göstərilsin (dərc olunub)
        </label>
        <p className="hint">Suallar bu pəncərədən dəyişdirilmir. Sualları dəyişmək lazımdırsa, yeni sınaq yaradın və köhnəni dərcdən çıxarın.</p>
        {err && <Alert type="error">{err}</Alert>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Ləğv et</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}Yadda saxla</button>
        </div>
      </form>
    </Modal>
  );
}

// Sınaqların idarəsi. Yazma yalnız admin RPC-ləri ilə gedir (cədvələ birbaşa yazma icazəsi yoxdur); hər əməliyyat audit jurnalına yazılır.
export default function QuizzesPanel({ onFlash }) {
  const [f, setF] = useState({ q: '', status: '' });
  const [creating, setCreating] = useState(false);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [delErr, setDelErr] = useState('');
  const [pending, setPending] = useState('');

  const list = usePaged((from, to) => {
    let q = supabase.from('quizzes').select('id, title, description, category, duration_seconds, is_published, created_at, quiz_questions(count)', from === 0 ? { count: 'exact' } : undefined);
    if (f.status) q = q.eq('is_published', f.status === 'published');
    if (f.q) q = q.ilike('title', `%${f.q}%`);
    return q.order('created_at', { ascending: false }).range(from, to);
  }, PAGE, `${f.q}|${f.status}`);

  async function togglePublish(z) {
    if (pending) return;
    setPending(z.id);
    const { error } = await supabase.rpc('admin_update_quiz', {
      p_id: z.id, p_title: z.title, p_description: z.description, p_category: z.category, p_duration: z.duration_seconds, p_published: !z.is_published
    });
    setPending('');
    if (error) { onFlash('error', errText(error)); return; }
    onFlash('success', z.is_published ? 'Sınaq dərcdən çıxarıldı.' : 'Sınaq dərc olundu.');
    list.reload();
  }

  async function remove() {
    setBusy(true);
    setDelErr('');
    const { error } = await supabase.rpc('admin_delete_quiz', { p_id: del.id });
    setBusy(false);
    if (error) { setDelErr(errText(error)); return; }
    setDel(null);
    onFlash('success', 'Sınaq silindi və audit jurnalına yazıldı.');
    list.reload();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">{list.loading ? 'Yüklənir…' : `${list.total} sınaq`}</p>
        {!creating && <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Icon name="plus" className="h-4 w-4" />Yeni sınaq</button>}
      </div>
      {creating && <CreateForm onClose={() => setCreating(false)} onCreated={(m) => { setCreating(false); onFlash('success', m); list.reload(); }} />}
      <ContentFilter f={f} onApply={(n) => setF((p) => ({ ...p, ...n }))} label="Sınaq axtarışı" placeholder="Sınaq adı axtarın..." statuses={STATUSES} />
      {list.error && <Alert type="error" className="mb-4">{list.error}</Alert>}
      {list.loading ? <ListSkeleton count={3} /> : list.rows.length === 0 && !list.error ? (
        <EmptyState icon="quiz" title="Sınaq tapılmadı" text="Yeni sınaq yaradın və ya filtrləri dəyişin." />
      ) : list.rows.length > 0 && (
        <Table label="Sınaqlar" head={['Sınaq', 'Kateqoriya', 'Suallar', 'Müddət', 'Tarix', 'Status', 'Əməliyyatlar']}>
          {list.rows.map((z) => (
            <tr key={z.id} data-testid="quiz-row">
              <Td className="max-w-xs break-words font-medium">{z.title}</Td>
              <Td className="text-muted">{z.category}</Td>
              <Td className="text-muted">{z.quiz_questions?.[0]?.count ?? '—'}</Td>
              <Td className="whitespace-nowrap text-muted">{minutes(z.duration_seconds)}</Td>
              <Td className="whitespace-nowrap text-muted">{fmtDate(z.created_at)}</Td>
              <Td>{z.is_published ? <span className="badge">Dərc olunub</span> : <span className="badge badge-muted">Qaralama</span>}</Td>
              <Td>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <button className="btn btn-secondary btn-sm" onClick={() => setEdit(z)}>Redaktə</button>
                  <button className="btn btn-secondary btn-sm" disabled={!!pending} onClick={() => togglePublish(z)}>{z.is_published ? 'Dərcdən çıxar' : 'Dərc et'}</button>
                  <button className="btn btn-danger btn-sm" onClick={() => { setDel(z); setDelErr(''); }}>Sil</button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <LoadMore onClick={list.more} loading={list.moreLoading} hasMore={list.hasMore} />

      {edit && <EditForm key={edit.id} quiz={edit} onClose={() => setEdit(null)} onSaved={(m) => { setEdit(null); onFlash('success', m); list.reload(); }} />}
      <ConfirmDialog open={!!del} danger busy={busy} error={delErr} title="Sınaq silinsin?" confirmLabel="Sil" onConfirm={remove} onClose={() => setDel(null)}>
        «{del?.title}» sınağı, bütün sualları və istifadəçilərin bu sınaq üzrə nəticələri həmişəlik silinəcək. Əvəzinə «Dərcdən çıxar» seçimi məlumatı saxlayır.
      </ConfirmDialog>
    </div>
  );
}
