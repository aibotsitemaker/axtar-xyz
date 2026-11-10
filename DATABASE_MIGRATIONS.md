# Verilənlər bazası miqrasiyaları

Mövcud bazada 06, 07 və 08 artıq icra olunubsa, onları təkrar işlətməyin. Əgər 09 hələ işlədilməyibsə, `09_social_trust_views.sql`-i, sonra `10_workflows_and_quiz_security.sql`-i Supabase Dashboard → SQL Editor bölməsində ardıcıllıqla icra edin. Əgər 09 əvvəlki buraxılışda artıq icra olunubsa, yalnız 10-u işlədin. Bu əlavələr mövcud məzmunu silmir.

Yeni Supabase quruluşunda ilkin 01–08 sırasını DEPLOY.md sənədinə əsasən icra edin, daha sonra 09 və 10-u işlədin. 08 birdəfəlik Super Admin başlanğıc miqrasiyasıdır. Bu ZIP-də 06–08 faylları dəyişdirilməyib.

## Geri qaytarma

Avtomatik rollback verilməyib: yeni istifadəçi məzmununu səhvən silmək risklidir. Tətbiqdən əvvəl Supabase backup yaradın. Lazım gələrsə yalnız yeni `feed_*`, `teacher_reviews`, `verification_requests`, `content_views` obyektlərini ayrı-ayrılıqda DBA köməyi ilə geri alın. `profiles.is_verified` sütununu silmək təsdiqlənmiş hesab məlumatlarını itirər.
