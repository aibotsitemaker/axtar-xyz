-- =====================================================================
-- 08 — İLKİN SUPER ADMİN TƏYİNİ (ƏL İLƏ, BİR DƏFƏ, YALNIZ SQL EDITOR-DA)
--
-- Bu fayl 06 və 07 işlədildikdən sonra işlədilir. Avtomatik işə düşmür.
-- Şərtlər (hamısı ödənməsə, fayl XƏTA verir və heç nə dəyişmir):
--   1) elielizade17@gmail.com ilə hesab əvvəlcə SAYT ÜZƏRİNDƏN adi qeydiyyatla yaradılmalıdır;
--   2) e-poçt təsdiqlənməlidir (təsdiq linkinə klikləyin);
--   3) bu skript Supabase SQL Editor-da (postgres/service_role kontekstində) işlədilməlidir.
--      Brauzerdən və ya adi istifadəçi sessiyasından 'super' yazmaq mümkün deyil (07-dəki trigger bunu bloklayır).
--
-- Təhlükəsizlik: admin hüququ e-poçt mətninə deyil, Auth istifadəçi ID-sinə bağlanır
-- (public.admin_users.user_id). Hesab silinsə və ya e-poçt dəyişsə, başqası bu hüququ ala bilməz.
-- Təkrar işlədilə bilər (idempotent).
-- Geri çəkmək üçün (yalnız başqa Super Admin varsa mümkündür):
--   delete from public.admin_users where user_id = (select id from auth.users where lower(email) = 'elielizade17@gmail.com');
-- =====================================================================
do $$
declare
    v_email     constant text := 'elielizade17@gmail.com';
    v_id        uuid;
    v_confirmed timestamptz;
begin
    if to_regclass('public.admin_users') is null then
        raise exception 'Əvvəlcə 06_roles_and_forum.sql və 07_admin_panel_and_audit.sql işlədilməlidir.';
    end if;

    select id, email_confirmed_at into v_id, v_confirmed
      from auth.users where lower(email) = lower(v_email);

    if v_id is null then
        raise exception 'Hesab tapılmadı: %. Əvvəlcə saytda bu e-poçtla qeydiyyatdan keçin, e-poçtu təsdiqləyin, sonra bu faylı yenidən işlədin.', v_email;
    end if;
    if v_confirmed is null then
        raise exception '% e-poçtu hələ təsdiqlənməyib. Gələn təsdiq linkinə klikləyin və yenidən cəhd edin.', v_email;
    end if;

    insert into public.admin_users (user_id, level, note)
    values (v_id, 'super', 'İlkin Super Admin (08_bootstrap_super_admin.sql)')
    on conflict (user_id) do update set level = 'super';

    insert into public.admin_audit_log (actor_id, actor_label, action, target_type, target_id, target_label, details)
    values (null, 'SQL Editor', 'admin.bootstrap', 'user', v_id::text, v_email, jsonb_build_object('level', 'super'));

    raise notice 'Super Admin təyin edildi: % (id=%)', v_email, v_id;
end
$$;

-- Yoxlama: 1 sətir və level = super görünməlidir
select a.level, u.email, u.email_confirmed_at is not null as email_confirmed, a.created_at
from public.admin_users a
join auth.users u on u.id = a.user_id
where lower(u.email) = 'elielizade17@gmail.com';
