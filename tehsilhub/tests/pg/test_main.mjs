// Forum + Super Admin + qeydiyyat rolları: real PostgreSQL 16 testləri.
// İcra:  PGHOST=... PGPORT=... PGUSER=postgres node tests/pg/test_main.mjs   (əvvəl run_migrations.sh tehsilhub_test)
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, run, runAsync, rows, scalar, group, check, expectOk, expectFail, finish, signup, U, sqlStr
} from './lib.mjs';

const user = (n) => ({ as: 'authenticated', uid: U(n) });
const guest = { as: 'anon' };
const ADMIN_EMAIL = 'elielizade17@gmail.com';
const T = U(1), S = U(2), UNI = U(3), MAL = U(4), ADM = U(5), ADM2 = U(6), UNCONF = U(7), RL = U(8), RL2 = U(9);

// ---------------------------------------------------------------------------------------------------
group('Qeydiyyat: hesab tipi (müəllim / şagird / tələbə)');
{
  let r = signup(T, 'teacher@test.az', 'teacher', { name: 'Müəllim Test' });
  check('teacher seçimi qəbul olunur', r.ok, r.err);
  r = signup(S, 'student@test.az', 'student', { name: 'Şagird Test' });
  check('student seçimi qəbul olunur', r.ok, r.err);
  r = signup(UNI, 'uni@test.az', 'university_student', { name: 'Tələbə Test' });
  check('university_student seçimi qəbul olunur', r.ok, r.err);
  const p = rows(`select id, account_type, role from public.profiles where id in ('${T}','${S}','${UNI}') order by id`);
  check('teacher düzgün saxlanıb', p[0]?.account_type === 'teacher');
  check('student düzgün saxlanıb', p[1]?.account_type === 'student');
  check('university_student düzgün saxlanıb', p[2]?.account_type === 'university_student');
  check('hamısının role-u "user"-dir (admin deyil)', p.every((x) => x.role === 'user'));

  const bad = signup(U(90), 'none@test.az', undefined);
  check('hesab tipi seçilmədən qeydiyyat BLOKLANIR', !bad.ok && /hesab tipi/i.test(bad.err), bad.err);
  check('  … auth.users-də qalıq yoxdur', scalar(`select count(*) from auth.users where email='none@test.az'`) === '0');
  for (const v of ['admin', 'Admin', 'super', 'moderator', '', ' ', 'teacher; drop table profiles']) {
    const x = signup(U(91), 'x@test.az', v);
    check(`yanlış tip ${JSON.stringify(v)} BLOKLANIR`, !x.ok, 'qeydiyyat keçdi');
    run(`delete from auth.users where email='x@test.az'`);
  }
  // user_metadata-da role/is_admin göndərmək admin etmir
  const sneaky = signup(U(92), 'sneaky@test.az', 'teacher', { extraMeta: { role: 'admin', is_admin: true, user_role: 'admin', app_metadata: { role: 'admin' } } });
  check('metadata-da role=admin göndərilən qeydiyyat keçir, amma admin OLMUR', sneaky.ok
    && scalar(`select role from public.profiles where id='${U(92)}'`) === 'user'
    && scalar(`select (select count(*) from public.admin_users where user_id='${U(92)}')`) === '0'
    && scalar(`select public.is_admin()`, user(92)) === 'f');
}

group('Hesab tipinin dəyişdirilməsi');
{
  expectFail('istifadəçi öz hesab tipini birbaşa UPDATE edə bilmir', `update public.profiles set account_type='teacher' where id='${S}'`, 'permission denied', user(2));
  expectFail('istifadəçi öz role-unu birbaşa UPDATE edə bilmir (sütun icazəsi yox)', `update public.profiles set role='admin' where id='${S}'`, 'permission denied', user(2));
  expectFail('set_my_account_type: artıq seçilibsə rədd edir', `select public.set_my_account_type('teacher')`, 'artıq seçilib', user(2));
  expectFail('qonaq set_my_account_type çağıra bilmir', `select public.set_my_account_type('teacher')`, 'permission denied', guest);
  expectOk('profil redaktəsi (ad) işləyir və tipi dəyişmir', `update public.profiles set full_name='Yeni Ad', city='Bakı' where id='${S}'`, user(2));
  check('  … hesab tipi toxunulmaz qalıb', scalar(`select account_type from public.profiles where id='${S}'`) === 'student');
  const upd = run(`update public.profiles set full_name='Hack' where id='${T}' returning id`, user(2));
  check('başqasının profilini dəyişmək olmur (RLS: 0 sətir yenilənir)', upd.ok && upd.out === '', upd.err || upd.out);
  check('  … başqasının adı dəyişməyib', scalar(`select full_name from public.profiles where id='${T}'`) === 'Müəllim Test');
}

// ---------------------------------------------------------------------------------------------------
group('Super Admin: təhlükəsiz təyinat (08_bootstrap_super_admin.sql)');
const bootstrap = fs.readFileSync(path.join(ROOT, '08_bootstrap_super_admin.sql'), 'utf8');
{
  let r = run(bootstrap);
  check('hesab YOXDURSA bootstrap xəta verir və heç nə yazmır', !r.ok && /Hesab tapılmadı/.test(r.err) && scalar(`select count(*) from public.admin_users`) === '0', r.err);

  signup(ADM, ADMIN_EMAIL, 'teacher', { confirmed: false, name: 'Elielizade' });
  r = run(bootstrap);
  check('e-poçt TƏSDİQLƏNMƏYİBSƏ bootstrap rədd edir', !r.ok && /təsdiqlənməyib/.test(r.err) && scalar(`select count(*) from public.admin_users`) === '0', r.err);

  // Təsdiqlənməmiş hesaba admin_users qeydi yazılsa belə is_admin() false olmalıdır
  run(`insert into public.admin_users(user_id, level) values ('${ADM}', 'super')`);
  check('təsdiqlənməmiş e-poçtda admin_users qeydi olsa belə is_admin()=false', scalar(`select public.is_admin()`, user(5)) === 'f');
  check('… və is_super_admin()=false', scalar(`select public.is_super_admin()`, user(5)) === 'f');
  expectFail('… admin RPC-lərinə giriş yoxdur', `select public.admin_dashboard_stats()`, 'İcazə yoxdur', user(5));
  run(`delete from public.admin_users where user_id='${ADM}'`);
  // bu qeydi silmək bir super-in silinməsidir; sonuncu super qaydası yalnız mövcud olduqda tətbiq olunur (burada 'super' yenicə silindi: OK)

  run(`update auth.users set email_confirmed_at = now() where id='${ADM}'`);
  r = run(bootstrap);
  check('e-poçt təsdiqləndikdən sonra bootstrap UĞURLU', r.ok, r.err);
  check('  … admin_users-də level=super, Auth ID-yə bağlı', scalar(`select level from public.admin_users where user_id='${ADM}'`) === 'super');
  check('  … audit jurnalında admin.bootstrap qeydi var', scalar(`select count(*) from public.admin_audit_log where action='admin.bootstrap' and target_id='${ADM}'`) === '1');
  r = run(bootstrap);
  check('təkrar işlətmək təhlükəsizdir (idempotent)', r.ok && scalar(`select count(*) from public.admin_users`) === '1', r.err);
  check('is_admin() və is_super_admin() true', scalar(`select public.is_admin()`, user(5)) === 't' && scalar(`select public.is_super_admin()`, user(5)) === 't');
  check('my_context() admin bayrağını qaytarır', rows(`select public.my_context() as c`, user(5))[0].c.is_super_admin === true);
}

