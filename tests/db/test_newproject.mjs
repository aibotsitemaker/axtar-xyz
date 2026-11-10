// Yeni Supabase layihəsi rejimi: cədvəllərə avtomatik GRANT YOXDUR (30 may 2026 davranışı).
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const R = fileURLToPath(new URL('../../', import.meta.url));
const sql = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create publication supabase_realtime;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
-- DİQQƏT: public sxemi üçün default privileges YOXDUR (yeni Supabase davranışı)
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;
grant all on all tables in schema storage to anon, authenticated, service_role;
`;
const log = []; let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; log.push(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : '  -> ' + x}`); };
async function fresh() { const db = new PGlite({ extensions: { pg_trgm, pgcrypto } }); await db.exec(STUBS); await db.exec(sql('01_supabase_schema.sql')); return db; }
async function q(db, uid, role, text) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid || ''}',false);`);
  try { return await db.query(text); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`); }
}
async function expectFail(n, db, uid, role, text, re) {
  try { await q(db, uid, role, text); ok(n, false, 'unexpectedly succeeded'); }
  catch (e) { ok(n, re.test(e.message), e.message.slice(0, 120)); }
}
const val = async (db, t) => (await db.query(t)).rows;
const A = 'a0000000-0000-0000-0000-00000000000a', B = 'b0000000-0000-0000-0000-00000000000b';
const seed = async (db) => { for (const [id, n] of [[A, 'A'], [B, 'B']]) await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values ('${id}','${n}@t.az', jsonb_build_object('full_name','User ${n}'))`); };

// 1) 04-dən əvvəl: istifadəçinin gördüyü xətanı təkrarlayır
const db = await fresh(); await seed(db);
ok('signup trigger still creates profiles without table grants (security definer)', (await val(db, `select count(*)::int c from profiles`))[0].c === 2);
await expectFail('BEFORE 04: PDF insert fails with "permission denied for table pdfs"', db, A, 'authenticated', `insert into pdfs(uploader_id,title,level,subject,file_url) values ('${A}','Konspekt','DİM','Riyaziyyat','https://x.co/k.pdf')`, /permission denied for table pdfs/);
await expectFail('BEFORE 04: anonymous cannot even list quizzes', db, null, 'anon', `select * from quizzes`, /permission denied for table quizzes/);

// 2) 02 + 04
await db.exec(sql('02_hardening_phase1.sql'));
await db.exec(sql('04_grants.sql')); await db.exec(sql('04_grants.sql'));
ok('02 and 04 apply cleanly; 04 idempotent', true);

