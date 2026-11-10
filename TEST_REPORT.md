# Test hesabatı

## Bu dəyişikliklər üzrə nəticə

Bu mühitdə forum, istifadəçi tipləri, admin API və miqrasiya üçün real Supabase giriş məlumatları olmadığından DB inteqrasiyası, iki istifadəçi ilə RLS yoxlaması, e-poçt təsdiqi, Realtime websocket və admin bloklama/silmə real Supabase-də sınanmayıb. Miqrasiya heç bir test və ya production bazasında icra edilməyib.

- `npm run lint`: 0 xəta, 11 React effect xəbərdarlığı.
- `npm run build`: uğurlu, TypeScript mərhələsi daxil olmaqla 18 Next.js marşrutu yaradıldı.
- `cd tests/db && npm test`: 75 mövcud SQL testi və 61 yeni forum/admin testi; cəmi 136 keçən test, 0 uğursuz.
- Paket quraşdırılması zamanı npm audit 7 orta səviyyəli dependency xəbərdarlığı göstərdi. Bu işdə dependency versiyaları dəyişdirilməyib.

## Kod səviyyəsində yoxlanılanlar

- Kateqoriya, mövzu, cavab, şikayət, daxili bildiriş, audit log və `platform_admins` cədvəllərinə RLS əlavə olunub.
- Forum yazılarında müəllif ID-si, mətn uzunluğu, saatlıq limit və təkrar məzmun DB trigger-lərində yoxlanılır.
- Admin API hər sorğuda access token-i yoxlayıb `platform_admins` ilə tutuşdurur. Service key yalnız server mühitində tələb olunur.
- Admin icazəsi profil e-poçtuna və ya `profiles.role` sahəsinə əsaslanmır. Admin hesabı təsdiqlənəndən sonra ayrıca SQL ilə reyestrə əlavə edilməlidir.
- Admin service key verilmədikdə istifadəçi idarəetmə API-si `503` qaytarır; service key brauzerə göndərilmir.

## Məhdudiyyətlər

- Mövzu axtarışı DB-də alt-sətir uyğunluğuna əsaslanır, dilə uyğun leksik full-text indeks deyil. Admin reyestrini idarə etmək üçün UI yoxdur; ilkin Super Admin SQL ilə əlavə olunur.
- Super Admin təyini e-poçtu təsdiqlənmiş Auth hesabı tələb edir.
- PGlite testləri real Supabase layihəsini əvəz etmir. İki hesabla Supabase RLS/Realtime, e-poçt və mobil brauzer yoxlamaları ayrıca Supabase/Vercel test mühitində aparılmalıdır.
