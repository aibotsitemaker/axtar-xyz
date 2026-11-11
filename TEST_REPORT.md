# TEST_REPORT — TəhsilHub v6.9

Bu hesabat v6.3–v6.5 yoxlama tarixçəsini saxlayır; cari dizayn buraxılışı və son yoxlamalar v6.6 bölməsindədir.

## Supabase schema cache audit (v6.2 düzəlişi)

- Feed UI `public.feed_posts` cədvəlinə yazır; cədvəl yalnız `09_social_trust_views.sql` ilə yaradılır. Axtarış UI `global_search`-i `p_query` və `p_kind` adlı arqumentlərlə çağırır; funksiya yalnız 10-cu miqrasiyada yaradılır. Hər iki obyekt çatışmırsa, ilk ehtimal deploy edilmiş DB-də 09/10 miqrasiyalarının buraxılmasıdır; obyektlər DB-də olsa da PostgREST onları tapmırsa, schema cache-i, API-də `public` schema-nın açıq olduğunu və tətbiqin düzgün Supabase layihəsinə qoşulduğunu yoxlamaq lazımdır. Tipik kodlar PGRST205/PGRST202-dir.
- 10-cu miqrasiyada `CREATE OR REPLACE FUNCTION` parametr adlarını əvvəlki `(text,text)` funksiyadan dəyişə bilməz. 10-da explicit drop/create əlavə edildi; 11-ci idempotent bərpa miqrasiyası bunu ayrıca düzəldir.
- `check_answer(uuid,integer)` və `submit_quiz_attempt(uuid,jsonb,integer)` yalnız köhnə 02 miqrasiyasında yaradılır; 99 rollback onları bilərəkdən silir. 10-cu miqrasiya indi bu optional legacy RPC-ləri yalnız mövcud olduqda revoke edir, özü yaratmır.
- 09, 10, 11 miqrasiyaları `NOTIFY pgrst, 'reload schema'` göndərir. Ümumi API auditi Feed, axtarış, profil rəyləri, doğrulama, yadda saxlananlar, sınaq sessiyaları, admin, forum və mesaj/bildiriş cədvəl/RPC çağırışlarını SQL yaradılışı və icazələrlə tutuşdurdu; başqa çatışmayan cədvəl/RPC çağırışı aşkar edilmədi.

## Bu buraxılışda aradan qaldırılan əvvəlki hesabat çatışmazlıqları

- Quiz səhifəsi `check_answer` RPC-sinə müraciət etmir və cavab rəngini/nəticəsini sual başına göstərmir. Yeni `submit_quiz_attempt_once` yalnız yekunda serverdə yoxlayır və submission UUID ilə təkrar göndərişi idempotent edir. `10` migration REST API-dən `correct_index` və `explanation` sütunlarını da gizlədir, köhnə RPC icazəsini ləğv edir.
- Müəllim profillərində reytinq xülasəsi, rəy yazmaq, eyni istifadəçidən təkrar rəyi bloklama və admin moderasiyası əlavə edildi.
- Doğrulama müraciət forması, şəxsi müraciət statusu, admin qərar paneli, təsdiq/ləğv nişan sinxronizasiyası və bildiriş trigger-i əlavə edildi.
- Qlobal axtarış profillər, təsdiqlənmiş müəllimlər, kitab elanları, PDF-lər, forum mövzuları/cavabları və Feed paylaşımlarını əhatə edir.
- Feed bildirişləri mövcud inbox-a qoşuldu; post düzəlişi, populyar sıralama, cavaba cavab və link köçürmə əlavə olundu.
- Forum, Feed və müəllim profilini yadda saxlamaq və profil siyahısından silmək əlavə olundu. Kitab/PDF üçün v5 favorit mexanizmi qorunub saxlanıb.
- Admin panelində v6 cəmləri, 7/30/90 günlük interval seçimi və gündəlik baxış qrafiki var.
- Feed populyarlığı serverdə ümumi reaksiya və baxışlara görə sıralanır; son 40 elementə məhdud deyil.
- Sınaqlar server deadline ilə işləyir, aktiv sessiya bərpa olunur və cavablar hər seçimdən sonra serverdə saxlanır.
- Mövcud PDF/kitab favoritləri `saved_content`-ə miqrasiya zamanı köçürülür; əlavə/silmə vahid RPC ilə sinxron işləyir.
- Qonaq baxışlarının IP limiti DB-də atomik saxlanır, imzalı qonaq sessiyası ilə təkrarlanan sayım bloklanır.
- Qonaq baxışları HttpOnly imzalı cookie + server-only Supabase service-role endpoint vasitəsilə qeydə alınır; anon rolunun guest RPC çağırışı bağlanıb və saatlıq deduplikasiya qorunur.