// 3) Əsas ssenarilər
await q(db, A, 'authenticated', `insert into pdfs(uploader_id,title,level,subject,file_url,year) values ('${A}','Konspekt','DİM','Riyaziyyat','https://x.co/k.pdf',2025)`);
ok('AFTER 04: user uploads a PDF record', (await val(db, `select count(*)::int c from pdfs`))[0].c === 1);
await q(db, A, 'authenticated', `insert into books(seller_id,title,category,price,image_urls) values ('${A}','Fizika 10','DİM',8,'{https://x.co/b.jpg}')`);
ok('anon can list books, pdfs, quizzes, legal docs', (await q(db, null, 'anon', `select (select count(*) from books)::int b, (select count(*) from pdfs)::int p, (select count(*) from quizzes)::int z, (select count(*) from privacy_policy_terms)::int l`)).rows[0].z === 3);
ok('books -> profiles(full_name) join works for anon', (await q(db, null, 'anon', `select b.title, p.full_name from books b join profiles p on p.id=b.seller_id`)).rows.length === 1);
const bookId = (await val(db, `select id from books`))[0].id, pdfId = (await val(db, `select id from pdfs`))[0].id;
await q(db, B, 'authenticated', `insert into favorites(user_id,item_type,book_id) values ('${B}','book','${bookId}')`);
await q(db, B, 'authenticated', `insert into favorites(user_id,item_type,pdf_id) values ('${B}','pdf','${pdfId}')`);
ok('favorites: insert + select + join embeds work', (await q(db, B, 'authenticated', `select f.id, b.title, p.title from favorites f left join books b on b.id=f.book_id left join pdfs p on p.id=f.pdf_id`)).rows.length === 2);
await q(db, B, 'authenticated', `delete from favorites where user_id='${B}' and pdf_id='${pdfId}'`);
ok('favorites: delete works', (await val(db, `select count(*)::int c from favorites`))[0].c === 1);
await q(db, B, 'authenticated', `select increment_book_view('${bookId}'), increment_pdf_view('${pdfId}'), increment_pdf_download('${pdfId}')`);
ok('view/download RPCs executable by authenticated', (await val(db, `select view_count from books`))[0].view_count === 1);
ok('view RPC callable by anon without error', (await q(db, null, 'anon', `select increment_book_view('${bookId}')`)).rows.length === 1);
const conv = (await q(db, B, 'authenticated', `select get_or_create_conversation('${A}','${bookId}') as id`)).rows[0].id;
await q(db, B, 'authenticated', `insert into chat_messages(conversation_id,sender_id,content) values ('${conv}','${B}','Salam')`);
ok('chat: A sees conversation and B message', (await q(db, A, 'authenticated', `select * from conversations`)).rows.length === 1 && (await q(db, A, 'authenticated', `select * from chat_messages`)).rows.length === 1);
ok('chat: unread_message_count RPC works', (await q(db, A, 'authenticated', `select unread_message_count() n`)).rows[0].n === 1);
await q(db, A, 'authenticated', `update chat_messages set is_read=true where conversation_id='${conv}' and sender_id='${B}'`);
ok('chat: recipient marks read', (await val(db, `select is_read from chat_messages`))[0].is_read === true);
await expectFail('chat: cannot update message content (no column grant)', db, A, 'authenticated', `update chat_messages set content='x' where conversation_id='${conv}'`, /permission denied/);
const qz = (await val(db, `select id from quizzes where category='DİM'`))[0].id;
const qq = (await val(db, `select id, correct_index from quiz_questions where quiz_id='${qz}' order by position`));
ok('quiz: anon check_answer RPC works', (await q(db, null, 'anon', `select * from check_answer('${qq[0].id}', ${qq[0].correct_index})`)).rows[0].r_correct === true);
ok('quiz: submit_quiz_attempt works for authenticated', (await q(db, B, 'authenticated', `select * from submit_quiz_attempt('${qz}', '${JSON.stringify(qq.map(x => ({ q: x.id, picked: x.correct_index })))}'::jsonb, 30)`)).rows[0].r_correct === 5);
ok('quiz: user reads own attempts', (await q(db, B, 'authenticated', `select * from quiz_attempts`)).rows.length === 1);
await q(db, A, 'authenticated', `update profiles set full_name='Yeni', city='Bakı', bio='x' where id='${A}'`);
ok('profile: user edits own name/city/bio', (await val(db, `select full_name from profiles where id='${A}'`))[0].full_name === 'Yeni');

// 4) Mənfi yoxlamalar (icazələr həddindən artıq geniş olmamalıdır)
await expectFail('profile: role column cannot be updated by users', db, A, 'authenticated', `update profiles set role='admin' where id='${A}'`, /permission denied/);
await expectFail('anon cannot insert books', db, null, 'anon', `insert into books(seller_id,title,category,price) values ('${A}','x','DİM',1)`, /permission denied/);
await expectFail('anon cannot read chat messages', db, null, 'anon', `select * from chat_messages`, /permission denied/);
await expectFail('anon cannot read favorites', db, null, 'anon', `select * from favorites`, /permission denied/);
await expectFail('nobody can read view_events via API', db, A, 'authenticated', `select * from view_events`, /permission denied/);
await expectFail('users cannot insert quiz attempts directly', db, B, 'authenticated', `insert into quiz_attempts(quiz_id,user_id,correct_count,total_questions,score_percent) values ('${qz}','${B}',5,5,100)`, /permission denied/);
await expectFail('users cannot insert conversations directly', db, B, 'authenticated', `insert into conversations(user_a,user_b) values ('${A}','${B}')`, /permission denied/);
await expectFail('users cannot create quizzes (admin via dashboard only)', db, A, 'authenticated', `insert into quizzes(title,category) values ('x','DİM')`, /permission denied/);
await expectFail('anon cannot call submit_quiz_attempt', db, null, 'anon', `select * from submit_quiz_attempt('${qz}','[]'::jsonb,1)`, /permission denied/);
await expectFail('anon cannot call delete_my_account', db, null, 'anon', `select delete_my_account()`, /permission denied/);

// 5) 03 kilidləməsi
await db.exec(sql('03_hardening_phase2.sql'));
await expectFail('AFTER 03: correct_index hidden', db, null, 'anon', `select correct_index from quiz_questions`, /permission denied/);
await expectFail('AFTER 03: profiles.role hidden', db, null, 'anon', `select role from profiles`, /permission denied/);
ok('AFTER 03: safe quiz columns and profile columns still readable', (await q(db, null, 'anon', `select id, question_text, options from quiz_questions`)).rows.length === 15 && (await q(db, null, 'anon', `select id, full_name, city, bio from profiles`)).rows.length === 2);
await q(db, B, 'authenticated', `select delete_my_account()`);
ok('delete_my_account works after grants', (await val(db, `select count(*)::int c from auth.users where id='${B}'`))[0].c === 0);

