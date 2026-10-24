process.on('unhandledRejection',e=>{console.log('ERROR:',String(e.message||e).split('\n')[0].slice(0,300));process.exit(2)});
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';

const R = new URL('../../', import.meta.url).pathname;
const sql = (f) => fs.readFileSync(R + f, 'utf8');

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
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
`;

const log = []; let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; log.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  -> ' + extra}`); };

async function fresh() {
  const db = new PGlite({ extensions: { pg_trgm, pgcrypto } });
  await db.exec(STUBS);
  await db.exec(sql('01_supabase_schema.sql'));
  return db;
}
async function q(db, uid, role, text) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid || ''}',false);`);
  try { return await db.query(text); }
  finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`); }
}
async function fails(db, uid, role, text, re) {
  try { await q(db, uid, role, text); return { failed: false, msg: '' }; }
  catch (e) { return { failed: true, msg: String(e.message), match: re ? re.test(e.message) : true }; }
}
const expectFail = async (name, db, uid, role, text, re) => {
  const r = await fails(db, uid, role, text, re);
  ok(name, r.failed && r.match, r.failed ? `wrong error: ${r.msg}` : 'statement unexpectedly succeeded');
};
const val = async (db, text) => (await db.query(text)).rows;

const FP = `select md5(string_agg(x, '|' order by x)) as fp from (
 select 'fn:'||p.proname||':'||pg_get_function_identity_arguments(p.oid)||':'||md5(p.prosrc) as x from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 union all select 'pol:'||schemaname||'.'||tablename||'.'||policyname||':'||coalesce(qual,'')||':'||coalesce(with_check,'') from pg_policies where schemaname in ('public','storage')
 union all select 'trg:'||c.relname||'.'||t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname='public'
 union all select 'col:'||table_name||'.'||column_name||':'||data_type from information_schema.columns where table_schema='public'
 union all select 'con:'||conrelid::regclass::text||'.'||conname from pg_constraint where connamespace='public'::regnamespace
 union all select 'idx:'||indexname from pg_indexes where schemaname='public'
 union all select 'priv:'||v.tbl||'.'||v.col||'.'||v.r||':'||has_column_privilege(v.r,'public.'||v.tbl,v.col,'select')::text from (values ('quiz_questions','correct_index','anon'),('quiz_questions','explanation','authenticated'),('profiles','role','anon'),('profiles','role','authenticated')) as v(tbl,col,r)
) s`;

const U = { A: 'a0000000-0000-0000-0000-00000000000a', B: 'b0000000-0000-0000-0000-00000000000b', C: 'c0000000-0000-0000-0000-00000000000c', ADM: 'd0000000-0000-0000-0000-0000000000ad' };

const base = await fresh();
const baselineFp = (await val(base, FP))[0].fp;

const db = await fresh();
for (const [k, id] of Object.entries(U)) await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values ('${id}','${k}@test.az', jsonb_build_object('full_name','User ${k}'))`);
await db.exec(`update public.profiles set role='admin' where id='${U.ADM}'`);
ok('01 schema applies; auth trigger creates profiles', (await val(db, `select count(*)::int c from public.profiles`))[0].c === 4);
ok('realtime publication contains chat_messages', (await val(db, `select count(*)::int c from pg_publication_tables where pubname='supabase_realtime' and tablename='chat_messages'`))[0].c === 1);

// ---------- BASELINE (deployed v2 state): demonstrate the holes
await q(db, U.A, 'authenticated', `insert into books(seller_id,title,category,price,image_urls,view_count) values ('${U.A}','Riyaziyyat 11','DİM',10,'{https://x.co/a.jpg}',999)`);
await q(db, U.A, 'authenticated', `insert into books(seller_id,title,category,price,image_urls) values ('${U.A}','EVIL','DİM',1,'{javascript:alert(1)}')`);
await q(db, U.A, 'authenticated', `insert into pdfs(uploader_id,title,level,subject,file_url) values ('${U.A}','Legacy http pdf','DİM','Riyaziyyat','http://old.example/a.pdf')`);
ok('BASELINE hole: counter forging accepted (view_count=999)', (await val(db, `select view_count from books where title='Riyaziyyat 11'`))[0].view_count === 999);
ok('BASELINE hole: javascript: URL accepted in books.image_urls', (await val(db, `select count(*)::int c from books where title='EVIL'`))[0].c === 1);
const hq = await q(db, null, 'anon', `select correct_index from quiz_questions limit 1`);
ok('BASELINE hole: anon reads quiz correct answers', hq.rows.length === 1);
const hr = await q(db, null, 'anon', `select role from profiles where role='admin'`);
ok('BASELINE hole: anon can see admin role', hr.rows.length === 1);

