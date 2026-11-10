# Təhlükəsiz Super Admin qurulması

## Tələb olunan ardıcıllıq

1. Supabase Auth-da `elielizade17@gmail.com` ünvanı ilə adi qeydiyyat edin və e-poçtu təsdiqləyin. Hesab yoxdursa, əvvəlcə hesab yaradılmalıdır.
2. Test Supabase layihəsində aşağıdakı miqrasiyaları ardıcıllıqla icra edin: `01_supabase_schema.sql`, `02_hardening_phase1.sql`, `04_grants.sql`, `05_backfill_profiles.sql`, `06_forum_roles_admin.sql`, sonda `03_hardening_phase2.sql`.
3. Təsdiqlənmiş hesab mövcud olduqdan sonra SQL Editor-da aşağıdakı SQL-i bir dəfə icra edin:

```sql
insert into public.platform_admins(user_id)
select id
from auth.users
where lower(email) = 'elielizade17@gmail.com'
  and email_confirmed_at is not null
on conflict (user_id) do nothing;
```

4. SQL Editor-də `select p.user_id, u.email from public.platform_admins p join auth.users u on u.id=p.user_id;` sorğusu ilə düzgün hesabın əlavə olunduğunu yoxlayın. Həmin hesabla sayta daxil olub `/admin` səhifəsini açın. Production-a keçməzdən əvvəl test layihəsində sınayın.

## Server secret

İstifadəçi siyahısı ad/e-poçt axtarışı, tip və qeydiyyat tarix aralığı filtrlərini, həmçinin qeydiyyat tarixinə görə sıralamanı dəstəkləyir.

Auth Admin API-ni yalnız server route-dan istifadə etmək üçün Vercel server environment-ə `SUPABASE_SERVICE_ROLE_KEY` əlavə edin. Bu açarı `NEXT_PUBLIC_` adı ilə açıqlamayın və repoya və ya ZIP-ə daxil etməyin. `.env.example` faylında yalnız dəyişənin adı nümunə kimi verilib.

Admin API hər sorğuda Supabase access token-i yoxlayır və Auth user ID-sini `platform_admins` cədvəli ilə tutuşdurur. `/admin` səhifəsi əlavə olaraq serverdə `HttpOnly` sessiya cookie-sini, tokeni və admin reyestrini yoxlayır. Cookie yalnız admin üçün verilir və Auth sessiyası yenilənəndə yenilənir. İcazə client e-poçtuna, `profiles.role` sahəsinə və ya göndərilmiş admin flag-ə əsaslanmır. Admin əməliyyatlarının audit xülasəsi `admin_audit_log` cədvəlinə yazılır. Şifrə, token və service key jurnala düşmür.

Paneldə Auth hesablarını axtarmaq, tipə görə süzmək və qeydiyyat tarixinə görə sıralamaq mümkündür. Siyahı 25 hesablıq səhifələnir; axtarış skanı ən çox 10 000 Auth hesabı əhatə edir. Admin profillərə baxa və yalnız adminlərin görə bildiyi daxili qeydlər yaza, hesabı müvəqqəti bloklaya/aça, istifadəçi tipini dəyişə və hesabı silə bilər. Forum mövzusu, cavabı və şikayət 100 sətirlik səhifələrlə nəzərdən keçirilir; məzmunu redaktə/gizlət/bərpa etmək, mövzunu sabitləmək/bağlamaq, şikayətə nəticə yazmaq və kateqoriyanı idarə etmək mümkündür. Kitab və PDF elanları redaktə/gizlədilir/silinir; qaralama sınaq yaradılır, sual tarixçəsi pozulmayacaq hallarda redaktə, dərc və silinmə mümkündür. Nəticə tarixçəsi olan sınağın sualları dəyişdirilmir və sınaq silinmir; onu gizlətmək olar. Hüquqi sənədlər redaktə və aktiv/deaktiv edilir. Öz hesabını bloklamaq və ya silmək qadağandır; API yeganə Super Admin hesabının silinməsini bloklayır. Bloklama aktiv access token-i müddəti bitənədək dərhal etibarsız etməyə bilər.

Admin hüququnu ləğv etmək üçün SQL Editor-də `delete from public.platform_admins where user_id = '…';` sorğusunu müvafiq ID ilə icra edin. Adi istifadəçilərin bu cədvələ INSERT/UPDATE/DELETE icazəsi yoxdur. Son adminin silinməsi platformanı adminsiz qoyar; yeni təsdiqlənmiş admin əlavə edilməyənədək bunu etməyin.
