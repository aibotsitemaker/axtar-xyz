# TEST_REPORT — TəhsilHub v6.1

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

- v5 ZIP açıldı, əvvəlki fayllar və 06–09 miqrasiyaları saxlanıldı; `10_workflows_and_quiz_security.sql` yeni əlavə edildi.
- `npm ci` eyni package manifest və lock faylı ilə ayrılmış yoxlama qovluğunda uğurla tamamlandı.
- `npm run lint -- --quiet` uğurla başa çatdı: 0 xəta.
- `npm test --prefix tests/db`: 75 mövcud sxem testi, 42 yeni Supabase layihə testi və V6/V6.1 testləri keçdi. PGlite təcrid olunmuş stub-da 09/10 miqrasiyaları iki dəfə tətbiq edildi; quiz server sessiyası, autosave, server qiymətləndirməsi, idempotency, təhlükəsiz sütunlar, qonaq deduplikasiyası/IP limiti, analitika tarixləri və qlobal axtarış yoxlandı.
- `next build --webpack`: webpack compilation və TypeScript mərhələləri keçdi. Prerender Windows sandbox-ın `build-output/server/app/_global-error.segments/_global-error` qovluğunu yarada bilməməsi səbəbilə `EPERM` ilə dayandı; tam production build uğurlu sayılmır.
- Miqrasiyalar Supabase-də icra edilməyib; canlı DB/RLS, e-poçt, storage, brauzer və mobil yoxlamaları aparılmayıb.

## Deploy konfiqurasiya

- Mövcud bazada 09 tətbiq olunubsa, yalnız 10 tətbiq edilir. Tətbiq edilməyibsə, əvvəl 09, sonra 10.
- Guest view endpoint üçün Vercel-də server-only `SUPABASE_SERVICE_ROLE_KEY` və 32+ simvollu `VIEW_SESSION_SECRET` təyin edilməlidir. Bu açarları `NEXT_PUBLIC_` ilə başlamayın və brauzerə ötürməyin.
- SQL-i canlı məlumat bazasında icra etməzdən əvvəl backup yaradın. 06–08 faylları təkrar icra olunmur.

## Qalan məhdudiyyətlər

- E-poçt bildirişləri inteqrasiya olunmayıb; bildirişlər platforma daxilində göstərilir.
- Canlı Supabase, e-poçt göndərişi, storage və brauzer/mobil axınları bu mühitdə yoxlanmayıb.
