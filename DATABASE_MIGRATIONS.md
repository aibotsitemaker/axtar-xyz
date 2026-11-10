# Verilənlər bazası miqrasiyaları

Mövcud bazada 06, 07 və 08 artıq icra olunubsa, onları təkrar işlətməyin. Əgər 09 hələ işlədilməyibsə, `09_social_trust_views.sql`-i, sonra `10_workflows_and_quiz_security.sql`-i Supabase Dashboard → SQL Editor bölməsində ardıcıllıqla icra edin. Əgər 09 əvvəlki buraxılışda artıq icra olunubsa, 10-u işlədin. Bu əlavələr mövcud məzmunu silmir. Hər ikisi PostgREST schema cache üçün `NOTIFY pgrst, 'reload schema'` göndərir.

## Supabase REST/API uyğunluğu və Feed/Axtarış xətaları

`feed_posts` cədvəli 09-cu miqrasiyada, `global_search(p_query text, p_kind text)` isə 10-cu miqrasiyada yaranır. Onlardan biri schema cache-də tapılmırsa, əvvəl miqrasiya statusunu SQL Editor-də yoxlayın:

```sql
select to_regclass('public.feed_posts') as feed_posts,
       to_regprocedure('public.global_search(text,text)') as global_search,
       (select proargnames[1:2] from pg_proc where oid = to_regprocedure('public.global_search(text,text)')) as search_argument_names;
```

Gözlənilən nəticə: `feed_posts` mövcuddur, `global_search` funksiyası mövcuddur, parametr adları `{p_query,p_kind}`-dir. Əgər cədvəl yoxdursa, 09, sonra 10, sonra 11-i icra edin. Cədvəl varsa, amma funksiya yoxdursa və ya parametr adları fərqlidirsə, 10 və sonra `11_supabase_postgrest_compatibility.sql` işlədin. 11-ci miqrasiya əvvəlcədən V6 cədvəllərinin mövcudluğunu yoxlayır, axtarış funksiyasını düzgün parametr adları ilə yenidən yaradır və schema cache-i yeniləyir; təhlükəsiz təkrar icra oluna bilər.

10-cu miqrasiya legacy `check_answer`/`submit_quiz_attempt` RPC-lərini mövcudluğu dəyişə bilən obyektlər hesab edir: 02 miqrasiyası onları yaradır, `99_rollback.sql` isə silir. 10-cu miqrasiya onları bərpa etmir; yalnız mövcud olduqda icazələrini ləğv edir və yeni `quiz_sessions` axınını yaradır. 10 tətbiqi ortada xətaya düşərsə, yalnız qalan hissəni işlətməyin; yenilənmiş tam faylı transaction daxilində yenidən icra edin.

Əgər DB-də cədvəl və funksiya gözlənilən şəkildə görünür, lakin PostgREST yenə `PGRST205`/`PGRST202` qaytarırsa, SQL Editor-də `NOTIFY pgrst, 'reload schema';` icra edin. Supabase Project Settings → API/Data API-də `public` schema-nın Exposed schemas siyahısında olduğunu, həmçinin tətbiqin həmin Supabase layihəsinin URL/anon key cütünü istifadə etdiyini yoxlayın. `PGRST202` funksiya imzasının cache-də görünməməsi və ya API çağırışındakı parametr adlarının fərqlənməsi ilə də əlaqəli ola bilər.

Yeni Supabase quruluşunda ilkin 01–08 sırasını DEPLOY.md sənədinə əsasən icra edin, daha sonra 09, 10 və 11-i işlədin. 08 birdəfəlik Super Admin başlanğıc miqrasiyasıdır. Bu ZIP-də 06–08 faylları dəyişdirilməyib.

## Geri qaytarma

Avtomatik rollback verilməyib: yeni istifadəçi məzmununu səhvən silmək risklidir. Tətbiqdən əvvəl Supabase backup yaradın. Lazım gələrsə yalnız yeni `feed_*`, `teacher_reviews`, `verification_requests`, `content_views` obyektlərini ayrı-ayrılıqda DBA köməyi ilə geri alın. `profiles.is_verified` sütununu silmək təsdiqlənmiş hesab məlumatlarını itirər.

## v6.3 — platforma tamamlanması

`12_platform_completion.sql` 11-ci miqrasiyadan sonra tətbiq olunur. Mövcud məlumatları saxlayır və təhlükəsiz təkrar icra üçün yazılıb. `03_hardening_phase2.sql` profil sütun icazələrini yenidən qurduğu üçün 12-ci miqrasiya `is_verified` üçün yalnız oxu icazəsini ayrıca verir; bu bayraq Feed, axtarış və profil müəllif kartlarında istifadə olunur. Eyni miqrasiya Feed mention bildirişlərini, şikayət/moderasiya cədvəlini, məxfi olmayan profil statistikası RPC-sini, yalnız təhvil verilmiş sessiyalarda cavab açarlarını göstərən quiz review RPC-sini və vaxtı bitmiş sınaq sessiyasının nəticəyə çevrilməsini əlavə edir.

Mövcud DB-də növbəti buraxılış üçün:

- 09, 10 və 11 tətbiq olunmayıbsa, onları həmin ardıcıllıqla tətbiq edin, sonra 12-ni işlədin.
- 09–11 tətbiq olunubsa, yalnız 12-ni işlədin.
- 06–08-i mövcud bazada təkrar işlətməyin. Bu iş zamanı canlı Supabase DB-yə qoşulub heç bir dəyişiklik edilməyib.

## v6.5 — sınaq nəticələrinin timeout uyğunluğu

v6.3 verilənlər bazasına yeniləmə üçün 09–12 artıq tətbiq olunubsa, yalnız `13_quiz_question_types.sql` faylını Supabase SQL Editor-də bir dəfə işlədin. Bu additive miqrasiya mövcud quiz suallarına köhnə davranışla uyğun `single` tipi və əvvəlki `correct_index`-dən cavab dəsti əlavə edir; cəhdlər, cavablar və nəticə tarixçəsi silinmir. 06–08-ə toxunmur.

13-cü fayl beş sual tipini, bal çəkisini, təhlükəsiz JSON cavab saxlama RPC-sini, serverdə yekun qiymətləndirməni, yekundan sonrakı təhlili və müəllimin öz testini yaratma/yayımlama RPC-lərini əlavə edir. Sual cavab açar sütunları API oxu icazəsindən kənarda qalır. Funksiyalar PostgREST schema cache-i `NOTIFY pgrst, 'reload schema'` ilə yeniləyir. Tətbiqdən əvvəl backup alın; miqrasiya PGlite izolyasiya testində iki dəfə tətbiq edilərək yoxlanıb, lakin canlı layihədə hələ işlədilməyib.

