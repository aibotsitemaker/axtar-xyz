import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const QUIZ_CATEGORIES = ['DİM', 'Magistr', 'IELTS', 'Universitet', 'Digər'];
const DOC_TYPES = ['privacy_policy', 'terms_of_service', 'cookie_policy'];

function serviceClient() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) throw new Error('Server Supabase açarları təyin edilməyib');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authorize(req) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'Giriş tələb olunur', status: 401 };
  const db = serviceClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return { error: 'Sessiya etibarlı deyil', status: 401 };
  const { data: row, error: adminError } = await db.from('platform_admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (adminError || !row) return { error: 'Admin icazəsi tələb olunur', status: 403 };
  return { db, actor: data.user };
}

function validateQuestion(q) {
  return q && typeof q.question_text === 'string' && q.question_text.trim().length >= 3 && q.question_text.length <= 2000 &&
    Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 6 && q.options.every((x) => typeof x === 'string' && x.trim().length > 0 && x.length <= 500) &&
    Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < q.options.length &&
    (q.explanation == null || (typeof q.explanation === 'string' && q.explanation.length <= 4000));
}

async function audit(db, actor, action, targetType, targetId, summary = {}) {
  return db.from('admin_audit_log').insert({ actor_id: actor.id, action, target_type: targetType, target_id: String(targetId), summary });
}