## Bu mühitdə aparılan yoxlamalar

- v5 ZIP-dən əvvəlki funksiyalar və 06–08 miqrasiyaları saxlanıldı; 09/10 genişləndirildi, 11-ci uyğunluq miqrasiyası əlavə edildi.
- `npm ci` eyni package manifest və lock faylı ilə ayrılmış yoxlama qovluğunda uğurla tamamlandı.
- `npm run lint -- --quiet` yenidən uğurla başa çatdı: 0 xəta.
- `npm test --prefix tests/db` yenidən uğurla başa çatdı: 75 sxem testi, 42 layihə testi və V6.2 yoxlamaları keçdi. PGlite-də 09, 10 və 11-ci miqrasiyalar təkrar tətbiq edildi; quiz server sessiyası, autosave, server qiymətləndirməsi, idempotency, təhlükəsiz sütunlar, qonaq deduplikasiyası/IP limiti, analitika tarixləri və qlobal axtarış yoxlandı.
- PGlite V6 migration testi əvvəlki parametr sırası `(p_kind,p_query)` olan search RPC-ni simulyasiya edib 11-ci miqrasiyadan sonra `{p_query,p_kind}` düzgünlüyünü və təkrar icranı yoxlayır.
- PGlite sınağı həmçinin 99 rollback vəziyyətini simulyasiya edib `check_answer` və legacy submit RPC-si olmadıqda 10-cu miqrasiyanın tam tətbiq olunduğunu təsdiqləyir.
- v6.2 əvvəlki yoxlamasında `next build --webpack` kompilyasiya, TypeScript və 32/32 prerender mərhələlərindən keçmişdi. Bu tarixçə v6.3 build nəticəsini əks etdirmir; cari nəticə aşağıda ayrıca qeyd olunub.
- Miqrasiyalar Supabase-də icra edilməyib; canlı DB/RLS, e-poçt, storage, brauzer və mobil yoxlamaları aparılmayıb.

## Deploy konfiqurasiya

- Canlı DB-yə qoşulma və Supabase SQL Editor-də miqrasiyaların icrası bu iş zamanı mümkün olmayıb. Mövcud bazada obyekt yoxdursa, 09 → 10 → 11 → 12 ardıcıllığını tətbiq edin; 09–11 artıq tətbiq olunubsa, 12-ni işlədin.
- Guest view endpoint üçün Vercel-də server-only `SUPABASE_SERVICE_ROLE_KEY` və 32+ simvollu `VIEW_SESSION_SECRET` təyin edilməlidir. Bu açarları `NEXT_PUBLIC_` ilə başlamayın və brauzerə ötürməyin.
- SQL-i canlı məlumat bazasında icra etməzdən əvvəl backup yaradın. 06–08 faylları təkrar icra olunmur.

## Qalan məhdudiyyətlər

- E-poçt bildirişləri inteqrasiya olunmayıb; bildirişlər platforma daxilində göstərilir.
- Canlı Supabase, e-poçt göndərişi, storage və brauzer/mobil axınları bu mühitdə yoxlanmayıb.

## v6.3 yekun audit və yoxlamalar