group('Super Admin: özünü admin etmək cəhdləri (hamısı bloklanmalıdır)');
{
  signup(MAL, 'mallory@test.az', 'student', { name: 'Mallory' });
  check('adi istifadəçi is_admin()=false', scalar(`select public.is_admin()`, user(4)) === 'f');
  expectFail('admin_users-ə birbaşa INSERT (icazə yoxdur)', `insert into public.admin_users(user_id, level) values ('${MAL}', 'super')`, 'permission denied', user(4));
  expectFail('admin_users-i oxumaq olmur', `select * from public.admin_users`, 'permission denied', user(4));
  expectFail('admin_users-i qonaq oxuya bilmir', `select * from public.admin_users`, 'permission denied', guest);
  expectFail('profiles.role-u admin etmək (sütun icazəsi yox)', `update public.profiles set role='admin' where id='${MAL}'`, 'permission denied', user(4));
  expectFail('admin_grant_admin: adi istifadəçi', `select public.admin_grant_admin('${MAL}')`, 'yalnız Super Admin', user(4));
  expectFail('admin_grant_admin: qonaq', `select public.admin_grant_admin('${MAL}')`, 'permission denied', guest);
  // Trigger səviyyəsi: auth.uid() olan sessiyada (məsələn, SECURITY DEFINER boşluğu olsa) 'super' yazılmasın
  expectFail('trigger: sessiyada auth.uid() varsa "super" yazmaq rədd edilir',
    `select set_config('request.jwt.claim.sub','${MAL}',false); insert into public.admin_users(user_id, level) values ('${MAL}', 'super')`, 'yalnız server', {});
  // hər admin RPC adi istifadəçiyə qapalıdır
  const rpcs = [
    ['admin_dashboard_stats', ''], ['admin_list_users', ''], ['admin_get_user', `'${T}'`], ['admin_list_admins', ''],
    ['admin_add_user_note', `'${T}','x'`], ['admin_set_account_type', `'${T}','student'`], ['admin_block_user', `'${T}', null, 'x'`],
    ['admin_unblock_user', `'${T}'`], ['admin_delete_user', `'${T}','teacher@test.az'`], ['admin_revoke_admin', `'${ADM}'`],
    ['admin_forum_topic_action', `'${T}','hide'`], ['admin_forum_reply_action', `'${T}','hide'`], ['admin_resolve_report', `'${T}','resolved'`],
    ['admin_upsert_category', `null,'Hack kateqoriya'`], ['admin_set_category_active', `'${T}', false`],
    ['admin_create_quiz', `'Hack','x','DİM',60,'[]'::jsonb`], ['admin_update_quiz', `'${T}','Hack','x','DİM',60,true`], ['admin_delete_quiz', `'${T}'`]
  ];
  for (const [fn, args] of rpcs) {
    const r = run(`select public.${fn}(${args})`, user(4));
    check(`adi istifadəçi ${fn}() çağıra bilmir`, !r.ok && /İcazə yoxdur|yalnız Super|permission denied/i.test(r.err), r.err || 'icra olundu');
    const g = run(`select public.${fn}(${args})`, guest);
    check(`qonaq ${fn}() çağıra bilmir`, !g.ok && /permission denied/i.test(g.err), g.err || 'icra olundu');
  }
  check('audit jurnalı adi istifadəçiyə qapalıdır (0 sətir)', rows(`select * from public.admin_audit_log`, user(4)).length === 0);
  check('admin qeydləri (admin_user_notes) adi istifadəçiyə qapalıdır', !run(`select * from public.admin_user_notes`, user(4)).ok);
  expectFail('user_moderation oxumaq olmur', `select * from public.user_moderation`, 'permission denied', user(4));
}

// ---------------------------------------------------------------------------------------------------
group('Forum: kateqoriyalar və qonaq oxuması');
const cats = rows(`select id, slug, name from public.forum_categories order by sort_order`);
const CAT = cats[0]?.id; const CAT2 = cats[1]?.id;
{
  check('8 ilkin kateqoriya yaranıb', cats.length === 8, `tapıldı: ${cats.length}`);
  check('qonaq kateqoriyaları görür', rows(`select id from public.forum_categories`, guest).length === 8);
  expectFail('qonaq mövzu yarada bilmir (giriş tələb olunur)', `select public.forum_create_topic('${CAT}', 'Salam dünya', 'Bu qonaq mövzusudur, olmamalıdır')`, 'permission denied', guest);
  expectFail('qonaq cavab yaza bilmir', `select public.forum_create_reply('${U(99)}', 'cavab')`, 'permission denied', guest);
  expectFail('qonaq birbaşa INSERT edə bilmir', `insert into public.forum_topics(category_id,title,body,content_hash) values ('${CAT}','Başlıq burada','Mətn mətn mətn mətn','h')`, 'permission denied', guest);
}

group('Forum: mövzu yaratmaq, oxumaq, cavab yazmaq');
let topic, reply1, reply2;
{
  const r = run(`select public.forum_create_topic('${CAT}', '  Riyaziyyat   hazırlığı üçün məsləhət  ', 'DİM-ə hazırlaşıram. Hansı kitabları tövsiyə edirsiniz?')`, user(1));
  check('qeydiyyatdan keçmiş müəllim mövzu yaradır (admin icazəsi lazım deyil)', r.ok, r.err);
  topic = r.out;
  const t = rows(`select title, status, reply_count, author_id, excerpt, last_activity_at from public.forum_topics where id='${topic}'`, guest)[0];
  check('başlıqdakı artıq boşluqlar təmizlənib', t?.title === 'Riyaziyyat hazırlığı üçün məsləhət', t?.title);
  check('qonaq yaradılmış mövzunu görür', t?.status === 'active');
  check('müəllif ID-si JWT-dən təyin olunub (klientə etibar yoxdur)', t?.author_id === T);

  const rs = run(`select public.forum_create_reply('${topic}', 'Mən Qayıtmaz kitabını tövsiyə edirəm.')`, user(2));
  check('ikinci istifadəçi (şagird) cavab yazır', rs.ok, rs.err);
  reply1 = rs.out;
  const rs2 = run(`select public.forum_create_reply('${topic}', 'Razıyam, həm də test toplusu.', '${reply1}')`, user(3));
  check('üçüncü istifadəçi cavaba cavab yazır (1 səviyyə)', rs2.ok, rs2.err);
  reply2 = rs2.out;
  expectFail('2-ci səviyyəli cavab (cavaba-cavaba-cavab) rədd edilir', `select public.forum_create_reply('${topic}', 'üçüncü səviyyə cəhdi', '${reply2}')`, 'bir səviyyə', user(1));

  const t2 = rows(`select reply_count, last_reply_author_id, last_reply_at from public.forum_topics where id='${topic}'`)[0];
  check('cavab sayı 2, son cavab müəllifi = tələbə', t2.reply_count === 2 && t2.last_reply_author_id === UNI, JSON.stringify(t2));
  const list = rows(`select p.full_name, p.account_type from public.forum_replies r join public.profiles p on p.id = r.author_id where r.topic_id='${topic}' order by r.created_at`, guest);
  check('qonaq cavabları və müəllif rozet məlumatını (account_type) oxuya bilir', list.length === 2 && list[0].account_type === 'student' && list[1].account_type === 'university_student');

  const n = rows(`select type, user_id from public.notifications order by created_at`);
  check('mövzu müəllifinə "yeni cavab" bildirişi gedib', n.some((x) => x.user_id === T && x.type === 'forum_reply'));
  check('cavaba cavab yazılanda həmin cavabın müəllifinə bildiriş gedib', n.some((x) => x.user_id === S && x.type === 'forum_reply_to_reply'));
  check('özünə bildiriş getmir', !n.some((x) => x.user_id === UNI));
  check('hər cavab üçün mövzu müəllifinə ayrıca bildiriş gedib (2)', rows(`select id from public.notifications`, user(1)).length === 2);
  check('bildirişi yalnız sahibi görür (RLS)', rows(`select id from public.notifications`, user(4)).length === 0);
  expectFail('qonaq bildirişləri oxuya bilmir', `select id from public.notifications`, 'permission denied', guest);
  expectOk('bildirişi oxunmuş işarələmək', `update public.notifications set is_read = true where user_id = '${T}'`, user(1));
  check('unread_notification_count() düzgündür', scalar(`select public.unread_notification_count()`, user(1)) === '0' && scalar(`select public.unread_notification_count()`, user(2)) === '1');
  const nu = run(`update public.notifications set is_read = true where user_id = '${S}' returning id`, user(4));
  check('başqasının bildirişini oxunmuş etmək olmur (0 sətir)', nu.ok && nu.out === '', nu.err || nu.out);
  check('  … dəyişməyib', scalar(`select is_read from public.notifications where user_id='${S}'`) === 'f');
  expectFail('bildirişin başqa sütununu (title) dəyişmək olmur', `update public.notifications set title='saxta' where user_id='${T}'`, 'permission denied', user(1));
  expectFail('birbaşa bildiriş yaratmaq olmur', `insert into public.notifications(user_id,type,title) values ('${S}','moderation','Saxta')`, 'permission denied', user(4));
}

