# Super Admin qurulması — elielizade17@gmail.com

## Təhlükəsizlik modeli
- Admin hüququ **e-poçt mətninə və ya `profiles.role`-a bağlı deyil**. O, `public.admin_users` cədvəlində **Auth istifadəçi ID-sinə (`auth.users.id`)** bağlı qeyddir.
- Brauzerdən (anon/authenticated rolları) `admin_users`-ə yazmaq mümkün deyil: cədvəl RLS ilə bağlıdır, yazma icazəsi yoxdur və trigger `super` səviyyəsini yalnız SQL Editor kontekstində qəbul edir.
- Hər admin RPC-si icra olunanda bazada `assert_admin` ilə yoxlanır; interfeysdəki gizlətmə yalnız rahatlıq üçündür. `/admin` səhifələri admin təsdiqlənməyənə qədər heç bir admin sorğusu göndərmir.
- Hesab silinib eyni e-poçtla yenidən yaradılsa, **yeni hesab admin olmur** (ID dəyişir). Testlərdə yoxlanıb.
- Təsdiqlənməmiş e-poçtla Super Admin təyin etmək mümkün deyil (08 xəta verir).

## Addımlar
1. 06 və 07 miqrasiyaları icra olunub (DEPLOY.md, B).
2. Saytda `https://www.axtar.xyz/auth?mode=register` → `elielizade17@gmail.com` ilə **adi qeydiyyat** (Mən kiməm? seçimi məcburidir; admin tipi yoxdur). Supabase Dashboard-dan "Add user" ilə yaratmayın.
3. Gələn e-poçtdakı təsdiq linkinə klikləyin.
4. Supabase → SQL Editor → `08_bootstrap_super_admin.sql` faylını açıb icra edin. Uğurlu olarsa sonda `level = super`, `email_confirmed = true` olan bir sətir görünür. Hesab yoxdursa/təsdiqlənməyibsə fayl aydın xəta verir və heç nə dəyişmir.
5. Saytdan çıxıb yenidən daxil olun → menyuda **Admin paneli** görünür → `/admin`.
6. Audit jurnalında (`/admin/audit`) `Super Admin təyin edildi (SQL)` qeydi görünməlidir.

## Sonrakı adminlər
Super Admin → `/admin/users/[id]` və ya `/admin/admins` → "Admin et". Hüquq yalnız Super Admin tərəfindən verilir/ləğv olunur və audit jurnalına yazılır.

## Qoruyucular
- Sonuncu Super Admin silinə və ya aşağı salına bilməz (trigger). Admin hesabı (o cümlədən özünüzünkü) kabinetdən "Hesabı sil" ilə silinə bilməz — əvvəlcə admin hüququ ləğv edilməlidir. Admin panelindən hesab silmək üçün hesabın e-poçtunu yazmaq tələb olunur.
- Audit jurnalı dəyişdirilə/silinə bilməz (SQL Editor-da belə UPDATE/DELETE/TRUNCATE trigger ilə bloklanır). Parol, token, açar sahələri jurnalda təmizlənir. Admin panelində parol göstərilmir.

## Geri çəkmək
`delete from public.admin_users where user_id = (select id from auth.users where lower(email) = 'elielizade17@gmail.com');` (yalnız başqa Super Admin varsa mümkündür.)
