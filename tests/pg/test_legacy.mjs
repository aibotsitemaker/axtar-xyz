// Mövcud (v4.0) istifadəçiləri və məlumatı olan bazaya 06 → 07 → 08 tətbiqi, təkrar icra və 98 geri qaytarma.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, run, rows, scalar, group, check, expectOk, expectFail, finish, U } from './lib.mjs';

const DB = 'tehsilhub_legacy';
const env = { ...process.env, PGOPTIONS: '-c client_min_messages=warning' };
const sh = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', env });
const psqlFile = (f) => {
  const r = sh('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', DB, '-f', path.join(ROOT, f)]);
  return { ok: r.status === 0, err: (r.stderr || '').trim() };
};
const O = { db: DB };
const user = (n) => ({ db: DB, as: 'authenticated', uid: U(n) });

sh('dropdb', ['--if-exists', '--force', DB]); sh('createdb', [DB]);
const stub = sh('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', DB, '-f', path.join(ROOT, 'tests/pg/00_supabase_stub.sql')]);
if (stub.status !== 0) { console.error(stub.stderr); process.exit(2); }
for (const f of ['01_supabase_schema.sql', '02_hardening_phase1.sql', '04_grants.sql', '05_backfill_profiles.sql', '03_hardening_phase2.sql']) {
  const r = psqlFile(f); if (!r.ok) { console.error(f, r.err); process.exit(2); }
}