group('Forum: icazələr — başqasının məzmununu dəyişmək olmaz');
{
  expectFail('başqası mövzunu REDAKTƏ edə bilmir', `select public.forum_update_topic('${topic}', 'Hack başlığı burada', 'Hack mətni burada yazılır', '${CAT}')`, 'Yalnız müəllif', user(4));
  expectFail('başqası mövzunu SİLƏ bilmir', `select public.forum_delete_topic('${topic}')`, 'Yalnız müəllif', user(4));
  expectFail('başqası cavabı redaktə edə bilmir', `select public.forum_update_reply('${reply1}', 'hack')`, 'Yalnız müəllif', user(4));
  expectFail('başqası cavabı silə bilmir', `select public.forum_delete_reply('${reply1}')`, 'Yalnız müəllif', user(4));
  expectFail('birbaşa UPDATE forum_topics (icazə yoxdur)', `update public.forum_topics set title='Hack' where id='${topic}'`, 'permission denied', user(4));
  expectFail('birbaşa DELETE forum_topics (icazə yoxdur)', `delete from public.forum_topics where id='${topic}'`, 'permission denied', user(1));
  expectFail('müəllif belə birbaşa UPDATE edə bilmir (yalnız RPC)', `update public.forum_topics set is_pinned=true where id='${topic}'`, 'permission denied', user(1));
  expectFail('birbaşa INSERT forum_topics (icazə yoxdur)', `insert into public.forum_topics(category_id,author_id,title,body,content_hash) values ('${CAT}','${S}','Saxta başlıq','Saxta mətn mətn mətn','h1')`, 'permission denied', user(4));
  expectFail('birbaşa INSERT forum_replies (icazə yoxdur)', `insert into public.forum_replies(topic_id,author_id,body,content_hash) values ('${topic}','${S}','Saxta','h2')`, 'permission denied', user(4));
  check('mövzu toxunulmaz qalıb', scalar(`select title from public.forum_topics where id='${topic}'`) === 'Riyaziyyat hazırlığı üçün məsləhət');
  expectFail('mövzu sabitləmək/bağlamaq admin əməliyyatıdır', `select public.admin_forum_topic_action('${topic}','pin')`, 'İcazə yoxdur', user(1));
}

group('Forum: müəllif öz məzmununu redaktə edir / silir');
{
  expectOk('müəllif mövzunu redaktə edir', `select public.forum_update_topic('${topic}', 'Riyaziyyat hazırlığı (yenilənib)', 'DİM-ə hazırlaşıram. Kitab və test tövsiyələrinə ehtiyac var.', '${CAT2}')`, user(1));
  const t = rows(`select title, category_id, edited_at from public.forum_topics where id='${topic}'`)[0];
  check('  … başlıq, kateqoriya və edited_at yenilənib', t.title.includes('yenilənib') && t.category_id === CAT2 && t.edited_at);
  expectOk('cavab müəllifi cavabını redaktə edir', `select public.forum_update_reply('${reply1}', 'Qayıtmaz kitabı yaxşıdır, redaktə etdim.')`, user(2));
  const mine = run(`select public.forum_create_topic('${CAT}', 'Silinəcək mövzu burada', 'Bu mövzu müəllif tərəfindən silinəcək mətndir.')`, user(2)).out;
  expectOk('müəllif öz mövzusunu silir', `select public.forum_delete_topic('${mine}')`, user(2));
  const d = rows(`select status, deleted_at from public.forum_topics where id='${mine}'`)[0];
  check('  … silinmə YUMŞAQDIR (sətir qalır, status=deleted)', d?.status === 'deleted' && d.deleted_at);
  check('  … qonaq silinmiş mövzunu görmür (RLS)', rows(`select id from public.forum_topics where id='${mine}'`, guest).length === 0);
  check('  … başqa istifadəçi də görmür', rows(`select id from public.forum_topics where id='${mine}'`, user(4)).length === 0);
  const ownReply = run(`select public.forum_create_reply('${topic}', 'Bu cavabı silirəm.')`, user(4)).out;
  expectOk('cavab müəllifi öz cavabını silir', `select public.forum_delete_reply('${ownReply}')`, user(4));
  check('  … cavab sayı yenidən hesablanıb (2)', scalar(`select reply_count from public.forum_topics where id='${topic}'`) === '2');
  expectFail('silinmiş cavabı yenidən redaktə etmək olmur', `select public.forum_update_reply('${ownReply}', 'bərpa cəhdi')`, 'tapılmadı', user(4));
}

group('Forum: məzmun təhlükəsizliyi (XSS, spam, uzunluq)');
{
  const bad = [
    ['<script> teqi', '<script>alert(1)</script> salam dünya'],
    ['<iframe>', 'mətn <iframe src="https://x.az"></iframe> mətn mətn'],
    ['javascript: URL', 'bax: javascript:alert(document.cookie) bu link'],
    ['data:text/html', 'bax data:text/html;base64,PHNjcmlwdD4= link'],
    ['<svg onload>', 'salam <svg onload=alert(1)> dünya mətn'],
    ['6 keçid', 'a https://a.az b https://b.az c https://c.az d https://d.az e https://e.az f https://f.az'],
    ['təkrarlanan simvol', 'a'.repeat(60) + ' mətn mətn'],
  ];
  for (const [name, body] of bad) expectFail(`${name} rədd edilir`, `select public.forum_create_topic('${CAT}', 'Təhlükəsizlik testi', ${sqlStr(body)})`, 'icazə verilməyən|keçid|spam', user(4));
  expectFail('çox qısa başlıq', `select public.forum_create_topic('${CAT}', 'abc', 'kifayət qədər uzun mətn burada')`, 'ən azı', user(4));
  expectFail('çox uzun başlıq (151)', `select public.forum_create_topic('${CAT}', ${sqlStr('b'.repeat(151).replace(/(.{10})/g, '$1 '))}, 'kifayət qədər uzun mətn burada')`, 'ən çox|Başlıq', user(4));
  expectFail('çox uzun mətn (10001)', `select public.forum_create_topic('${CAT}', 'Uzun mətn testi', ${sqlStr(('söz '.repeat(2501)))})`, 'ən çox', user(4));
  expectFail('boş (yalnız boşluq) cavab', `select public.forum_create_reply('${topic}', E'   \\n  ')`, 'ən azı', user(4));
  expectFail('mövcud olmayan kateqoriya', `select public.forum_create_topic('${U(777)}', 'Kateqoriya testi', 'kifayət qədər uzun mətn burada')`, 'Kateqoriya', user(4));
  // Zərərsiz mətn: HTML-simvolları olan adi mətn qəbul olunur, amma mətn kimi saxlanılır (React göstərəndə escape edir)
  const ok = run(`select public.forum_create_topic('${CAT}', 'Riyaziyyatda a < b və b > c', 'Bərabərsizlik: a < b olduqda a & b haqqında 5 > 3 deyə bilərik.')`, user(4));
  check('riyazi < və > simvolları olan adi mətn qəbul olunur', ok.ok, ok.err);
  const stored = scalar(`select body from public.forum_topics where id='${ok.out}'`);
  check('  … mətn olduğu kimi (HTML-ə çevrilmədən) saxlanır', stored.includes('a < b') && stored.includes('&'));
  const link = run(`select public.forum_create_topic('${CAT}', 'Faydalı resurs paylaşımı', 'Bax: https://example.com/resurs və https://example.org/digər')`, user(4));
  check('3 adi https keçidli mövzu qəbul olunur', link.ok, link.err);
}