// 6) Sıra müstəqilliyi: 04 → 02
const d2 = await fresh(); await seed(d2);
await d2.exec(sql('04_grants.sql')); await d2.exec(sql('02_hardening_phase1.sql')); await d2.exec(sql('03_hardening_phase2.sql'));
const qz2 = (await val(d2, `select id from quizzes where category='DİM'`))[0].id;
const qq2 = (await val(d2, `select id, correct_index from quiz_questions where quiz_id='${qz2}' limit 1`))[0];
ok('order 04 -> 02 -> 03: RPCs and RLS helper functions still executable', (await q(d2, null, 'anon', `select * from check_answer('${qq2.id}', ${qq2.correct_index})`)).rows[0].r_correct === true && (await q(d2, null, 'anon', `select count(*)::int c from books`)).rows[0].c === 0);
await q(d2, A, 'authenticated', `insert into pdfs(uploader_id,title,level,subject,file_url) values ('${A}','Konspekt 2','DİM','Riyaziyyat','https://x.co/a.pdf')`);
ok('order 04 -> 02 -> 03: upload still works', (await val(d2, `select count(*)::int c from pdfs`))[0].c === 1);


// 7) Profili olmayan istifadəçi (trigger qurulmamışdan əvvəl qeydiyyat) -> 05 bərpası
{
  const d3 = await fresh();
  await d3.exec(`drop trigger on_auth_user_created on auth.users`);
  await seed(d3);
  ok('PRE-05: users created while trigger missing have no profile', (await val(d3, `select count(*)::int c from profiles`))[0].c === 0);
  await d3.exec(sql('04_grants.sql'));
  await expectFail('PRE-05: PDF insert fails with pdfs_uploader_id_fkey (the user-reported error)', d3, A, 'authenticated', `insert into pdfs(uploader_id,title,level,subject,file_url) values ('${A}','Konspekt','DİM','Riyaziyyat','https://x.co/k.pdf')`, /pdfs_uploader_id_fkey/);
  const r5 = await d3.exec(sql('05_backfill_profiles.sql')); await d3.exec(sql('05_backfill_profiles.sql'));
  ok('05 runs twice; final check query returns 0 users without profile', r5[r5.length - 1].rows[0].profilsiz_istifadeci === 0 || Number(r5[r5.length - 1].rows[0].profilsiz_istifadeci) === 0);
  ok('05 creates profiles with name from signup metadata', (await val(d3, `select full_name from profiles where id='${A}'`))[0].full_name === 'User A');
  await q(d3, A, 'authenticated', `insert into pdfs(uploader_id,title,level,subject,file_url) values ('${A}','Konspekt','DİM','Riyaziyyat','https://x.co/k.pdf')`);
  ok('AFTER 05: PDF upload record succeeds', (await val(d3, `select count(*)::int c from pdfs`))[0].c === 1);
  await d3.exec(`insert into auth.users(id,email,raw_user_meta_data) values ('c0000000-0000-0000-0000-00000000000c','C@t.az','{}'::jsonb)`);
  ok('AFTER 05: new signups get a profile via the (re)created trigger', (await val(d3, `select count(*)::int c from profiles`))[0].c === 3);
  await d3.exec(`update profiles set full_name='Edited' where id='${A}'`); await d3.exec(sql('05_backfill_profiles.sql'));
  ok('05 never overwrites existing profiles', (await val(d3, `select full_name from profiles where id='${A}'`))[0].full_name === 'Edited');
}

