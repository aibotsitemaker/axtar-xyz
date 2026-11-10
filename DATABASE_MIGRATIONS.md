# Verilənlər bazası miqrasiyaları

Mövcud bazada 06, 07 və 08 artıq icra olunubsa, onları təkrar işlətməyin. Mövcud məlumatlara toxunmadan yalnız `09_social_trust_views.sql` faylını Supabase Dashboard → SQL Editor bölməsində icra edin. Bu miqrasiya forum, mövcud profillər və əsas cədvəlləri silmir.

Yeni v6 quruluşda köhnə sxem olmadığı halda, layihənin öz DEPLOY.md sənədindəki ilkin sıra ilə əvvəlcə 01–07, sonra bir dəfəlik 08, sonda 09 işlədilir. Bu ZIP-də 06–08 faylları dəyişdirilməyib.

## Geri qaytarma

Avtomatik rollback verilməyib: yeni istifadəçi məzmununu səhvən silmək risklidir. Tətbiqdən əvvəl Supabase backup yaradın. Lazım gələrsə yalnız yeni `feed_*`, `teacher_reviews`, `verification_requests`, `content_views` obyektlərini ayrı-ayrılıqda DBA köməyi ilə geri alın. `profiles.is_verified` sütununu silmək təsdiqlənmiş hesab məlumatlarını itirər.