- Miqrasiya auditində `03_hardening_phase2.sql` profil `SELECT` icazələrini sıfırladıqdan sonra `09_social_trust_views.sql` ilə əlavə edilən `profiles.is_verified` üçün API oxu icazəsi verilmədiyi tapıldı. `12_platform_completion.sql` yalnız bu sütunu anon/authenticated üçün açır.
- Tamamlanmayan funksiyalar: avatar yükləmə/silmə, açıq/tünd görünüş, profil fəaliyyəti statistikası, Feed-də istifadəçi qeyd etmə və şikayət, admin şikayət baxışı, sınaqda sual gəzişi/cavabı dəyişmə və təhvil sonrası izahlı təhlil tamamlandı.
- Sınaq cavabları bağlantı kəsiləndə cihazda müvəqqəti saxlanır və internet qayıdanda serverə göndərilir. Düzgün cavab açarı yalnız sessiya təhvil verildikdən sonra `quiz_session_review` ilə görünür. Vaxtı bitmiş aktiv sessiya yeni sınaq başlayanda yekunlaşdırılır.
- `tests/db/test_v6_migrations.mjs` 09–12 miqrasiyalarının təkrar tətbiqini, quiz sessiyasının təhlükəsiz təhlilini, `is_verified` icazəsini, profil statistikası, mention bildirişi və şikayət moderasiyasını yoxlayır.
- `npm run lint -- --quiet` uğurla tamamlandı.
- `npm test --prefix tests/db` uğurla tamamlandı: 75 sxem testi, 42 layihə testi və V6.3 PGlite miqrasiya yoxlamaları keçdi; 09–12 iki dəfə tətbiq edildi.
- `npm run build -- --webpack` standart mənbə `next.config.js` konfiqurasiyası ilə uğurla tamamlandı: webpack kompilyasiyası, TypeScript yoxlaması, 33/33 static page prerender, optimizasiya və build trace keçdi. `next.config.js`-ə build üçün daimi workaround əlavə edilməyib.
- EPERM-in kök səbəbi Codex-in məhdud sandbox icra rejimində Next.js-in build child process-lərinin çıxış qovluqlarında yeni qovluq yarada bilməməsi idi. Həmin rejimdə Windows ACL istifadəçiyə `FullControl` versə və əsas Node prosesi `mkdir` edə bilsə də, Next build worker-ləri EPERM alırdı. Bu yoxlama üçün Full access müvəqqəti aktivləşdiriləndən sonra eyni layihə, standart konfiqurasiya və production build tam keçdi. Deməli xəta tətbiq kodunda deyildi; full access-i sonradan əvvəlki sandbox rejiminə qaytarmaq olar.
- Testlər PGlite izolyasiya mühitində işləyir. Canlı Supabase cədvəl/RLS/storage davranışı, e-poçt və real brauzer/mobil cihazlar yoxlanmayıb; miqrasiya canlı layihədə icra edilməyib.

## v6.4 — yekun iş və yoxlama (2026-11-10)

- Sınaq sistemi auditi əvvəlki modelin yalnız `correct_index` ilə tək seçim qiymətləndirdiyini aşkar etdi. Additive `13_quiz_question_types.sql` legacy sınaq suallarını `single` kimi saxlayır və `multiple`, `boolean`, `text`, `numeric` növlərini əlavə edir. Hər sualın çəkili balı 0–100 aralığında saxlanır.
- Serverdə JSON cavab autosave, deadline/sessiya sahibi yoxlama, tam çoxseçimli uyğunluq, normalizasiya edilmiş mətn müqayisəsi, numeric tolerance, çəkili faiz balı və yekundan sonrakı sual təhlili əlavə olundu. Correct answer columns PostgREST-dən bağlı qalır. Köhnə RPC-lər legacy uyğunluq üçün saxlanılıb.
- Admin sınaq forması bütün beş növü qəbul edir. Müəllimlərdə **Sınaqlarımı idarə et** bölməsi, draft yaradıcılığı, dərc/dərcdən çıxarma, RLS sahibi yoxlaması və audit log əlavə olundu.
- `tests/db/test_v6_migrations.mjs`: 09–13 miqrasiyalarını təkrar tətbiq etmə, köhnə sessiyanın idempotency-si, cavab açarı grant-ları, yeni sual növlərinin server hesablaması/balları/təhlili və müəllim create/publish axını keçdi. Bütün DB test komandası uğurla başa çatdı: 75 sxem yoxlaması + 42 yeni layihə yoxlaması + V6 migration ssenariləri.
- `npm run lint -- --quiet` uğurla keçdi. `npm run build -- --webpack` uğurla keçdi: compile, TypeScript və 34/34 static page prerender.
- 06–08 faylları və mövcud məlumatlar dəyişdirilməyib; canlı Supabase bazasına miqrasiya tətbiq olunmayıb. Mövcud v6.3 bazasında deploy etməzdən əvvəl ehtiyat nüsxə alın və yalnız 13-cü SQL faylını icra edin.
- Canlı Supabase, həqiqi istifadəçi hesabları ilə müəllim rol axını, brauzer cihazları, mail və storage bu mühitdən sınaqdan keçirilməyib. Full access build yoxlaması üçün müvəqqəti açılmışdı; iş bitəndən sonra istifadəçinin əvvəlki sandbox ayarını bərpa etməsi tövsiyə olunur.