const quizId = (await val(db, `select id from quizzes where category='DİM'`))[0].id;
const qs = (await val(db, `select q.id, q.correct_index from quiz_questions q where q.quiz_id='${quizId}' order by q.position`));
await q(db, U.B, 'authenticated', `insert into quiz_attempts(quiz_id,user_id,correct_count,total_questions,score_percent) values ('${quizId}','${U.B}',5,5,100)`);
ok('BASELINE hole: user inserts forged quiz score directly', (await val(db, `select count(*)::int c from quiz_attempts`))[0].c === 1);
await db.exec(`delete from quiz_attempts`);

// ---------- PREFLIGHT
const pre = await db.exec(sql('00_preflight_readonly.sql'));
ok('00 preflight runs read-only without errors', Array.isArray(pre) && pre.length === 4);
ok('00 preflight flags non-https rows (EVIL image + legacy pdf)', pre[2].rows.length === 2, JSON.stringify(pre[2].rows));
await db.exec(`delete from books where title='EVIL'`);

// favorites constraints
await q(db, U.B, 'authenticated', `insert into favorites(user_id,item_type,book_id) select '${U.B}','book',id from books where title='Riyaziyyat 11'`);
await expectFail('favorites: duplicate favorite rejected', db, U.B, 'authenticated', `insert into favorites(user_id,item_type,book_id) select '${U.B}','book',id from books where title='Riyaziyyat 11'`, /unique|duplicate/i);
await expectFail('favorites: cannot favorite as another user (RLS)', db, U.B, 'authenticated', `insert into favorites(user_id,item_type,book_id) select '${U.A}','book',id from books limit 1`, /row-level security/);

const countsBefore = (await val(db, `select (select count(*) from books)::int b, (select count(*) from pdfs)::int p, (select count(*) from favorites)::int f`))[0];

// ---------- PHASE 1
await db.exec(sql('02_hardening_phase1.sql'));
await db.exec(sql('02_hardening_phase1.sql'));
ok('02 phase 1 applies and is idempotent (2nd run ok)', true);
const countsAfter1 = (await val(db, `select (select count(*) from books)::int b, (select count(*) from pdfs)::int p, (select count(*) from favorites)::int f`))[0];
ok('02 phase 1 loses no data (books/pdfs/favorites counts unchanged)', JSON.stringify(countsBefore) === JSON.stringify(countsAfter1));
ok('legacy row still readable after phase 1', (await val(db, `select count(*)::int c from pdfs where title='Legacy http pdf'`))[0].c === 1);
await expectFail('KNOWN LIMIT: editing a legacy non-https row is blocked by NOT VALID check', db, null, 'postgres', `update pdfs set title='x' where title='Legacy http pdf'`, /check constraint/);

await expectFail('javascript: URL in pdfs.file_url rejected', db, U.A, 'authenticated', `insert into pdfs(uploader_id,title,level,subject,file_url) values ('${U.A}','bad','DİM','x','javascript:alert(1)')`, /check constraint/);
await expectFail('javascript: URL in books.image_urls rejected', db, U.A, 'authenticated', `insert into books(seller_id,title,category,price,image_urls) values ('${U.A}','bad','DİM',1,'{javascript:alert(1)}')`, /check constraint/);
await q(db, U.A, 'authenticated', `insert into books(seller_id,title,category,price,image_urls,view_count) values ('${U.A}','Fizika 10','DİM',8,'{https://x.co/b.jpg}',777)`);
ok('counter forging on INSERT is neutralised (stored as 0)', (await val(db, `select view_count from books where title='Fizika 10'`))[0].view_count === 0);
await q(db, U.A, 'authenticated', `update books set view_count=5000 where title='Fizika 10'`);
ok('counter forging on UPDATE is neutralised', (await val(db, `select view_count from books where title='Fizika 10'`))[0].view_count === 0);