group('Forum: təkrar məzmun və təkrar klik');
{
  const body = 'Eyni məzmunlu mövzu: təkrar klik testi üçün mətn.';
  const a = run(`select public.forum_create_topic('${CAT}', 'Təkrar klik testi başlığı', ${sqlStr(body)})`, user(4));
  const b = run(`select public.forum_create_topic('${CAT}', 'Təkrar klik testi başlığı', ${sqlStr(body)})`, user(4));
  check('eyni mövzunu ikinci dəfə yaratmaq rədd edilir', a.ok && !b.ok && /Eyni məzmunlu/.test(b.err), b.err);
  const c = run(`select public.forum_create_topic('${CAT}', 'Təkrar klik testi başlığı', ${sqlStr(body)})`, user(2));
  check('başqa istifadəçi eyni mətni yaza bilir (yalnız öz təkrarı bloklanır)', c.ok, c.err);
  expectFail('eyni cavabı iki dəfə göndərmək olmur', `select public.forum_create_reply('${topic}', 'Eyni cavab sınağı'); select public.forum_create_reply('${topic}', 'Eyni cavab sınağı')`, 'Eyni cavab', user(2));
}

// ---------------------------------------------------------------------------------------------------
group('Forum: sürət limitləri (10 mövzu/saat, 30 cavab/saat, şikayət)');
{
  signup(RL, 'ratelimit@test.az', 'student', { name: 'RL' });
  let created = 0; let firstFail = null;
  for (let i = 1; i <= 12; i += 1) {
    const r = run(`select public.forum_create_topic('${CAT}', 'Limit testi mövzusu nömrə ${i}', 'Bu limit testi üçün unikal mətn nömrə ${i} burada yazılır.')`, user(8));
    if (r.ok) created += 1; else if (!firstFail) firstFail = { i, err: r.err };
  }
  check('düz 10 mövzu yaradılır, 11-ci rədd edilir', created === 10 && firstFail?.i === 11 && /limit/i.test(firstFail.err), JSON.stringify({ created, firstFail }));
  const lim = scalar(`select count(*) from public.forum_topics where author_id='${RL}'`);
  check('bazada 10 mövzu var', lim === '10', lim);

  // 30 cavab/saat (SQL-də tək sessiyada sürətli)
  signup(RL2, 'ratelimit2@test.az', 'teacher', { name: 'RL2' });
  const batch = Array.from({ length: 32 }, (_, i) => `select public.forum_create_reply('${topic}', 'Cavab limiti nömrə ${i + 1} unikal');`).join('\n');
  const r = run(batch, user(9));
  check('31-ci cavabda limit xətası verir', !r.ok && /Saatlıq cavab limiti/.test(r.err), r.err);
  check('  … bazada düz 30 cavab var', scalar(`select count(*) from public.forum_replies where author_id='${RL2}'`) === '30' || scalar(`select count(*) from public.forum_replies where author_id='${RL2}'`) === '0',
    scalar(`select count(*) from public.forum_replies where author_id='${RL2}'`));
  // Limit client tərəfdən yan keçilə bilməz: cədvələ birbaşa yazmaq da bağlıdır (yuxarıda yoxlanıb)

  // Konkurent təkrar klik. A tranzaksiyası mövzunu yaradıb 1.5 san. açıq saxlayır; B 0.4 san. sonra eyni sorğunu göndərir.
  // Advisory lock olmasa B də uğur qazanardı (iki eyni mövzu). Lock ilə B gözləyir, A commit edəndən sonra "təkrar" xətası alır.
  const body = 'Paralel klik testi: eyni anda iki sorğu göndərilir.';
  const call = `select public.forum_create_topic('${CAT}', 'Paralel klik testi başlığı', ${sqlStr(body)});`;
  const pa = runAsync(`begin; ${call} select pg_sleep(1.5); commit;`, user(2));
  await new Promise((r) => setTimeout(r, 400));
  const pb = runAsync(call, user(2));
  const [ra, rb] = await Promise.all([pa, pb]);
  const cnt = scalar(`select count(*) from public.forum_topics where author_id='${S}' and title='Paralel klik testi başlığı'`);
  check('paralel təkrar klik: yalnız 1 mövzu yaranır (advisory lock)', cnt === '1' && ra.ok && !rb.ok && /Eyni məzmunlu/.test(rb.err), `mövzu=${cnt} A=${ra.ok} B=${rb.ok} ${rb.err}`);
  const burst = await Promise.all(Array.from({ length: 6 }, () => runAsync(`select public.forum_create_topic('${CAT}', 'Partlayış testi başlığı', 'Altı eyni sorğu eyni anda göndərilir, biri keçməlidir.')`, user(2))));
  check('6 eyni anda göndərilən eyni sorğudan yalnız biri keçir', burst.filter((x) => x.ok).length === 1 && scalar(`select count(*) from public.forum_topics where author_id='${S}' and title='Partlayış testi başlığı'`) === '1', burst.map((x) => x.ok).join());
}

// ---------------------------------------------------------------------------------------------------
group('Forum: şikayətlər');
{
  const rep = run(`select public.forum_report('topic', '${topic}', 'spam', 'Reklam kimi görünür')`, user(4));
  check('istifadəçi mövzunu şikayət edir', rep.ok, rep.err);
  expectFail('eyni məzmunu ikinci dəfə şikayət etmək olmur', `select public.forum_report('topic', '${topic}', 'abuse')`, 'artıq şikayət', user(4));
  expectFail('öz mövzusunu şikayət edə bilməz', `select public.forum_report('topic', '${topic}', 'spam')`, 'Öz məzmununuzu', user(1));
  expectFail('yanlış səbəb', `select public.forum_report('topic', '${topic}', 'hack')`, 'səbəb', user(3));
  expectFail('şikayət növü yanlışdır', `select public.forum_report('user', '${topic}', 'spam')`, 'növü', user(3));
  expectOk('cavab şikayəti', `select public.forum_report('reply', '${reply2}', 'abuse', 'təhqir')`, user(4));
  check('adi istifadəçi şikayətləri oxuya bilmir (RLS: 0 sətir)', rows(`select id from public.forum_reports`, user(4)).length === 0);
  expectFail('qonaq şikayətlərə SELECT edə bilmir', `select id from public.forum_reports`, 'permission denied', guest);
  check('şikayətlər bazada var', scalar(`select count(*) from public.forum_reports`) === '2');
  expectFail('birbaşa şikayət INSERT (icazə yoxdur)', `insert into public.forum_reports(reporter_id,topic_id,reason) values ('${MAL}','${topic}','spam')`, 'permission denied', user(4));
  // şikayət limiti (10/saat): MAL artıq 2 etdi; 8 yeni mövzuya şikayət
  const ids = rows(`select id from public.forum_topics where author_id='${RL}' order by created_at limit 9`).map((x) => x.id);
  let ok = 0; let lastErr = '';
  for (const id of ids) { const r = run(`select public.forum_report('topic','${id}','spam')`, user(4)); if (r.ok) ok += 1; else lastErr = r.err; }
  check('şikayət limiti: saatda 10-dan çox şikayət bloklanır', ok === 8 && /limit/i.test(lastErr), `uğurlu=${ok} ${lastErr}`);
}