export async function GET(req) {
  let auth;
  try { auth = await authorize(req); } catch (e) { return NextResponse.json({ error: e.message }, { status: 503 }); }
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const kind = new URL(req.url).searchParams.get('kind') || 'quiz';
  if (kind === 'quiz') {
    const { data, error } = await auth.db.from('quizzes').select('id,title,description,category,duration_seconds,is_published,created_at,quiz_questions(count)').order('created_at', { ascending: false }).limit(1000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
  }
  if (kind === 'legal') {
    const { data, error } = await auth.db.from('privacy_policy_terms').select('id,doc_type,title,content,version,language,effective_date,is_active,created_at').order('created_at', { ascending: false }).limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
  }
  return NextResponse.json({ error: 'Məzmun növü yanlışdır' }, { status: 400 });
}

export async function POST(req) {
  let auth;
  try { auth = await authorize(req); } catch (e) { return NextResponse.json({ error: e.message }, { status: 503 }); }
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const length = Number(req.headers.get('content-length') || 0);
  if (length > 1_000_000) return NextResponse.json({ error: 'Sorğu çox böyükdür' }, { status: 413 });
  const body = await req.json().catch(() => null);
  if (body?.kind !== 'quiz') return NextResponse.json({ error: 'Yalnız yeni sınaq yaratmaq mümkündür' }, { status: 400 });
  const quiz = body.quiz || {}; const questions = body.questions;
  if (typeof quiz.title !== 'string' || quiz.title.trim().length < 3 || quiz.title.length > 180 || !QUIZ_CATEGORIES.includes(quiz.category) || !Number.isInteger(quiz.duration_seconds) || quiz.duration_seconds < 30 || quiz.duration_seconds > 14400 || !Array.isArray(questions) || questions.length < 1 || questions.length > 100 || !questions.every(validateQuestion)) {
    return NextResponse.json({ error: 'Sınağın başlıq, kateqoriya, müddət və 1–100 sualını yoxlayın.' }, { status: 400 });
  }
  const { data: created, error } = await auth.db.from('quizzes').insert({
    created_by: auth.actor.id, title: quiz.title.trim(), description: typeof quiz.description === 'string' ? quiz.description.slice(0, 3000) : '',
    category: quiz.category, duration_seconds: quiz.duration_seconds, is_published: quiz.is_published === true
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const rows = questions.map((q, i) => ({ quiz_id: created.id, position: i + 1, question_text: q.question_text.trim(), options: q.options.map((x) => x.trim()), correct_index: q.correct_index, explanation: q.explanation || '' }));
  const saved = await auth.db.from('quiz_questions').insert(rows);
  if (saved.error) {
    await auth.db.from('quizzes').delete().eq('id', created.id);
    return NextResponse.json({ error: saved.error.message }, { status: 400 });
  }
  const auditResult = await audit(auth.db, auth.actor, 'create', 'quiz', created.id, { question_count: rows.length });
  if (auditResult.error) return NextResponse.json({ error: 'Sınaq yaradıldı, lakin audit qeydi yazılmadı. Administratora bildirin.' }, { status: 500 });
  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}

export async function PATCH(req) {
  let auth;
  try { auth = await authorize(req); } catch (e) { return NextResponse.json({ error: e.message }, { status: 503 }); }
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json().catch(() => null);
  if (!body?.id || !['quiz', 'legal'].includes(body.kind) || !body.patch || typeof body.patch !== 'object' || Array.isArray(body.patch)) return NextResponse.json({ error: 'Sorğu yanlışdır' }, { status: 400 });
  const allowed = body.kind === 'quiz' ? ['title', 'description', 'category', 'duration_seconds', 'is_published'] : ['title', 'content', 'version', 'language', 'effective_date', 'is_active'];
  const patch = Object.fromEntries(Object.entries(body.patch).filter(([key]) => allowed.includes(key)));
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Dəyişdiriləcək sahə yoxdur' }, { status: 400 });
  if (body.kind === 'quiz') {
    if (patch.title !== undefined && (typeof patch.title !== 'string' || patch.title.trim().length < 3 || patch.title.length > 180)) return NextResponse.json({ error: 'Sınaq başlığı yanlışdır' }, { status: 400 });
    if (patch.category !== undefined && !QUIZ_CATEGORIES.includes(patch.category)) return NextResponse.json({ error: 'Kateqoriya yanlışdır' }, { status: 400 });
    if (patch.duration_seconds !== undefined && (!Number.isInteger(patch.duration_seconds) || patch.duration_seconds < 30 || patch.duration_seconds > 14400)) return NextResponse.json({ error: 'Müddət yanlışdır' }, { status: 400 });
    if (patch.description !== undefined && typeof patch.description !== 'string') return NextResponse.json({ error: 'Təsvir yanlışdır' }, { status: 400 });
    if (patch.is_published !== undefined && typeof patch.is_published !== 'boolean') return NextResponse.json({ error: 'Status yanlışdır' }, { status: 400 });
  } else {
    if (patch.title !== undefined && (typeof patch.title !== 'string' || patch.title.trim().length < 2 || patch.title.length > 200)) return NextResponse.json({ error: 'Sənəd başlığı yanlışdır' }, { status: 400 });
    if (patch.content !== undefined && (typeof patch.content !== 'string' || patch.content.length < 1 || patch.content.length > 100000)) return NextResponse.json({ error: 'Sənəd mətni yanlışdır' }, { status: 400 });
    if (patch.version !== undefined && (typeof patch.version !== 'string' || patch.version.length > 30)) return NextResponse.json({ error: 'Versiya yanlışdır' }, { status: 400 });
    if (patch.language !== undefined && (typeof patch.language !== 'string' || patch.language.length > 10)) return NextResponse.json({ error: 'Dil yanlışdır' }, { status: 400 });
    if (patch.is_active !== undefined && typeof patch.is_active !== 'boolean') return NextResponse.json({ error: 'Status yanlışdır' }, { status: 400 });
  }
  const table = body.kind === 'quiz' ? 'quizzes' : 'privacy_policy_terms';
  const { error } = await auth.db.from(table).update(patch).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const result = await audit(auth.db, auth.actor, 'update', body.kind, body.id, { fields: Object.keys(patch) });
  if (result.error) return NextResponse.json({ error: 'Dəyişiklik saxlanıldı, lakin audit qeydi yazılmadı. Administratora bildirin.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