const bookId = (await val(db, `select id from books where title='Fizika 10'`))[0].id;
await q(db, U.B, 'authenticated', `select increment_book_view('${bookId}')`);
await q(db, U.B, 'authenticated', `select increment_book_view('${bookId}')`);
ok('view counted once per user per day', (await val(db, `select view_count from books where id='${bookId}'`))[0].view_count === 1);
await q(db, U.C, 'authenticated', `select increment_book_view('${bookId}')`);
await q(db, U.A, 'authenticated', `select increment_book_view('${bookId}')`);
await q(db, null, 'anon', `select increment_book_view('${bookId}')`);
ok('other user counted; seller and anonymous not counted; anon call raises no error', (await val(db, `select view_count from books where id='${bookId}'`))[0].view_count === 2);

await q(db, U.A, 'authenticated', `insert into pdfs(uploader_id,title,level,subject,file_url,year) values ('${U.A}','Konspekt','DİM','Riyaziyyat','https://x.co/k.pdf',2025)`);
const pdfId = (await val(db, `select id from pdfs where title='Konspekt'`))[0].id;
for (let i = 0; i < 2; i++) { await q(db, U.B, 'authenticated', `select increment_pdf_view('${pdfId}'), increment_pdf_download('${pdfId}')`); }
const pc = (await val(db, `select view_count v, download_count d from pdfs where id='${pdfId}'`))[0];
ok('pdf view/download counted once per user per day', pc.v === 1 && pc.d === 1, JSON.stringify(pc));
await q(db, U.A, 'authenticated', `update pdfs set download_count=9999 where id='${pdfId}'`);
ok('pdf download_count forging neutralised', (await val(db, `select download_count d from pdfs where id='${pdfId}'`))[0].d === 1);

// chat
const conv = (await q(db, U.B, 'authenticated', `select get_or_create_conversation('${U.A}','${bookId}') as id`)).rows[0].id;
const conv2 = (await q(db, U.B, 'authenticated', `select get_or_create_conversation('${U.A}','${bookId}') as id`)).rows[0].id;
ok('conversation is reused for same pair+book', conv === conv2);
ok('conversation records created_by', (await val(db, `select created_by from conversations where id='${conv}'`))[0].created_by === U.B);
await expectFail('chat: cannot attach conversation to a book of someone else', db, U.B, 'authenticated', `select get_or_create_conversation('${U.C}','${bookId}')`, /Elan bu istifadəçiyə aid deyil/);
await expectFail('chat: non-existent user rejected', db, U.B, 'authenticated', `select get_or_create_conversation('99999999-9999-9999-9999-999999999999')`, /İstifadəçi tapılmadı/);
await expectFail('chat: self conversation rejected', db, U.B, 'authenticated', `select get_or_create_conversation('${U.B}')`, /Özünüzlə/);
await expectFail('chat: anonymous cannot open conversation', db, null, 'anon', `select get_or_create_conversation('${U.A}')`, /Giriş tələb olunur|permission denied/);
for (let i = 0; i < 20; i++) await q(db, U.B, 'authenticated', `insert into chat_messages(conversation_id,sender_id,content) values ('${conv}','${U.B}','mesaj ${i}')`);
await expectFail('chat: 21st message within a minute is rate-limited', db, U.B, 'authenticated', `insert into chat_messages(conversation_id,sender_id,content) values ('${conv}','${U.B}','spam')`, /Çox tez mesaj/);
await expectFail('chat: stranger cannot post into someone else conversation (RLS)', db, U.C, 'authenticated', `insert into chat_messages(conversation_id,sender_id,content) values ('${conv}','${U.C}','hi')`, /row-level security/);
await expectFail('chat: cannot spoof sender_id (RLS)', db, U.A, 'authenticated', `insert into chat_messages(conversation_id,sender_id,content) values ('${conv}','${U.C}','hi')`, /row-level security/);
ok('chat: stranger cannot read messages', (await q(db, U.C, 'authenticated', `select * from chat_messages where conversation_id='${conv}'`)).rows.length === 0);
await q(db, U.A, 'authenticated', `update chat_messages set content='hack', is_read=true where conversation_id='${conv}' and sender_id='${U.B}'`);
const m = (await val(db, `select count(*) filter (where is_read)::int r, count(*) filter (where content='hack')::int h from chat_messages where conversation_id='${conv}'`))[0];
ok('chat: recipient can mark read but cannot rewrite content', m.r === 20 && m.h === 0, JSON.stringify(m));
ok('unread_message_count RPC works for recipient', (await q(db, U.A, 'authenticated', `select unread_message_count() as n`)).rows[0].n === 0);