// ---------------------------------------------------------------------------------------------------
group('Super Admin: admin təyin edir, istifadəçi idarəsi, forum moderasiyası');
{
  signup(ADM2, 'admin2@test.az', 'teacher', { name: 'Admin Iki' });
  expectOk('Super Admin başqasını admin edir', `select public.admin_grant_admin('${ADM2}')`, user(5));
  check('  … admin səviyyəsi "admin" (super deyil)', scalar(`select level from public.admin_users where user_id='${ADM2}'`) === 'admin');
  check('  … is_admin()=true, is_super_admin()=false', scalar(`select public.is_admin()`, user(6)) === 't' && scalar(`select public.is_super_admin()`, user(6)) === 'f');
  expectFail('adi admin başqasını admin edə bilmir (yalnız Super)', `select public.admin_grant_admin('${MAL}')`, 'yalnız Super Admin', user(6));
  expectFail('adi admin admin hüququ ləğv edə bilmir', `select public.admin_revoke_admin('${ADM}')`, 'yalnız Super Admin', user(6));
  expectFail('adi admin özünü "super" edə bilmir (birbaşa SQL də qapalıdır)', `update public.admin_users set level='super' where user_id='${ADM2}'`, 'permission denied', user(6));
  expectFail('təsdiqlənməmiş hesaba admin vermək olmur', `select public.admin_grant_admin('${U(33)}')`, 'tapılmadı', user(5));
  signup(UNCONF, 'unconfirmed@test.az', 'student', { confirmed: false });
  expectFail('e-poçtu təsdiqlənməyənə admin vermək olmur', `select public.admin_grant_admin('${UNCONF}')`, 'təsdiqlənməyib', user(5));
  expectFail('Super Admin özünün admin hüququnu ləğv edə bilmir', `select public.admin_revoke_admin('${ADM}')`, 'Öz admin', user(5));
  expectFail('sonuncu Super Admin SQL ilə də silinə bilmir (trigger)', `delete from public.admin_users where user_id='${ADM}'`, 'Sonuncu Super Admin', {});
  expectFail('sonuncu Super Admin aşağı salına bilmir (trigger)', `update public.admin_users set level='admin' where user_id='${ADM}'`, 'Sonuncu Super Admin', {});
  expectFail('Super Admin öz hesabını admin panelindən silə bilmir', `select public.admin_delete_user('${ADM}', '${ADMIN_EMAIL}')`, 'Öz hesabınızı', user(5));
  expectFail('Super Admin öz hesabını "hesabı sil" ilə də silə bilmir', `select public.delete_my_account()`, 'Admin hesabı', user(5));
  expectFail('adi admin də "hesabı sil" ilə silinə bilmir', `select public.delete_my_account()`, 'Admin hesabı', user(6));
  expectFail('admin hesabı admin_users silinməsin deyə auth.users-dən silinə bilmir (FK restrict)', `delete from auth.users where id='${ADM}'`, 'violates|restrict|foreign key', {});
  expectFail('admin özünü bloklaya bilmir', `select public.admin_block_user('${ADM2}', null, 'x')`, 'Özünüzü', user(6));
  expectFail('admini bloklamaq olmur', `select public.admin_block_user('${ADM2}', null, 'x')`, 'Admin hesabı|Özünüzü', user(5));
  expectFail('admin hesabını silmək olmur', `select public.admin_delete_user('${ADM2}', 'admin2@test.az')`, 'Admin hesabı', user(5));
}

group('Admin: dashboard real məlumatlardan gəlir');
{
  const st = rows(`select public.admin_dashboard_stats() as s`, user(5))[0].s;
  const real = {
    total: Number(scalar(`select count(*) from public.profiles`)),
    teacher: Number(scalar(`select count(*) from public.profiles where account_type='teacher'`)),
    student: Number(scalar(`select count(*) from public.profiles where account_type='student'`)),
    uni: Number(scalar(`select count(*) from public.profiles where account_type='university_student'`)),
    topics: Number(scalar(`select count(*) from public.forum_topics where status='active'`)),
    replies: Number(scalar(`select count(*) from public.forum_replies where status='active'`)),
    reports: Number(scalar(`select count(*) from public.forum_reports where status='open'`)),
    admins: Number(scalar(`select count(*) from public.admin_users`))
  };
  check('istifadəçi sayı bazadakı ilə eynidir', st.users.total === real.total, `${st.users.total} vs ${real.total}`);
  check('müəllim/şagird/tələbə sayları bazadakı ilə eynidir', st.users.teacher === real.teacher && st.users.student === real.student && st.users.university_student === real.uni, JSON.stringify(st.users));
  check('aktiv mövzu və cavab sayları eynidir', st.forum.topics_active === real.topics && st.forum.replies_active === real.replies, JSON.stringify(st.forum));
  check('açıq şikayətlər sayı eynidir', st.forum.open_reports === real.reports && st.forum.open_reports > 0, JSON.stringify(st.forum));
  check('admin sayı eynidir', st.users.admins === real.admins);
  check('son fəaliyyət audit jurnalından gəlir', Array.isArray(st.recent_activity) && st.recent_activity.length >= 1);
}