## v6.5 — yekun audit və yoxlamalar (2026-11-10)

- Timeout sınağında aşkarlanmış kök səbəb: `start_quiz_session` vaxtı bitmiş sessiyanı köhnə single-choice scorer ilə yekunlaşdırırdı. 13-cü miqrasiya artıq `finish_quiz_session_v2`-yə yönləndirir.
- PGlite timeout yoxlaması typed quiz-də 2+1+3 çəkili balın (6/6) saxlanmasını, sessiyanın `expired` olmasını və növbəti sessiyanın açılmasını təsdiqləyir.
- `npm test --prefix tests/db`: 75 sxem və 42 layihə testi, 09–13 miqrasiya təkrar tətbiqi, PostgREST uyğunluğu, Feed/moderasiya, yeni sınaq növləri, timeout qiymətləndirməsi və avatar format yoxlamaları uğurla keçdi.
- `npm ci --no-audit --no-fund` və `npm run lint -- --quiet` uğurla tamamlandı.
- `npm run build -- --webpack` uğurla tamamlandı: webpack compile, TypeScript, 35/35 statik səhifə və build trace. Əvvəlki EPERM məhdud sandbox child-process davranışından yaranırdı; Full access mühitində standart build workaround-suz keçdi.
- Brauzer smoke/E2E yoxlaması bu iş stansiyasında əlçatan olmadı: yerli browser istifadəsi bağlıdır və Chromium binary yoxdur. Buna görə brauzer testi uğurlu kimi göstərilmir.
- Canlı Supabase-ə qoşulma və SQL icrası edilməyib; canlı RLS, Storage və e-poçt çatdırılması yoxlanmayıb. Mövcud v6.4 DB-si üçün backup-dan sonra yenilənmiş tam `13_quiz_question_types.sql` faylını bir dəfə tətbiq edin. 06–08 miqrasiyalarına toxunulmayıb.

## v6.6 — dizayn yenilənməsi üzrə yoxlama
- Ana marşrutda işlək sosial Feed göstərilir; mövcud Feed Supabase query/mutation-ları qorunub. Shell-də real marşrutlar, axtarış, dark-mode, hesab, mesaj/bildiriş counter-ları və müəllim tövsiyəsi var.
- Responsive CSS breakpoint-ləri: <1024px mobil alt naviqasiya; 1024–1359px iki sütun; ≥1360px üç sütun. Bu breakpoint-lər kodda yoxlanıb; browser screenshot/real cihaz yoxlaması mümkün olmadı.
- `npm run lint -- --quiet`, `npm test --prefix tests/db` (75 + 42 yoxlama və 09–13 migration ssenariləri) və `npm run build -- --webpack` uğurla tamamlandı; build 35/35 statik səhifə yaratdı.
- Backend, auth, SQL miqrasiyaları, mövcud Supabase yazma əməliyyatları və biznes məntiqi dəyişdirilməyib. İctimai profildə son aktiv Feed paylaşımlarını göstərmək üçün yalnız oxu sorğusu əlavə olunub.