group('Köhnə v4.0 bazası: mövcud istifadəçilər və məlumat');
const OLD1 = U(101), OLD2 = U(102), OLDADM = U(103);
{
  // Köhnə trigger (05) hesab tipi bilmir: sadəcə profil yaradır
  for (const [id, em, nm] of [[OLD1, 'old1@test.az', 'Köhnə Bir'], [OLD2, 'old2@test.az', 'Köhnə İki'], [OLDADM, 'oldadmin@test.az', 'Köhnə Admin']]) {
    run(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values ('${id}','${em}',now(),'{"full_name":"${nm}"}')`, O);
  }
  run(`update public.profiles set role='admin' where id='${OLDADM}'`, O);
  run(`insert into public.books(seller_id,title,category,price,city) values ('${OLD1}','Köhnə kitab','DİM',3,'Bakı')`, O);
  run(`insert into public.pdfs(uploader_id,title,level,subject,file_url) values ('${OLD1}','Köhnə PDF','DİM','Riyaziyyat','https://x.az/a.pdf')`, O);
  check('köhnə istifadəçilər və profillər var', scalar(`select count(*) from public.profiles`, O) === '3');
  check('köhnə admin (profiles.role) 06/07-dən ƏVVƏL işləyir', scalar(`select public.is_admin()`, user(103)) === 't');
  const before = { b: scalar(`select count(*) from public.books`, O), p: scalar(`select count(*) from public.pdfs`, O) };
  check('köhnə elan (1) və PDF (1) həqiqətən yaradılıb', before.b === '1' && before.p === '1', JSON.stringify(before));

  group('06 → 07 miqrasiyası (iki dəfə: təkrar icra təhlükəsizdir)');
  for (const f of ['06_roles_and_forum.sql', '06_roles_and_forum.sql', '07_admin_panel_and_audit.sql', '07_admin_panel_and_audit.sql']) {
    const r = psqlFile(f); check(`${f} icra olunur`, r.ok, r.err);
  }
  check('kateqoriyalar dublikat olmadan (8)', scalar(`select count(*) from public.forum_categories`, O) === '8');
  check('mövcud elan və PDF itməyib', scalar(`select count(*) from public.books`, O) === before.b && scalar(`select count(*) from public.pdfs`, O) === before.p);
  check('mövcud istifadəçilərin hamısı yerindədir', scalar(`select count(*) from public.profiles`, O) === '3');

  group('Mövcud istifadəçilər miqrasiyadan sonra');
  check('köhnə istifadəçinin hesab tipi NULL-dur (uydurma tip yazılmır)', rows(`select account_type from public.profiles where id in ('${OLD1}','${OLD2}')`, O).every((x) => x.account_type === null));
  check('köhnə istifadəçi giriş edib öz profilini oxuyur', rows(`select id, full_name from public.profiles where id='${OLD1}'`, user(101)).length === 1);
  check('köhnə istifadəçi öz elanlarını görür', rows(`select id from public.books where seller_id='${OLD1}'`, user(101)).length === 1);
  check('my_context(): account_type null, admin deyil', (() => { const c = rows(`select public.my_context() as c`, user(101))[0].c; return c.account_type === null && c.is_admin === false; })());
  expectOk('köhnə istifadəçi forumda mövzu aça bilir (tipi olmasa da)', `select public.forum_create_topic((select id from public.forum_categories limit 1), 'Köhnə istifadəçinin mövzusu', 'Miqrasiyadan sonra köhnə istifadəçi də yaza bilir.')`, user(101));
  expectOk('köhnə istifadəçi tipini BİR DƏFƏ özü seçir', `select public.set_my_account_type('university_student')`, user(101));
  check('  … saxlanılıb', scalar(`select account_type from public.profiles where id='${OLD1}'`, O) === 'university_student');
  expectFail('  … ikinci dəfə dəyişə bilmir', `select public.set_my_account_type('teacher')`, 'artıq seçilib', user(101));
  expectFail('set_my_account_type("admin") rədd edilir', `select public.set_my_account_type('admin')`, 'Yanlış hesab tipi', user(102));
  expectOk('köhnə (profiles.role) admin 07-dən sonra da işləyir', `select public.admin_dashboard_stats()`, user(103));
  check('  … dashboard-da "tipi seçilməyib" sayı görünür', rows(`select public.admin_dashboard_stats() as s`, user(103))[0].s.users.unspecified === 2);
  check('yeni qeydiyyat: tip məcburidir', !run(`insert into auth.users(id,email,raw_user_meta_data) values ('${U(110)}','n@test.az','{"full_name":"N"}')`, O).ok);
  check('yeni qeydiyyat: seçilmiş tip ilə işləyir', run(`insert into auth.users(id,email,raw_user_meta_data) values ('${U(111)}','n2@test.az','{"full_name":"N","account_type":"student"}')`, O).ok);

  group('08 bootstrap köhnə bazada');
  const bs = fs.readFileSync(path.join(ROOT, '08_bootstrap_super_admin.sql'), 'utf8');
  check('hesab hələ yoxdur → xəta, heç nə dəyişmir', !run(bs, O).ok);
  run(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values ('${U(120)}','Elielizade17@Gmail.com',now(),'{"full_name":"E","account_type":"teacher"}')`, O);
  const r = run(bs, O);
  check('e-poçt böyük/kiçik hərfdən asılı olmadan tapılır və təyin olunur', r.ok && scalar(`select level from public.admin_users where user_id='${U(120)}'`, O) === 'super', r.err);
  check('is_super_admin() true', scalar(`select public.is_super_admin()`, user(120)) === 't');
  // E-poçt başqasının hesabına keçirilərsə, admin hüququ ID-yə bağlı olduğu üçün keçmir
  run(`update auth.users set email='elielizade17@gmail.com.old' where id='${U(120)}'`, O);
  run(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values ('${U(121)}','elielizade17@gmail.com',now(),'{"full_name":"Başqası","account_type":"student"}')`, O);
  check('eyni e-poçtlu YENİ hesab admin olmur (hüquq Auth ID-yə bağlıdır)', scalar(`select public.is_admin()`, user(121)) === 'f');
  run(`update auth.users set email='elielizade17@gmail.com' where id='${U(120)}'`, O);
  run(`delete from auth.users where id='${U(121)}'`, O);

  group('98 geri qaytarma və yenidən tətbiq');
  const rb1 = psqlFile('98_rollback_06_07.sql'); check('98 icra olunur', rb1.ok, rb1.err);
  const rb2 = psqlFile('98_rollback_06_07.sql'); check('98 təkrar icra olunur (idempotent)', rb2.ok, rb2.err);
  check('geri qaytarmadan sonra elan/PDF/profillər qalır', scalar(`select count(*) from public.books`, O) === before.b && scalar(`select count(*) from public.pdfs`, O) === before.p && Number(scalar(`select count(*) from public.profiles`, O)) >= 3);
  check('forum cədvəlləri silinib, hesab tipi sütunu (məlumat) qalıb', scalar(`select to_regclass('public.forum_topics') is null`, O) === 't' && scalar(`select account_type from public.profiles where id='${OLD1}'`, O) === 'university_student');
  check('köhnə üsul (profiles.role) admin geri qaytarmadan sonra da işləyir', scalar(`select public.is_admin()`, user(103)) === 't');
  check('köhnə handle_new_user bərpa olunub (tipsiz qeydiyyat yenə işləyir)', run(`insert into auth.users(id,email,raw_user_meta_data) values ('${U(130)}','rb@test.az','{"full_name":"RB"}')`, O).ok);
  for (const f of ['06_roles_and_forum.sql', '07_admin_panel_and_audit.sql']) { const r2 = psqlFile(f); check(`geri qaytarmadan sonra ${f} yenidən tətbiq olunur`, r2.ok, r2.err); }
  check('yenidən tətbiqdən sonra tipsiz qeydiyyat yenə bloklanır', !run(`insert into auth.users(id,email,raw_user_meta_data) values ('${U(131)}','rb2@test.az','{"full_name":"RB"}')`, O).ok);
}

finish();