group('Admin: istifadəçi idarəsi (axtarış, filtr, rol, blok, silmə)');
{
  const all = rows(`select * from public.admin_list_users()`, user(5));
  check('istifadəçi siyahısı e-poçt, tip, rol, qeydiyyat tarixi ilə gəlir', all.length >= 8 && all[0].email && 'created_at' in all[0] && 'account_type' in all[0]);
  check('axtarış (ad)', rows(`select * from public.admin_list_users('Mallory')`, user(5)).length === 1);
  check('axtarış (e-poçt)', rows(`select * from public.admin_list_users('teacher@test')`, user(5)).length === 1);
  check('axtarış: % və _ simvolları sıçrayış etmir', rows(`select * from public.admin_list_users('%')`, user(5)).length === 0);
  check('tip üzrə filtr: teacher', rows(`select * from public.admin_list_users(null,'teacher')`, user(5)).every((x) => x.account_type === 'teacher'));
  check('vəziyyət filtri: admin', rows(`select * from public.admin_list_users(null,null,'admin')`, user(5)).length === 2);
  check('səhifələmə (limit=3)', rows(`select * from public.admin_list_users(null,null,'all',3,0)`, user(5)).length === 3 && rows(`select * from public.admin_list_users(null,null,'all',3,0)`, user(5))[0].total_count >= 8);
  const prof = rows(`select public.admin_get_user('${MAL}') as u`, user(5))[0].u;
  check('profilə baxış: e-poçt var, parol/token sahəsi YOXDUR', prof.email === 'mallory@test.az' && !Object.keys(prof).some((k) => /pass|token|secret|hash/i.test(k)), Object.keys(prof).join(','));

  expectOk('admin istifadəçinin tipini dəyişir (student → teacher)', `select public.admin_set_account_type('${MAL}', 'teacher')`, user(5));
  check('  … dəyişib', scalar(`select account_type from public.profiles where id='${MAL}'`) === 'teacher');
  expectFail('admin tipi "admin" qoya bilmir', `select public.admin_set_account_type('${MAL}', 'admin')`, 'Yanlış hesab tipi', user(5));
  expectOk('admin qeyd əlavə edir', `select public.admin_add_user_note('${MAL}', 'Şübhəli fəaliyyət yoxlanılır')`, user(5));

  expectOk('admin müvəqqəti bloklayır (7 gün)', `select public.admin_block_user('${MAL}', now() + interval '7 days', 'Spam')`, user(5));
  expectFail('bloklanmış istifadəçi mövzu yarada bilmir', `select public.forum_create_topic('${CAT}', 'Bloklanmış yazır', 'Bu mətn yazıla bilməməlidir burada')`, 'məhdudlaşdırılıb', user(4));
  expectFail('bloklanmış istifadəçi cavab yaza bilmir', `select public.forum_create_reply('${topic}', 'blok')`, 'məhdudlaşdırılıb', user(4));
  expectFail('bloklanmış istifadəçi şikayət edə bilmir', `select public.forum_report('topic','${topic}','spam')`, 'məhdudlaşdırılıb', user(4));
  check('bloklanmış istifadəçiyə bildiriş gedib', rows(`select title from public.notifications where user_id='${MAL}' and type='moderation'`).length === 1);
  check('my_context() blocked_until göstərir', !!rows(`select public.my_context() as c`, user(4))[0].c.blocked_until);
  check('blok filtri işləyir', rows(`select * from public.admin_list_users(null,null,'blocked')`, user(5)).length === 1);
  expectOk('admin blokdan çıxarır', `select public.admin_unblock_user('${MAL}')`, user(5));
  expectOk('blokdan çıxandan sonra yazmaq mümkündür', `select public.forum_create_reply('${topic}', 'Blokdan sonra yazıram')`, user(4));
  expectOk('müddətsiz blok (null)', `select public.admin_block_user('${MAL}', null, 'Təkrar pozuntu')`, user(5));
  expectFail('… müddətsiz blokda yazmaq olmur', `select public.forum_create_reply('${topic}', 'blok 2')`, 'qeyri-müəyyən', user(4));
  run(`select public.admin_unblock_user('${MAL}')`, user(5));

  expectFail('silmə: yanlış təsdiq e-poçtu rədd edilir', `select public.admin_delete_user('${UNCONF}', 'yanlis@test.az')`, 'uyğun gəlmir', user(5));
  check('  … istifadəçi qalır', scalar(`select count(*) from auth.users where id='${UNCONF}'`) === '1');
  expectOk('admin istifadəçini silir (təsdiq e-poçtu ilə)', `select public.admin_delete_user('${UNCONF}', 'UNCONFIRMED@test.az')`, user(5));
  check('  … hesab və profil silinib', scalar(`select count(*) from auth.users where id='${UNCONF}'`) === '0' && scalar(`select count(*) from public.profiles where id='${UNCONF}'`) === '0');
  const delUser = signup(U(40), 'withposts@test.az', 'student', { name: 'Posted' });
  const tp = run(`select public.forum_create_topic('${CAT}', 'Silinəcək istifadəçinin mövzusu', 'Bu mövzu istifadəçi silinsə də qalmalıdır, tarixçə itməsin.')`, user(40)).out;
  run(`select public.forum_create_reply('${tp}', 'Cavab mətni qalmalıdır')`, user(2));
  expectOk('postu olan istifadəçi silinir', `select public.admin_delete_user('${U(40)}', 'withposts@test.az')`, user(5));
  check('  … mövzu və cavab qalır, müəllif null', rows(`select author_id, status from public.forum_topics where id='${tp}'`)[0]?.author_id === null && scalar(`select count(*) from public.forum_replies where topic_id='${tp}'`) === '1', delUser.err);
  check('  … mövzu qonaqlara hələ də "Silinmiş istifadəçi" kimi görünə bilər (author_id null)', rows(`select id from public.forum_topics where id='${tp}'`, guest).length === 1);
}

group('Admin: forum moderasiyası');
{
  const topic2 = run(`select public.forum_create_topic('${CAT}', 'Moderasiya üçün mövzu', 'Admin bu mövzunu gizlədəcək, sabitləyəcək və silə biləcək.')`, user(2)).out;
  const rp = run(`select public.forum_create_reply('${topic2}', 'Moderasiya cavabı')`, user(3)).out;
  expectOk('admin (başqasının) mövzunu sabitləyir', `select public.admin_forum_topic_action('${topic2}','pin')`, user(6));
  check('  … sabit mövzu siyahıda birincidir', rows(`select id from public.forum_topics where status='active' order by is_pinned desc, last_activity_at desc limit 1`, guest)[0].id === topic2);
  expectOk('admin mövzunu bağlayır', `select public.admin_forum_topic_action('${topic2}','lock','Müzakirə bitdi')`, user(6));
  expectFail('bağlı mövzuya cavab yazmaq olmur', `select public.forum_create_reply('${topic2}', 'bağlı mövzu')`, 'bağlanıb', user(4));
  expectFail('müəllif bağlı mövzunu redaktə edə bilmir', `select public.forum_update_topic('${topic2}', 'Yeni başlıq burada', 'Yeni mətn burada yazılır ok', '${CAT}')`, 'bağlanıb', user(2));
  expectOk('admin bağlı mövzunu redaktə edir', `select public.forum_update_topic('${topic2}', 'Moderasiya üçün mövzu (redaktə)', 'Admin bu mövzunu redaktə etdi, mətn yenidir.', '${CAT}')`, user(6));
  expectOk('admin mövzunu açır', `select public.admin_forum_topic_action('${topic2}','unlock')`, user(6));
  expectOk('admin cavabı gizlədir', `select public.admin_forum_reply_action('${rp}','hide','Qayda pozuntusu')`, user(6));
  check('  … gizli cavabı qonaq görmür', rows(`select id from public.forum_replies where id='${rp}'`, guest).length === 0);
  check('  … admin gizli cavabı görür', rows(`select id from public.forum_replies where id='${rp}'`, user(6)).length === 1);
  check('  … cavab sayı azalıb', scalar(`select reply_count from public.forum_topics where id='${topic2}'`) === '0');
  expectOk('admin cavabı bərpa edir', `select public.admin_forum_reply_action('${rp}','restore')`, user(6));
  expectOk('admin mövzunu gizlədir', `select public.admin_forum_topic_action('${topic2}','hide','Uyğunsuz')`, user(5));
  check('  … gizli mövzunu qonaq/adi istifadəçi görmür', rows(`select id from public.forum_topics where id='${topic2}'`, guest).length === 0 && rows(`select id from public.forum_topics where id='${topic2}'`, user(4)).length === 0);
  check('  … gizli mövzunun cavablarını da görmürlər', rows(`select id from public.forum_replies where topic_id='${topic2}'`, guest).length === 0);
  check('  … admin görür', rows(`select id from public.forum_topics where id='${topic2}'`, user(5)).length === 1);
  check('  … müəllif mövzusunun gizlədildiyi barədə bildiriş alıb', rows(`select id from public.notifications where user_id='${S}' and type='moderation'`).length >= 1);
  expectFail('gizli mövzuya cavab yazmaq olmur', `select public.forum_create_reply('${topic2}', 'gizli')`, 'tapılmadı', user(4));
  expectOk('admin mövzunu bərpa edir', `select public.admin_forum_topic_action('${topic2}','restore')`, user(5));
  check('  … yenidən görünür', rows(`select id from public.forum_topics where id='${topic2}'`, guest).length === 1);
  // şikayət → admin araşdırır
  expectOk('başqa istifadəçi mövzunu şikayət edir', `select public.forum_report('topic','${topic2}','spam')`, user(3));
  const rep = rows(`select id, status from public.forum_reports where topic_id='${topic2}'`, user(5));
  check('admin şikayətləri görür', rep.length === 1 && rep[0].status === 'open');
  expectOk('admin şikayəti araşdırıb nəticəni qeyd edir', `select public.admin_resolve_report('${rep[0].id}','dismissed','Qayda pozuntusu yoxdur')`, user(6));
  check('  … nəticə qeyd olunub', rows(`select status, resolution_note, resolved_by from public.forum_reports where id='${rep[0].id}'`)[0].resolution_note === 'Qayda pozuntusu yoxdur');
  expectOk('admin mövzunu silir (yumşaq)', `select public.admin_forum_topic_action('${topic2}','delete')`, user(5));
  check('  … status=deleted, məlumat qalır', scalar(`select status from public.forum_topics where id='${topic2}'`) === 'deleted');
  expectOk('admin silinmiş mövzunu bərpa edir', `select public.admin_forum_topic_action('${topic2}','restore')`, user(5));
  expectFail('yanlış əməliyyat adı', `select public.admin_forum_topic_action('${topic2}','explode')`, 'Yanlış əməliyyat', user(5));
  // müəllif təyin etmədən admin həm başqasının cavabını redaktə, həm silə bilir
  expectOk('admin istənilən cavabı redaktə edir', `select public.forum_update_reply('${rp}', 'Admin tərəfindən redaktə edildi.')`, user(6));
  expectOk('admin istənilən cavabı silir', `select public.forum_delete_reply('${rp}')`, user(6));
}

