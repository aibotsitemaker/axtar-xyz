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

Əgər DB-də cədvəl və funksiya gözlənilən şəkildə görünür, lakin PostgREST yenə `PGRST205`/`PGRST202` qaytarırsa, SQL Editor-də `NOTIFY pgrst, 'reload schema';` icra edin. Supabase Project Settings → API/Data API-də `public` schema-nın Exposed schemas siyahısında olduğunu, həmçinin tətbiqin həmin Supabase layihəsinin URL/anon key cütünü istifadə etdiyini yoxlayın. `PGRST202` funksiya imzasının cache-də görünməməsi və ya API çağırışındakı parametr adlarının fərqlənməsi ilə də əlaqəli ola bilər.

Yeni Supabase quruluşunda ilkin 01–08 sırasını DEPLOY.md sənədinə əsasən icra edin, daha sonra 09, 10 və 11-i işlədin. 08 birdəfəlik Super Admin başlanğıc miqrasiyasıdır. Bu ZIP-də 06–08 faylları dəyişdirilməyib.

## Geri qaytarma

Avtomatik rollback verilməyib: yeni istifadəçi məzmununu səhvən silmək risklidir. Tətbiqdən əvvəl Supabase backup yaradın. Lazım gələrsə yalnız yeni `feed_*`, `teacher_reviews`, `verification_requests`, `content_views` obyektlərini ayrı-ayrılıqda DBA köməyi ilə geri alın. `profiles.is_verified` sütununu silmək təsdiqlənmiş hesab məlumatlarını itirər.