Final dizayn kodundan sonra `npm run lint -- --quiet` və `npm run build -- --webpack` yenidən keçdi (35/35 statik səhifə). İctimai profilə real Feed paylaşımlarının oxunuşu və görünüşü də əlavə edildi; DB sxemi və yazma axınları dəyişmədi.


## v6.7 — yeni sosial imkanların yoxlanması
- PGlite-də `14_social_features.sql` iki dəfə tətbiq edildi; image/question/poll postları, sorğu səsi və faizləri, yanlış media yolunun rəddi, 20/saat media limitinin 21-ci yükləməni bloklaması, teacher follow, project create və project bookmark yoxlandı.
- `npm run lint -- --quiet` və DB suite keçdi: 75 sxem yoxlaması, 42 layihə yoxlaması, V6.2–V6.7 ssenariləri və avatar/media imza sınaqları. Production build son UI versiyasından sonra ayrıca keçirilir.
- Brauzer screenshot və fiziki mobil test bu mühitdə browser istifadəsi bağlı olduğuna görə aparılmayıb; responsive breakpoint və DOM/CSS build səviyyəsində yoxlanıb. Canlı Supabase miqrasiyası icra edilməyib.
Son yekun production build: `npm run build -- --webpack` uğurla keçdi; TypeScript yoxlaması, build trace və 37/37 statik səhifə tamamlandı.

## v6.8 — profil, sınaq təsdiqi və verified hesab axınları

- Yeni `15_social_profiles_moderation_verification.sql` migration-ı 14-cü migration-dan sonra əlavə edildi. Əvvəlki migration faylları dəyişdirilmədi. `profiles.cover_url` və `profile-covers` Storage bucket/policy-ləri, quiz statusları və admin RPC-ləri, doğrulama admin RPC-ləri əlavə olundu.
- Profil API-si sessiyanı Supabase Auth ilə yoxlayır, fayl imzasını JPEG/PNG/WebP allowlist-i ilə yoxlayır, cover üçün 5 MB limit tətbiq edir, UUID fayl adı istifadə edir və avatarla ortaq saatlıq DB rate limitindən keçir. Cover dəyişmə/silmə zamanı əvvəlki sahib faylı təmizlənir; hesab silinməsində cover faylları da təmizlənir.
- İctimai və şəxsi profil header-ləri cover → avatar → ad/verified badge → məlumat/statistika ardıcıllığına keçirildi. Mobil görünüş üçün responsive Tailwind ölçüləri tətbiq olundu.
- Müəllimin quiz yaratması `pending` statusu ilə başlayır. Müəllimin publish RPC çağırışı yalnız təsdiq növbəsinə göndərir; RLS və cədvəl grant-ları digər istifadəçinin pending sınağını görə bilməsinə və birbaşa yayımlamasına imkan vermir. Admin səhifəsi bütün sual və cavabları RPC vasitəsilə göstərir, təsdiq/rədd/qaralama/silmə əməliyyatları audit yazır. Mövcud yayımlanmış/qaralama quiz-lərin statusu backfill olunur.
- Verified müraciət qərarları cədvəldə birbaşa update grant-ı olmadan `assert_admin()` RPC-dən keçir. Adi istifadəçi statusu dəyişə bilmir; admin müraciəti təsdiqləyə/rədd edə, mavi tıkı birbaşa verə/götürə və siyahıları görə bilir. Bütün qərarlar audit log-a yazılır.
- `npm test --prefix tests/db` uğurla keçdi: 75 schema/security testi, 42 loyiha və workflow yoxlaması. PGlite-də 09–15 migration-lar iki dəfə tətbiq olundu. Yeni assertions quiz pending → admin published axınını, doğrulama statusunun adi istifadəçi update-i ilə dəyişmədiyini, müraciət təsdiqini və birbaşa verified grant-ı yoxladı.
- `npm run lint -- --quiet` uğurla keçdi. `npm run build -- --webpack` uğurla keçdi; 39/39 statik səhifə yaradıldı, `/admin/quizzes` və `/api/profile-cover` build nəticəsində mövcuddur.
- Browser screenshot və real Supabase layihəsində axın sınağı bu mühitdə mümkün olmadı (browser səthi və Supabase credentials qoşulu deyil). DB təhlükəsizlik davranışı PGlite-də, frontend route/build/Lint isə lokal layihədə yoxlanıb. Canlı DB-yə heç bir SQL tətbiq edilməyib; deploydan əvvəl backup alıb yalnız migration 15-i icra edin.