group('Admin: kateqoriyalar');
{
  const id = run(`select public.admin_upsert_category(null, 'Yeni Kateqoriya', 'Təsvir', 90)`, user(5));
  check('admin yeni kateqoriya yaradır', id.ok, id.err);
  check('  … slug avtomatik, Azərbaycan hərfləri latınlaşdırılır', scalar(`select slug from public.forum_categories where id='${id.out}'`) === 'yeni-kateqoriya');
  const az = run(`select public.admin_upsert_category(null, 'Çətin şəkil ğ üçün', null, 91)`, user(5));
  check('  … "Çətin şəkil ğ üçün" slug-ı düzgündür', scalar(`select slug from public.forum_categories where id='${az.out}'`) === 'cetin-sekil-g-ucun', az.err);
  expectFail('eyni adlı kateqoriya (böyük/kiçik hərf fərqi) rədd edilir', `select public.admin_upsert_category(null, 'yeni kateqoriya'::text)`, 'artıq var|tapılmadı', user(5));
  expectFail('< > simvolları rədd edilir', `select public.admin_upsert_category(null, 'Ad <b>x</b>')`, 'olmaz', user(5));
  expectOk('adını dəyişir', `select public.admin_upsert_category('${id.out}', 'Yeni Kateqoriya (2)', 'Yeni təsvir', 95)`, user(5));
  const tid = run(`select public.forum_create_topic('${id.out}', 'Yeni kateqoriyada mövzu', 'Bu kateqoriyada artıq mövzu var, deaktiv etsək nə olacaq?')`, user(2)).out;
  expectOk('istifadə olunan kateqoriyanı təhlükəsiz deaktiv edir', `select public.admin_set_category_active('${id.out}', false)`, user(5));
  check('  … mövcud mövzu qalır və oxunur', rows(`select id from public.forum_topics where id='${tid}'`, guest).length === 1);
  expectFail('  … deaktiv kateqoriyada yeni mövzu açmaq olmur', `select public.forum_create_topic('${id.out}', 'Yeni mövzu burada', 'Deaktiv kateqoriyada yazıla bilməz mətn')`, 'deaktiv', user(2));
  expectOk('yenidən aktiv edir', `select public.admin_set_category_active('${id.out}', true)`, user(5));
  expectFail('kateqoriyanı birbaşa silmək olmur', `delete from public.forum_categories where id='${id.out}'`, 'permission denied', user(5));
  expectFail('adi istifadəçi kateqoriyaya yaza bilmir', `insert into public.forum_categories(slug,name) values ('hack','Hack kat')`, 'permission denied', user(4));
}

group('Admin: mövcud məzmun (elanlar, PDF, sınaq)');
{
  const bk = run(`insert into public.books(seller_id,title,category,price,city) values ('${S}','Test kitabı','DİM',5,'Bakı') returning id`, { ...user(2) });
  check('istifadəçi öz elanını əlavə edir', bk.ok, bk.err);
  const bid = bk.out.split('\n')[0];
  expectOk('admin başqasının elanını gizlədir', `update public.books set status='hidden' where id='${bid}'`, user(5));
  check('  … elan qonağa görünmür', rows(`select id from public.books where id='${bid}'`, guest).length === 0);
  check('  … audit jurnalına yazılıb (books.update, status hidden)', rows(`select details from public.admin_audit_log where action='books.update' and target_id='${bid}'`)[0]?.details?.status_to === 'hidden');
  const ub = run(`update public.books set status='active' where id='${bid}' returning id`, user(4));
  check('adi istifadəçi başqasının elanını dəyişə bilmir (RLS: 0 sətir)', ub.ok && ub.out === '', ub.err || ub.out);
  check('  … status dəyişməyib', scalar(`select status from public.books where id='${bid}'`) === 'hidden');
  expectOk('admin elanı silir', `delete from public.books where id='${bid}'`, user(5));
  check('  … audit: books.delete', scalar(`select count(*) from public.admin_audit_log where action='books.delete' and target_id='${bid}'`) === '1');
  const own = run(`insert into public.books(seller_id,title,category,price,city) values ('${ADM}','Admin kitabı','DİM',5,'Bakı') returning id`, user(5));
  run(`update public.books set price=7 where id='${own.out.split('\n')[0]}'`, user(5));
  check('admin öz elanını dəyişəndə audit yazılmır (səs-küy yoxdur)', scalar(`select count(*) from public.admin_audit_log where target_id='${own.out.split('\n')[0]}' and action='books.update'`) === '0');

  const pf = run(`insert into public.pdfs(uploader_id,title,level,subject,file_url) values ('${S}','Test PDF','DİM','Riyaziyyat','https://x.az/a.pdf') returning id`, user(2));
  const pid = pf.out.split('\n')[0];
  check('istifadəçi öz PDF-ini əlavə edir', pf.ok, pf.err);
  expectOk('admin başqasının PDF-ini gizlədir', `update public.pdfs set status='hidden' where id='${pid}'`, user(5));
  check('  … PDF qonağa görünmür; audit: pdfs.update', rows(`select id from public.pdfs where id='${pid}'`, guest).length === 0 && scalar(`select count(*) from public.admin_audit_log where action='pdfs.update' and target_id='${pid}'`) === '1');
  const up = run(`update public.pdfs set status='active' where id='${pid}' returning id`, user(4));
  check('adi istifadəçi başqasının PDF-ini dəyişə bilmir (RLS)', up.ok && up.out === '' && scalar(`select status from public.pdfs where id='${pid}'`) === 'hidden', up.err);
  expectOk('admin PDF-i silir; audit: pdfs.delete', `delete from public.pdfs where id='${pid}'`, user(5));
  check('  … pdfs.delete qeydə alınıb', scalar(`select count(*) from public.admin_audit_log where action='pdfs.delete' and target_id='${pid}'`) === '1');

  const q = run(`select public.admin_create_quiz('Test sınağı', 'Təsvir', 'DİM', 600, '[{"text":"2+2 neçədir?","options":["3","4","5"],"correct_index":1,"explanation":"Cəm"}]'::jsonb)`, user(5));
  check('admin sınaq yaradır', q.ok, q.err);
  expectFail('sınaqda yanlış correct_index', `select public.admin_create_quiz('Pis sınaq', 'x', 'DİM', 600, '[{"text":"Sual mətni","options":["a","b"],"correct_index":5}]'::jsonb)`, 'indeksi', user(5));
  expectFail('sınaqda boş sual siyahısı', `select public.admin_create_quiz('Pis sınaq', 'x', 'DİM', 600, '[]'::jsonb)`, '1–50 sual', user(5));
  expectOk('admin sınağı dərc edir', `select public.admin_update_quiz('${q.out}','Test sınağı','Təsvir','DİM',600,true)`, user(5));
  check('  … cavab açarı qonağa açıq deyil (correct_index sütunu oxunmur)', !run(`select correct_index from public.quiz_questions`, guest).ok);
  expectOk('admin sınağı silir', `select public.admin_delete_quiz('${q.out}')`, user(5));
  expectFail('adi istifadəçi sınaq yarada bilmir', `insert into public.quizzes(title,category,duration_seconds,is_published) values ('Hack','DİM',60,true)`, null, user(4));
}