// 8) Forum + user types + admin registry migration
{
  const forum = await fresh(); await seed(forum);
  await forum.exec(sql('02_hardening_phase1.sql'));
  await forum.exec(sql('04_grants.sql'));
  await forum.exec(sql('05_backfill_profiles.sql'));
  await forum.exec(sql('03_hardening_phase2.sql'));
  await forum.exec(sql('06_forum_roles_admin.sql'));
  await forum.exec(sql('06_forum_roles_admin.sql'));
  ok('06 migration applies twice and seeds eight categories', (await val(forum, `select count(*)::int c from forum_categories`))[0].c === 8);
  const cat = (await val(forum, `select id from forum_categories limit 1`))[0].id;
  await q(forum, A, 'authenticated', `insert into forum_topics(author_id,category_id,title,body) values ('${A}',${cat},'Müzakirə mövzusu','Bu mövzu üçün kifayət qədər ətraflı başlanğıc mətni var.')`);
  const topicId = (await val(forum, `select id from forum_topics`))[0].id;
  await q(forum, B, 'authenticated', `insert into forum_replies(topic_id,author_id,body) values ('${topicId}','${B}','Mənim cavabım, bu mövzunu müzakirəyə davam etdirək.')`);
  ok('forum: another signed-in user can reply and topic owner receives notification', (await val(forum, `select count(*)::int c from forum_notifications where user_id='${A}'`))[0].c === 1);
  ok('forum: anon reads public topic and stats RPC', (await q(forum, null, 'anon', `select * from forum_topic_stats(array['${topicId}']::uuid[])`)).rows[0].reply_count === 1);
  ok('forum: server-side search matches topic body', (await q(forum, null, 'anon', `select id from forum_search_topics('ətraflı başlanğıc', null, 'recent', 0, 30)`)).rows[0].id === topicId);
  await q(forum, B, 'authenticated', `update forum_topics set title='Dəyişdirilmiş mövzu' where id='${topicId}'`);
  ok('forum: another user cannot edit owner topic', (await val(forum, `select title from forum_topics where id='${topicId}'`))[0].title === 'Müzakirə mövzusu');
  await expectFail('forum notification: recipient cannot rewrite its target or owner', forum, A, 'authenticated', `update forum_notifications set user_id='${B}' where user_id='${A}'`, /Bildiriş məlumatını dəyişmək olmaz/);
  await expectFail('forum: exact duplicate topic content is rejected', forum, A, 'authenticated', `insert into forum_topics(author_id,category_id,title,body) values ('${A}',${cat},'Təkrar müzakirə','Bu mövzu üçün kifayət qədər ətraflı başlanğıc mətni var.')`, /Eyni məzmun təkrar/);
  for (let i=0;i<9;i++) await q(forum, A, 'authenticated', `insert into forum_topics(author_id,category_id,title,body) values ('${A}',${cat},'Mövzu limit testi ${i}','Unikal test mətni, təkrar deyil: ${i}')`);
  await expectFail('forum: 11th topic in an hour is rejected by database', forum, A, 'authenticated', `insert into forum_topics(author_id,category_id,title,body) values ('${A}',${cat},'Mövzu limit testi son','Unikal son test mətni')`, /Saatlıq mövzu limiti/);
  for (let i=0;i<29;i++) await q(forum, B, 'authenticated', `insert into forum_replies(topic_id,author_id,body) values ('${topicId}','${B}','Unikal test cavabı ${i}')`);
  await expectFail('forum: 31st reply in an hour is rejected by database', forum, B, 'authenticated', `insert into forum_replies(topic_id,author_id,body) values ('${topicId}','${B}','Saatlıq limitdən artıq cavab')`, /Saatlıq cavab limiti/);
  await expectFail('forum: author cannot self-pin or lock topic', forum, A, 'authenticated', `update forum_topics set is_pinned=true where id='${topicId}'`, /Bu mövzu əməliyyatına icazə yoxdur/);
  await q(forum, A, 'authenticated', `update profiles set user_type='teacher' where id='${A}'`);
  ok('user type: profile owner cannot change their own type after signup', (await val(forum, `select user_type from profiles where id='${A}'`))[0].user_type === 'student');
  await forum.exec(`insert into platform_admins(user_id) values ('${A}')`);
  await q(forum, A, 'authenticated', `update forum_topics set is_pinned=true where id='${topicId}'`);
  ok('admin registry permits moderation and records audit', (await val(forum, `select count(*)::int c from admin_audit_log where target_id='${topicId}'`))[0].c === 1);
  await q(forum, A, 'authenticated', `insert into forum_reports(reporter_id,topic_id,reason) values ('${A}','${topicId}','Yoxlanması xahiş edilən uyğun olmayan məzmun')`);
  await expectFail('forum report: duplicate reports from same user are limited', forum, A, 'authenticated', `insert into forum_reports(reporter_id,topic_id,reason) values ('${A}','${topicId}','Eyni hədəfə təkrar şikayət göndərirəm')`, /duplicate key|unique/i);
  await forum.exec(`delete from auth.users where id='${A}'`);
  const preserved = (await val(forum, `select (select count(*)::int from forum_topics where id='${topicId}' and author_id is null) topic_count, (select count(*)::int from forum_replies where topic_id='${topicId}') reply_count`))[0];
  ok('forum: account deletion anonymizes author and preserves topic and replies', preserved.topic_count === 1 && preserved.reply_count === 30);
}

console.log(log.join('\n')); console.log(`\nTOTAL: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