// new-conversation rate limit
await db.exec(`insert into auth.users(id,email) select ('e0000000-0000-0000-0000-0000000000' || lpad(g::text,2,'0'))::uuid, 'd'||g||'@t.az' from generate_series(10,22) g`);
let created = 0, lastErr = '';
for (let g = 10; g <= 22; g++) {
  try { await q(db, U.C, 'authenticated', `select get_or_create_conversation('e0000000-0000-0000-0000-0000000000${g}')`); created++; } catch (e) { lastErr = e.message; break; }
}
ok('chat: new conversations limited to 10 per hour per user', created === 10 && /Çox sayda yeni söhbət/.test(lastErr), `created=${created} err=${lastErr}`);

// listing rate limit
let booksOk = 0, bookErr = '';
for (let i = 0; i < 20; i++) {
  try { await q(db, U.A, 'authenticated', `insert into books(seller_id,title,category,price) values ('${U.A}','Kitab ${i}','Digər',1)`); booksOk++; } catch (e) { bookErr = e.message; break; }
}
ok('books: daily listing limit (15) enforced', /Gündəlik elan limiti/.test(bookErr) && (await val(db, `select count(*)::int c from books where seller_id='${U.A}'`))[0].c === 15, bookErr);

// quiz
const allRight = JSON.stringify(qs.map((x) => ({ q: x.id, picked: x.correct_index })));
const allWrong = JSON.stringify(qs.map((x) => ({ q: x.id, picked: (x.correct_index + 1) % 4 })));
const dup = JSON.stringify([{ q: qs[0].id, picked: qs[0].correct_index }, { q: qs[0].id, picked: qs[0].correct_index }]);
ok('check_answer: anonymous gets correct verdict + explanation', (await q(db, null, 'anon', `select * from check_answer('${qs[0].id}', ${qs[0].correct_index})`)).rows[0].r_correct === true);
ok('check_answer: wrong pick flagged false and returns right index', (await q(db, null, 'anon', `select * from check_answer('${qs[0].id}', ${(qs[0].correct_index + 1) % 4})`)).rows[0].r_index === qs[0].correct_index);
const s1 = (await q(db, U.B, 'authenticated', `select * from submit_quiz_attempt('${quizId}', '${allRight}'::jsonb, 120)`)).rows[0];
ok('submit_quiz_attempt: all correct = 100%', s1.r_correct === 5 && s1.r_total === 5 && Number(s1.r_percent) === 100, JSON.stringify(s1));
const s2 = (await q(db, U.B, 'authenticated', `select * from submit_quiz_attempt('${quizId}', '${allWrong}'::jsonb, 120)`)).rows[0];
ok('submit_quiz_attempt: all wrong = 0%', s2.r_correct === 0, JSON.stringify(s2));
const s3 = (await q(db, U.B, 'authenticated', `select * from submit_quiz_attempt('${quizId}', '${dup}'::jsonb, 99999)`)).rows[0];
ok('submit_quiz_attempt: duplicate answers to one question count once', s3.r_correct === 1, JSON.stringify(s3));
ok('submit_quiz_attempt: seconds clamped to quiz duration', (await val(db, `select max(seconds_used)::int m from quiz_attempts`))[0].m <= 300);
await expectFail('submit_quiz_attempt: non-array rejected', db, U.B, 'authenticated', `select * from submit_quiz_attempt('${quizId}', '{}'::jsonb, 1)`, /Yanlış cavab formatı/);
await expectFail('submit_quiz_attempt: anonymous denied', db, null, 'anon', `select * from submit_quiz_attempt('${quizId}', '[]'::jsonb, 1)`, /permission denied/);
ok('PHASE-1 compat: old frontend queries still work (select * quiz_questions / profiles)', (await q(db, null, 'anon', `select * from quiz_questions limit 1`)).rows.length === 1 && (await q(db, null, 'anon', `select * from profiles limit 1`)).rows.length === 1);