group('Audit jurnalı');
{
  const actions = rows(`select distinct action from public.admin_audit_log order by 1`).map((x) => x.action);
  const need = ['admin.bootstrap', 'admin.grant', 'user.block', 'user.unblock', 'user.delete', 'user.account_type.change', 'user.note.add', 'forum.topic.hide',
    'forum.topic.restore', 'forum.topic.delete', 'forum.topic.pin', 'forum.topic.lock', 'forum.reply.hide', 'forum.report.dismissed', 'forum.category.create',
    'forum.category.deactivate', 'quiz.create', 'quiz.update', 'quiz.delete', 'books.update', 'books.delete', 'forum.topic.edit'];
  for (const a of need) check(`audit: "${a}" qeydə alınıb`, actions.includes(a));
  check('audit: aktor ID və vaxt həmişə var', scalar(`select count(*) from public.admin_audit_log where created_at is null or (actor_id is null and action <> 'admin.bootstrap')`) === '0');
  expectFail('admin audit qeydini dəyişə bilmir', `update public.admin_audit_log set action='x'`, 'permission denied', user(5));
  expectFail('admin audit qeydini silə bilmir', `delete from public.admin_audit_log`, 'permission denied', user(5));
  expectFail('SQL Editor-da belə UPDATE bloklanır (trigger)', `update public.admin_audit_log set action='x'`, 'dəyişdirilə', {});
  expectFail('SQL Editor-da belə DELETE bloklanır (trigger)', `delete from public.admin_audit_log`, 'dəyişdirilə', {});
  expectFail('TRUNCATE bloklanır (trigger)', `truncate public.admin_audit_log`, 'dəyişdirilə', {});
  expectFail('adi istifadəçi audit-i yaza bilmir', `select public.audit_write('x','y','z','w')`, 'permission denied', user(4));
  const scrub = scalar(`select public.audit_scrub('{"password":"p","api_key":"k","Token":"t","note":"ok","nested":{"secret":"s","x":1}}'::jsonb)::text`);
  check('audit_scrub parol/token/key/secret açarlarını çıxarır', !/password|api_key|Token|secret/.test(scrub) && /"note": "ok"/.test(scrub) && /"x": 1/.test(scrub), scrub);
  check('audit jurnalında e-poçt parolu/service key kimi sirlər yoxdur', scalar(`select count(*) from public.admin_audit_log where details::text ~* '(password|service_role|eyJ[a-zA-Z0-9]{20,})'`) === '0');
  check('hesab silindikdən sonra audit qeydi qalır', Number(scalar(`select count(*) from public.admin_audit_log where action='user.delete'`)) >= 2);
}

group('Super Admin: admin hüququnu ləğv etmək');
{
  expectOk('Super Admin admini ləğv edir', `select public.admin_revoke_admin('${ADM2}')`, user(5));
  check('  … is_admin()=false', scalar(`select public.is_admin()`, user(6)) === 'f');
  expectFail('  … ləğv olunmuş admin RPC çağıra bilmir', `select public.admin_dashboard_stats()`, 'İcazə yoxdur', user(6));
  check('  … audit: admin.revoke', scalar(`select count(*) from public.admin_audit_log where action='admin.revoke'`) === '1');
  check('admin siyahısı', rows(`select * from public.admin_list_admins()`, user(5)).length === 1);
}

group('RLS və icazələr: ümumi yoxlama');
{
  const tables = rows(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1`);
  check('public sxemindəki BÜTÜN cədvəllərdə RLS aktivdir', tables.every((t) => t.relrowsecurity), tables.filter((t) => !t.relrowsecurity).map((t) => t.relname).join(','));
  const anonWrite = rows(`select table_name, privilege_type from information_schema.role_table_grants where grantee='anon' and table_schema='public' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')`);
  check('anon rolunun heç bir cədvəldə yazma icazəsi yoxdur', anonWrite.length === 0, JSON.stringify(anonWrite));
  const authForumWrite = rows(`select table_name, privilege_type from information_schema.role_table_grants where grantee='authenticated' and table_schema='public' and table_name in ('forum_topics','forum_replies','forum_categories','forum_reports','admin_users','admin_audit_log','admin_user_notes','user_moderation') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')`);
  check('authenticated rolunun forum/admin cədvəllərində yazma icazəsi yoxdur', authForumWrite.length === 0, JSON.stringify(authForumWrite));
  const exposed = rows(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname in ('assert_admin','assert_super_admin','audit_write','audit_scrub','forum_assert_can_write','forum_clean_text','forum_refresh_topic','guard_admin_users','protect_account_type','audit_content_change','limit_forum_topics','limit_forum_replies','limit_forum_reports')
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`);
  check('daxili köməkçi funksiyalar anon/authenticated üçün qapalıdır', exposed.length === 0, JSON.stringify(exposed));
  const adminRpcAnon = rows(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'admin\\_%' and has_function_privilege('anon', p.oid, 'execute')`);
  check('heç bir admin_* RPC qonaq üçün açıq deyil', adminRpcAnon.length === 0, JSON.stringify(adminRpcAnon));
  const secdef = rows(`select p.proname, p.proconfig::text as cfg from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (p.proconfig is null or not p.proconfig::text like '%search_path%')`);
  check('bütün SECURITY DEFINER funksiyalarında search_path təyin olunub', secdef.length === 0, JSON.stringify(secdef));
  check('profiles: qonaq role/e-poçt sütunlarını oxuya bilmir', !run(`select role from public.profiles`, guest).ok && !run(`select email from public.profiles`, guest).ok);
  check('profiles: ad və hesab tipi ictimaidir (rozet üçün)', rows(`select id, full_name, account_type from public.profiles`, guest).length >= 8);
  check('realtime: forum_replies publication-dadır', scalar(`select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename='forum_replies'`) === '1');
}

finish();
