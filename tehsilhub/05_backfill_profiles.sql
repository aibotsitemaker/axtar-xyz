-- =====================================================================
-- 05 — PROFİLLƏRİN BƏRPASI
-- Xəta: insert or update on table "pdfs" violates foreign key constraint "pdfs_uploader_id_fkey"
-- Səbəb: bəzi istifadəçilər trigger qurulmamışdan əvvəl qeydiyyatdan keçib və profil sətri yoxdur.
-- Bu fayl: (1) trigger-in mövcud olmasını təmin edir, (2) profili olmayan istifadəçilərə profil yaradır.
-- Mövcud profillərə, elanlara və digər məlumata TOXUNMUR. Təkrar işlədilə bilər.
-- =====================================================================
begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

commit;

-- Yoxlama: nəticə 0 olmalıdır (profili olmayan istifadəçi sayı)
select count(*) as profilsiz_istifadeci
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