// ---------- PHASE 2
await db.exec(sql('03_hardening_phase2.sql'));
await db.exec(sql('03_hardening_phase2.sql'));
ok('03 phase 2 applies and is idempotent', true);
await expectFail('anon cannot read quiz correct_index', db, null, 'anon', `select correct_index from quiz_questions`, /permission denied/);
await expectFail('anon cannot read quiz explanation', db, null, 'anon', `select explanation from quiz_questions`, /permission denied/);
await expectFail('KNOWN: select * on quiz_questions now fails (v2 frontend would break; v3 selects columns)', db, null, 'anon', `select * from quiz_questions`, /permission denied/);
ok('safe quiz columns + count(*) still readable', (await q(db, null, 'anon', `select id, question_text, options from quiz_questions`)).rows.length === 15 && (await q(db, null, 'anon', `select z.title, count(*) from quizzes z join quiz_questions q on q.quiz_id=z.id group by z.title`)).rows.length === 3);
await expectFail('anon cannot read profiles.role', db, null, 'anon', `select role from profiles`, /permission denied/);
ok('public profile columns + books->profiles join still work', (await q(db, null, 'anon', `select b.title, p.full_name from books b join profiles p on p.id=b.seller_id limit 1`)).rows.length === 1);
await expectFail('forged quiz attempt via direct insert blocked', db, U.B, 'authenticated', `insert into quiz_attempts(quiz_id,user_id,correct_count,total_questions,score_percent) values ('${quizId}','${U.B}',5,5,100)`, /row-level security/);
await expectFail('direct conversation insert blocked (RPC only)', db, U.B, 'authenticated', `insert into conversations(user_a,user_b) values ('${U.A}','${U.B}')`, /row-level security/);
ok('RPC still opens conversations after lockdown', (await q(db, U.B, 'authenticated', `select get_or_create_conversation('${U.A}','${bookId}') as id`)).rows[0].id === conv);
ok('submit_quiz_attempt still works after lockdown', (await q(db, U.B, 'authenticated', `select * from submit_quiz_attempt('${quizId}', '${allRight}'::jsonb, 10)`)).rows[0].r_correct === 5);
ok('user can read own quiz attempts, not others', (await q(db, U.C, 'authenticated', `select * from quiz_attempts`)).rows.length === 0 && (await q(db, U.B, 'authenticated', `select * from quiz_attempts`)).rows.length >= 1);
await q(db, U.A, 'authenticated', `update profiles set full_name='Yeni Ad', role='admin' where id='${U.A}'`);
const pr = (await val(db, `select full_name, role from profiles where id='${U.A}'`))[0];
ok('profile edit works but role escalation is ignored', pr.full_name === 'Yeni Ad' && pr.role === 'user', JSON.stringify(pr));
ok('is_admin(): admin true, regular false', (await q(db, U.ADM, 'authenticated', `select is_admin() a`)).rows[0].a === true && (await q(db, U.A, 'authenticated', `select is_admin() a`)).rows[0].a === false);
ok("update of someone else's book affects 0 rows", (await q(db, U.C, 'authenticated', `update books set title='hijack' where id='${bookId}' returning id`)).rows.length === 0);
ok("delete of someone else's pdf affects 0 rows", (await q(db, U.C, 'authenticated', `delete from pdfs where id='${pdfId}' returning id`)).rows.length === 0);
ok('legal documents publicly readable', (await q(db, null, 'anon', `select * from privacy_policy_terms`)).rows.length === 2);
ok('anon cannot modify legal documents (0 rows, content intact)', (await q(db, null, 'anon', `update privacy_policy_terms set content='x' returning id`)).rows.length === 0 && (await val(db, `select count(*)::int c from privacy_policy_terms where content='x'`))[0].c === 0);

