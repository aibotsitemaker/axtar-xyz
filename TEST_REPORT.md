# TEST_REPORT — TəhsilHub v6.2

## Supabase schema cache audit (v6.2 düzəlişi)

- Feed UI `public.feed_posts` cədvəlinə yazır; cədvəl yalnız `09_social_trust_views.sql` ilə yaradılır. Axtarış UI `global_search`-i `p_query` və `p_kind` adlı arqumentlərlə çağırır; funksiya yalnız 10-cu miqrasiyada yaradılır. Hər iki obyekt çatışmırsa, ilk ehtimal deploy edilmiş DB-də 09/10 miqrasiyalarının buraxılmasıdır; obyektlər DB-də olsa da PostgREST onları tapmırsa, schema cache-i, API-də `public` schema-nın açıq olduğunu və tətbiqin düzgün Supabase layihəsinə qoşulduğunu yoxlamaq lazımdır. Tipik kodlar PGRST205/PGRST202-dir.
- 10-cu miqrasiyada `CREATE OR REPLACE FUNCTION` parametr adlarını əvvəlki `(text,text)` funksiyadan dəyişə bilməz. 10-da explicit drop/create əlavə edildi; 11-ci idempotent bərpa miqrasiyası bunu ayrıca düzəldir.
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
- `next build --webpack` yenidən icra edildi: kompilyasiya, TypeScript, 32/32 static page prerender və build trace mərhələləri uğurla tamamlandı. İlk `EPERM` Next.js worker-in sandbox-da `build-output` alt qovluqlarını yarada bilməməsi idi; yalnız build output qovluğuna yazma icazəsi verildikdən sonra build keçdi. Tətbiq kodunda build xətası aşkar edilmədi.
- Miqrasiyalar Supabase-də icra edilməyib; canlı DB/RLS, e-poçt, storage, brauzer və mobil yoxlamaları aparılmayıb.

## Deploy konfiqurasiya

- Canlı DB-yə qoşulma və Supabase SQL Editor-də miqrasiyaların icrası bu iş zamanı mümkün olmayıb. Mövcud bazada obyekt yoxdursa, 09 → 10 → 11 ardıcıllığını tətbiq edin; 09/10 əvvəldən işlədilibsə, 11-i tətbiq edin.
- Guest view endpoint üçün Vercel-də server-only `SUPABASE_SERVICE_ROLE_KEY` və 32+ simvollu `VIEW_SESSION_SECRET` təyin edilməlidir. Bu açarları `NEXT_PUBLIC_` ilə başlamayın və brauzerə ötürməyin.
- SQL-i canlı məlumat bazasında icra etməzdən əvvəl backup yaradın. 06–08 faylları təkrar icra olunmur.

## Qalan məhdudiyyətlər

- E-poçt bildirişləri inteqrasiya olunmayıb; bildirişlər platforma daxilində göstərilir.
- Canlı Supabase, e-poçt göndərişi, storage və brauzer/mobil axınları bu mühitdə yoxlanmayıb.