## v6.9 — Feed 500 kök səbəbi, DM və müzakirə otaqları (2026-11-12)

- **Təsdiqlənən 500 kök səbəbi:** Feed-də `FeedMedia` `safeUrl(...)` funksiyasını çağırırdı, amma funksiya müəyyən edilməmişdi. Şəkilli post render olunanda yaranan `ReferenceError` səhifənin error boundary-sinə çatıb bütöv Ana səhifəni 500 görünüşünə keçirirdi. Bu səbəb lokal Supabase mock-la işləyən Chromium brauzerində təkrarlandı və URL protokolunu HTTP(S) ilə məhdudlaşdıran köməkçi əlavə edildikdən sonra aradan qalxdı. Buna görə bütün istifadəçilər də eyni səhifə komponentində eyni render xətasına düşə bilərdi.
- Postun səhv media məlumatı ayrıca idarə olunur: media yolu UUID sahib qovluğu və təhlükəsiz fayl adı ilə yoxlanır; Storage URL exception/etibarsız dəyər qorunur; qırıq şəkil həmin paylaşımın yerli placeholder-ına çevrilir. Feed əsas post query-sini profil/bəyənmə/şərh sidecar query-lərindən ayırır və zəngin query uğursuz olduqda mətn üçün minimal fallback istifadə edir. Mövcud post və media məlumatları silinməyib.
- İctimai profilə **Mesaj yaz** düyməsi mövcud `get_or_create_conversation` RPC-sindən istifadə edir; auth yoxdursa girişə yönləndirir. Şəxsi söhbətin DB RLS/RPC mexanizmi saxlanıb.
- Yeni **Müzakirə otaqları** səhifəsi və `16_discussion_rooms.sql` otaq üzvlüyünü, mesaj tarixçəsini, RLS-i, üzv yoxlamasını və göndəriş rate limitini əlavə edir. Köhnə şəxsi mesaj bölməsi ayrıca **Şəxsi mesajlar** kimi saxlanıb. Otaq cədvəlləri ilə legacy şəxsi söhbət cədvəlləri ayrıdır.
- `npm test --prefix tests/db`: 75 schema/security testi, 42 layihə testi, migration 09–16 təkrar tətbiqi, text/image post, zədələnmiş media normallaşdırması, otağa qoşulma/göndəriş və üzv olmayanın oxu/göndəriş qadağası uğurla keçdi.
- `npm run lint -- --quiet` uğurla keçdi (0 xəta); `npm run build -- --webpack` uğurla keçdi (webpack compile, TypeScript, 40/40 statik səhifə, build trace).
- `tests/browser/smoke-v69.mjs` quraşdırılmış Chrome ilə uğurla keçdi: desktop və mobil Feed overflow yoxlaması; mətnli, şəkilli və zədələnmiş-media postlarının hamısının görünməsi; test şəkilinin yüklənib paylaşılması; profil mesajı düyməsinin söhbətə yönləndirməsi; müzakirə otağı səhifəsi. Testlər lokal Supabase mock istifadə edir.
- **Canlı mühit məhdudiyyəti:** canlı Supabase layihəsinin loglarına/DB-sinə credentials olmadığı üçün bağlanılmayıb; konkret istifadəçi postunun row ID-si və Storage obyektinin mövcudluğu prod DB-dən yoxlanmayıb. Kodda sübut olunan render crash-in kök səbəbi isə düzəldilib. Deployment üçün v6.8 DB-yə backup-dan sonra migration 16-nı tətbiq edin; canlı image Storage policy və API davranışını deploydan sonra real layihədə smoke test edin.