// storage
await db.exec(`insert into storage.objects(bucket_id,name,owner) values ('pdf-files','${U.A}/x.pdf','${U.A}')`);
ok('storage: anonymous cannot list files', (await q(db, null, 'anon', `select * from storage.objects`)).rows.length === 0);
ok('storage: owner can see own folder only', (await q(db, U.A, 'authenticated', `select * from storage.objects`)).rows.length === 1 && (await q(db, U.B, 'authenticated', `select * from storage.objects`)).rows.length === 0);
await q(db, U.A, 'authenticated', `insert into storage.objects(bucket_id,name,owner) values ('book-images','${U.A}/ok.jpg','${U.A}')`);
await expectFail("storage: cannot upload into another user's folder", db, U.A, 'authenticated', `insert into storage.objects(bucket_id,name,owner) values ('book-images','${U.B}/evil.jpg','${U.A}')`, /row-level security/);

// favorites / account deletion
const bBefore = (await val(db, `select (select count(*) from books where seller_id='${U.A}')::int a_books`))[0].a_books;
await expectFail('delete_my_account: anonymous denied', db, null, 'anon', `select delete_my_account()`, /permission denied/);
await q(db, U.B, 'authenticated', `select delete_my_account()`);
const gone = (await val(db, `select (select count(*) from auth.users where id='${U.B}')::int u, (select count(*) from profiles where id='${U.B}')::int p, (select count(*) from favorites where user_id='${U.B}')::int f, (select count(*) from chat_messages where sender_id='${U.B}')::int m, (select count(*) from quiz_attempts where user_id='${U.B}')::int a, (select count(*) from books where seller_id='${U.A}')::int ab`))[0];
ok('delete_my_account: removes user, profile, favorites, messages, attempts (cascade)', gone.u === 0 && gone.p === 0 && gone.f === 0 && gone.m === 0 && gone.a === 0, JSON.stringify(gone));
ok("delete_my_account: other users' data untouched", gone.ab === bBefore);

// ---------- ROLLBACK
const before = (await val(db, `select (select count(*) from books)::int b, (select count(*) from pdfs)::int p, (select count(*) from chat_messages)::int m, (select count(*) from quiz_attempts)::int a`))[0];
await db.exec(sql('99_rollback.sql'));
await db.exec(sql('99_rollback.sql'));
const after = (await val(db, `select (select count(*) from books)::int b, (select count(*) from pdfs)::int p, (select count(*) from chat_messages)::int m, (select count(*) from quiz_attempts)::int a`))[0];
ok('99 rollback runs (twice) and keeps user data', JSON.stringify(before) === JSON.stringify(after), JSON.stringify({ before, after }));
const fpAfter = (await val(db, FP))[0].fp;
ok('99 rollback restores schema identical to original 01 (functions, policies, triggers, columns, constraints, indexes, column privileges)', fpAfter === baselineFp);
ok('after rollback old frontend works again (select * quiz_questions / profiles)', (await q(db, null, 'anon', `select * from quiz_questions limit 1`)).rows.length === 1 && (await q(db, null, 'anon', `select role from profiles limit 1`)).rows.length === 1);
// re-apply after rollback (round trip)
await db.exec(sql('02_hardening_phase1.sql')); await db.exec(sql('03_hardening_phase2.sql'));
ok('re-applying 02+03 after rollback works (round trip)', true);


// ---------- LEGACY DB (created from the old buggy 01): phase 1 must fix admin assignment
{
  const lg = await fresh();
  await lg.exec(`create or replace function public.protect_profile_role() returns trigger language plpgsql security definer set search_path = public as $$ begin if new.role is distinct from old.role and not public.is_admin() then new.role = old.role; end if; return new; end; $$;`);
  await lg.exec(`insert into auth.users(id,email) values ('${U.ADM}','adm@t.az')`);
  await lg.exec(`update public.profiles set role='admin' where id='${U.ADM}'`);
  const before = (await val(lg, `select role from profiles where id='${U.ADM}'`))[0].role;
  await lg.exec(sql('02_hardening_phase1.sql'));
  await lg.exec(`update public.profiles set role='admin' where id='${U.ADM}'`);
  const afterRole = (await val(lg, `select role from profiles where id='${U.ADM}'`))[0].role;
  ok('LEGACY DB: old trigger blocked admin assignment; phase 1 fixes it', before === 'user' && afterRole === 'admin', before + '->' + afterRole);
}

console.log(log.join('\n'));
console.log(`\nTOTAL: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
