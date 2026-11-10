-- =====================================================================
-- 07 — SUPER ADMIN, ADMİN PANELİ RPC-ləri və AUDİT JURNALI
-- 06 işlədildikdən SONRA işlədin. Təkrar işlədilə bilər. Məlumat silinmir.
-- Geri qaytarma: 98_rollback_06_07.sql
--
-- Təhlükəsizlik modeli:
--  * Admin hüququ yalnız public.admin_users cədvəlindəki Auth istifadəçi ID-sindən gəlir
--    (profildəki e-poçt mətni, user_metadata və klient sorğusu HEÇ NƏ həll etmir).
--  * admin_users-a brauzerdən yazmaq mümkün deyil (RLS + icazə yoxdur). 'super' səviyyəsi
--    YALNIZ SQL Editor / service_role ilə (08_bootstrap_super_admin.sql) verilə bilər:
--    trigger auth.uid() olan sessiyada 'super' yazılmasını rədd edir.
--  * Mövcud qoruma (profiles.role trigger + sütun icazələri) dəyişmir. Köhnə üsulla (profiles.role='admin')
--    təyin olunmuş adminlər işləməyə davam edir.
--  * Admin adından edilən kritik əməliyyatlar admin_audit_log-a SERVER tərəfində, eyni tranzaksiyada yazılır.
--  * is_admin() artıq e-poçtu təsdiqlənməmiş hesabı admin saymır.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- A. ADMİN QEYDLƏRİ
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
    user_id     uuid primary key references auth.users(id) on delete restrict,
    level       text not null default 'admin' check (level in ('super', 'admin')),
    granted_by  uuid references auth.users(id) on delete set null,
    note        text check (note is null or char_length(note) <= 300),
    created_at  timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
-- Heç bir siyasət yoxdur: brauzer bu cədvəli nə oxuya, nə də dəyişə bilər.

create or replace function public.guard_admin_users()
returns trigger
language plpgsql
as $$
declare
    other_super boolean;
begin
    -- 'super' səviyyəsi yalnız SQL Editor / service_role (auth.uid() boş) ilə verilə bilər
    if tg_op in ('INSERT', 'UPDATE') and new.level = 'super' and auth.uid() is not null then
        raise exception 'Super Admin yalnız server tərəfində (SQL) təyin edilə bilər.' using errcode = '42501';
    end if;
    -- Sonuncu Super Admin silinə və ya aşağı salına bilməz
    if (tg_op = 'DELETE' and old.level = 'super')
       or (tg_op = 'UPDATE' and old.level = 'super' and new.level <> 'super') then
        select exists (select 1 from public.admin_users where level = 'super' and user_id <> old.user_id) into other_super;
        if not other_super then
            raise exception 'Sonuncu Super Admin silinə və ya aşağı salına bilməz.' using errcode = '42501';
        end if;
    end if;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_guard_admin_users on public.admin_users;
create trigger trg_guard_admin_users
    before insert or update or delete on public.admin_users
    for each row execute function public.guard_admin_users();

-- is_admin(): admin_users (ID əsaslı) VƏ ya köhnə profiles.role='admin'; e-poçt təsdiqlənməlidir
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((
        select exists (select 1 from public.admin_users a where a.user_id = u.id)
               or coalesce((select p.role = 'admin' from public.profiles p where p.id = u.id), false)
        from auth.users u
        where u.id = auth.uid() and u.email_confirmed_at is not null
    ), false);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((
        select exists (select 1 from public.admin_users a where a.user_id = u.id and a.level = 'super')
        from auth.users u
        where u.id = auth.uid() and u.email_confirmed_at is not null
    ), false);
$$;

create or replace function public.assert_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if auth.uid() is null or not public.is_admin() then
        raise exception 'İcazə yoxdur.' using errcode = '42501';
    end if;
    return auth.uid();
end;
$$;

create or replace function public.assert_super_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if auth.uid() is null or not public.is_super_admin() then
        raise exception 'Bu əməliyyat yalnız Super Admin üçündür.' using errcode = '42501';
    end if;
    return auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- B. AUDİT JURNALI (yalnız əlavə olunur; dəyişdirmək/silmək olmaz)
-- ---------------------------------------------------------------------
create table if not exists public.admin_audit_log (
    id            bigint generated always as identity primary key,
    actor_id      uuid references auth.users(id) on delete set null,
    actor_label   text,
    action        text not null,
    target_type   text,
    target_id     text,
    target_label  text,
    details       jsonb not null default '{}'::jsonb,
    created_at    timestamptz not null default now()
);
create index if not exists idx_audit_created on public.admin_audit_log (created_at desc);
create index if not exists idx_audit_action  on public.admin_audit_log (action, created_at desc);
create index if not exists idx_audit_target  on public.admin_audit_log (target_type, target_id);

alter table public.admin_audit_log enable row level security;
drop policy if exists "audit_select_admin" on public.admin_audit_log;
create policy "audit_select_admin" on public.admin_audit_log
    for select to authenticated using ((select public.is_admin()));
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;

create or replace function public.audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
    -- İstisna: aktorun hesabı silinəndə FK yalnız actor_id-ni NULL edir
    if tg_op = 'UPDATE' and new.actor_id is null and old.actor_id is not null
       and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
        return new;
    end if;
    raise exception 'Audit jurnalı dəyişdirilə və ya silinə bilməz.' using errcode = '42501';
end;
$$;

drop trigger if exists trg_audit_immutable on public.admin_audit_log;
create trigger trg_audit_immutable
    before update or delete on public.admin_audit_log
    for each row execute function public.audit_log_immutable();
drop trigger if exists trg_audit_no_truncate on public.admin_audit_log;
create trigger trg_audit_no_truncate
    before truncate on public.admin_audit_log
    for each statement execute function public.audit_log_immutable();

-- Həssas açarları (parol, token, secret, key...) çıxarır, uzun mətnləri qısaldır
create or replace function public.audit_scrub(p jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
    k text;
    v jsonb;
    out jsonb := '{}'::jsonb;
begin
    if p is null or jsonb_typeof(p) <> 'object' then
        return coalesce(p, '{}'::jsonb);
    end if;
    for k, v in select * from jsonb_each(p) loop
        if k ~* '(pass|token|secret|key|jwt|authorization|cookie)' then
            continue;
        end if;
        if jsonb_typeof(v) = 'string' then
            v := to_jsonb(left(v #>> '{}', 300));
        elsif jsonb_typeof(v) = 'object' then
            v := public.audit_scrub(v);
        end if;
        out := out || jsonb_build_object(k, v);
    end loop;
    return out;
end;
$$;

create or replace function public.audit_write(p_action text, p_target_type text, p_target_id text, p_target_label text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    lbl text;
begin
    if me is not null then
        select coalesce(nullif(full_name, ''), 'Admin') into lbl from public.profiles where id = me;
    end if;
    insert into public.admin_audit_log (actor_id, actor_label, action, target_type, target_id, target_label, details)
    values (me, left(lbl, 100), left(p_action, 80), left(p_target_type, 40), left(p_target_id, 80),
            left(p_target_label, 160), public.audit_scrub(p_details));
end;
$$;

-- Mövcud məzmun cədvəllərində (elan, PDF) admin başqasının qeydini dəyişəndə/silərkən avtomatik audit
create or replace function public.audit_content_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    owner_col text := tg_argv[0];
    label_col text := tg_argv[1];
    old_j jsonb;
    new_j jsonb;
    rec jsonb;
    owner uuid;
    changed text[];
    det jsonb := '{}'::jsonb;
begin
    if auth.uid() is null or not public.is_admin() then
        return coalesce(new, old);
    end if;
    rec := to_jsonb(coalesce(new, old));
    owner := nullif(rec ->> owner_col, '')::uuid;
    if owner is not null and owner = auth.uid() then
        return coalesce(new, old);
    end if;
    if tg_op = 'UPDATE' then
        old_j := to_jsonb(old);
        new_j := to_jsonb(new);
        select array_agg(e.key) into changed
          from jsonb_each(new_j) e
         where e.key not in ('updated_at', 'view_count', 'download_count')
           and old_j -> e.key is distinct from e.value;
        if changed is null then
            return new;
        end if;
        det := jsonb_build_object('changed', to_jsonb(changed));
        if 'status' = any (changed) then
            det := det || jsonb_build_object('status_from', old_j ->> 'status', 'status_to', new_j ->> 'status');
        end if;
    end if;
    perform public.audit_write(tg_table_name || '.' || lower(tg_op), tg_table_name, rec ->> 'id', rec ->> label_col, det);
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_books_audit on public.books;
create trigger trg_books_audit after insert or update or delete on public.books
    for each row execute function public.audit_content_change('seller_id', 'title');
drop trigger if exists trg_pdfs_audit on public.pdfs;
create trigger trg_pdfs_audit after insert or update or delete on public.pdfs
    for each row execute function public.audit_content_change('uploader_id', 'title');

-- ---------------------------------------------------------------------
-- C. İSTİFADƏÇİNİN ÖZ KONTEKSTİ (başlıq, rozet, bloklanma bildirişi)
-- ---------------------------------------------------------------------
create or replace function public.my_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    me uuid := auth.uid();
    p record;
    until_ts timestamptz;
begin
    if me is null then return null; end if;
    select full_name, account_type into p from public.profiles where id = me;
    select blocked_until into until_ts from public.user_moderation where user_id = me and blocked_until > now();
    return jsonb_build_object(
        'full_name', p.full_name,
        'account_type', p.account_type,
        'is_admin', public.is_admin(),
        'is_super_admin', public.is_super_admin(),
        'blocked_until', until_ts,
        'unread_notifications', public.unread_notification_count()
    );
end;
$$;

-- ---------------------------------------------------------------------
-- D. HESAB SİLMƏ: adminlər təsadüfən özlərini silə bilməz
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if auth.uid() is null then
        raise exception 'Giriş tələb olunur';
    end if;
    if exists (select 1 from public.admin_users where user_id = auth.uid())
       or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
        raise exception 'Admin hesabı bu yolla silinə bilməz. Əvvəlcə admin hüququ ləğv edilməlidir.' using errcode = '42501';
    end if;
    delete from auth.users where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- E. ADMİN RPC-ləri — DASHBOARD
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    res jsonb;
begin
    perform public.assert_admin();
    select jsonb_build_object(
        'users', jsonb_build_object(
            'total',               (select count(*) from public.profiles),
            'teacher',             (select count(*) from public.profiles where account_type = 'teacher'),
            'student',             (select count(*) from public.profiles where account_type = 'student'),
            'university_student',  (select count(*) from public.profiles where account_type = 'university_student'),
            'unspecified',         (select count(*) from public.profiles where account_type is null),
            'new_7d',              (select count(*) from public.profiles where created_at > now() - interval '7 days'),
            'blocked_now',         (select count(*) from public.user_moderation where blocked_until > now()),
            'admins',              (select count(*) from public.admin_users)
        ),
        'forum', jsonb_build_object(
            'topics_active',       (select count(*) from public.forum_topics where status = 'active'),
            'topics_hidden',       (select count(*) from public.forum_topics where status = 'hidden'),
            'topics_deleted',      (select count(*) from public.forum_topics where status = 'deleted'),
            'topics_locked',       (select count(*) from public.forum_topics where status = 'active' and is_locked),
            'topics_pinned',       (select count(*) from public.forum_topics where status = 'active' and is_pinned),
            'topics_7d',           (select count(*) from public.forum_topics where created_at > now() - interval '7 days'),
            'replies_active',      (select count(*) from public.forum_replies where status = 'active'),
            'open_reports',        (select count(*) from public.forum_reports where status = 'open'),
            'reported_topics',     (select count(distinct topic_id) from public.forum_reports where status = 'open')
        ),
        'content', jsonb_build_object(
            'books_active',        (select count(*) from public.books where status = 'active'),
            'pdfs_active',         (select count(*) from public.pdfs where status = 'active'),
            'quizzes',             (select count(*) from public.quizzes)
        ),
        'recent_activity', coalesce((
            select jsonb_agg(to_jsonb(x)) from (
                select id, created_at, action, actor_label, target_type, target_label
                from public.admin_audit_log order by created_at desc, id desc limit 10
            ) x), '[]'::jsonb),
        'recent_topics', coalesce((
            select jsonb_agg(to_jsonb(x)) from (
                select t.id, t.title, t.status, t.created_at, t.reply_count, p.full_name as author_name
                from public.forum_topics t left join public.profiles p on p.id = t.author_id
                order by t.created_at desc limit 8
            ) x), '[]'::jsonb)
    ) into res;
    return res;
end;
$$;

-- ---------------------------------------------------------------------
-- F. ADMİN RPC-ləri — İSTİFADƏÇİLƏR
-- ---------------------------------------------------------------------
create or replace function public.admin_list_users(
    p_search text default null, p_type text default null, p_state text default 'all',
    p_limit integer default 25, p_offset integer default 0)
returns table (
    id uuid, email text, full_name text, account_type text, admin_level text,
    created_at timestamptz, last_sign_in_at timestamptz, email_confirmed boolean,
    blocked_until timestamptz, topic_count integer, reply_count integer, total_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    s text := nullif(btrim(coalesce(p_search, '')), '');
    pat text;
begin
    perform public.assert_admin();
    if s is not null then
        pat := '%' || replace(replace(replace(left(s, 100), '\', '\\'), '%', '\%'), '_', '\_') || '%';
    end if;
    return query
    select p.id, u.email::text, p.full_name, p.account_type, a.level,
           p.created_at, u.last_sign_in_at, (u.email_confirmed_at is not null),
           case when m.blocked_until > now() then m.blocked_until end,
           (select count(*)::integer from public.forum_topics t where t.author_id = p.id),
           (select count(*)::integer from public.forum_replies r where r.author_id = p.id),
           count(*) over ()
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.admin_users a on a.user_id = p.id
    left join public.user_moderation m on m.user_id = p.id
    where (s is null or p.full_name ilike pat or u.email ilike pat)
      and (p_type is null or p_type = '' or (p_type = 'none' and p.account_type is null) or p.account_type = p_type)
      and (coalesce(p_state, 'all') = 'all'
           or (p_state = 'admin' and (a.user_id is not null or p.role = 'admin'))
           or (p_state = 'blocked' and m.blocked_until > now()))
    order by p.created_at desc, p.id
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_get_user(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    res jsonb;
begin
    perform public.assert_admin();
    select jsonb_build_object(
        'id', p.id, 'email', u.email, 'full_name', p.full_name, 'username', p.username, 'city', p.city, 'bio', p.bio,
        'account_type', p.account_type, 'legacy_role', p.role, 'admin_level', a.level,
        'created_at', p.created_at, 'last_sign_in_at', u.last_sign_in_at, 'email_confirmed', u.email_confirmed_at is not null,
        'blocked_until', case when m.blocked_until > now() then m.blocked_until end,
        'block_reason', case when m.blocked_until > now() then m.block_reason end,
        'topic_count', (select count(*) from public.forum_topics t where t.author_id = p.id),
        'reply_count', (select count(*) from public.forum_replies r where r.author_id = p.id),
        'book_count', (select count(*) from public.books b where b.seller_id = p.id),
        'pdf_count', (select count(*) from public.pdfs d where d.uploader_id = p.id),
        'notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from (
                    select n.id, n.note, n.created_at, coalesce(ap.full_name, 'Admin') as author_name
                    from public.admin_user_notes n left join public.profiles ap on ap.id = n.author_id
                    where n.user_id = p.id order by n.created_at desc limit 50) n), '[]'::jsonb)
    ) into res
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.admin_users a on a.user_id = p.id
    left join public.user_moderation m on m.user_id = p.id
    where p.id = p_id;
    if res is null then raise exception 'İstifadəçi tapılmadı.' using errcode = 'P0002'; end if;
    return res;
end;
$$;

create table if not exists public.admin_user_notes (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles(id) on delete cascade,
    author_id   uuid references public.profiles(id) on delete set null,
    note        text not null check (char_length(note) between 1 and 1000),
    created_at  timestamptz not null default now()
);
create index if not exists idx_admin_user_notes_user on public.admin_user_notes (user_id, created_at desc);
alter table public.admin_user_notes enable row level security;
revoke all on public.admin_user_notes from anon, authenticated;

create or replace function public.admin_add_user_note(p_user uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := public.assert_admin();
    n text := public.forum_clean_text(p_note, 1, 1000, 'Qeyd');
begin
    if not exists (select 1 from public.profiles where id = p_user) then raise exception 'İstifadəçi tapılmadı.' using errcode = 'P0002'; end if;
    insert into public.admin_user_notes (user_id, author_id, note) values (p_user, me, n);
    perform public.audit_write('user.note.add', 'user', p_user::text, (select full_name from public.profiles where id = p_user), '{}'::jsonb);
end;
$$;

create or replace function public.admin_set_account_type(p_user uuid, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    cur text;
    nm text;
begin
    perform public.assert_admin();
    if p_type is null or p_type not in ('teacher', 'student', 'university_student') then
        raise exception 'Yanlış hesab tipi.' using errcode = '22023';
    end if;
    select account_type, full_name into cur, nm from public.profiles where id = p_user;
    if not found then raise exception 'İstifadəçi tapılmadı.' using errcode = 'P0002'; end if;
    perform set_config('app.allow_account_type_update', 'on', true);
    update public.profiles set account_type = p_type where id = p_user;
    perform set_config('app.allow_account_type_update', 'off', true);
    perform public.audit_write('user.account_type.change', 'user', p_user::text, nm,
        jsonb_build_object('from', cur, 'to', p_type));
end;
$$;

create or replace function public.admin_block_user(p_user uuid, p_until timestamptz, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := public.assert_admin();
    nm text;
    until_ts timestamptz := coalesce(p_until, 'infinity'::timestamptz);
    rsn text := nullif(left(btrim(coalesce(p_reason, '')), 300), '');
begin
    if p_user = me then raise exception 'Özünüzü blok edə bilməzsiniz.' using errcode = '22023'; end if;
    select full_name into nm from public.profiles where id = p_user;
    if not found then raise exception 'İstifadəçi tapılmadı.' using errcode = 'P0002'; end if;
    if exists (select 1 from public.admin_users where user_id = p_user)
       or exists (select 1 from public.profiles where id = p_user and role = 'admin') then
        raise exception 'Admin hesabı bloklana bilməz. Əvvəlcə admin hüququ ləğv edilməlidir.' using errcode = '42501';
    end if;
    if until_ts <= now() then raise exception 'Bloklanma vaxtı gələcəkdə olmalıdır.' using errcode = '22023'; end if;
    insert into public.user_moderation (user_id, blocked_until, block_reason, blocked_by, updated_at)
    values (p_user, until_ts, rsn, me, now())
    on conflict (user_id) do update
        set blocked_until = excluded.blocked_until, block_reason = excluded.block_reason,
            blocked_by = excluded.blocked_by, updated_at = now();
    insert into public.notifications (user_id, actor_id, type, title, body, link)
    values (p_user, null, 'moderation', 'Hesabınız müvəqqəti məhdudlaşdırıldı', rsn, '/profile');
    perform public.audit_write('user.block', 'user', p_user::text, nm,
        jsonb_build_object('until', case when until_ts = 'infinity' then 'infinity' else to_char(until_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"') end, 'reason', rsn));
end;
$$;

create or replace function public.admin_unblock_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    nm text;
begin
    perform public.assert_admin();
    select full_name into nm from public.profiles where id = p_user;
    if not found then raise exception 'İstifadəçi tapılmadı.' using errcode = 'P0002'; end if;
    update public.user_moderation set blocked_until = null, block_reason = null, updated_at = now() where user_id = p_user;
    perform public.audit_write('user.unblock', 'user', p_user::text, nm, '{}'::jsonb);
end;
$$;

-- Hesabı silmək: təsdiq üçün hədəfin e-poçtu yazılmalıdır; özünü, adminləri silmək olmaz
create or replace function public.admin_delete_user(p_user uuid, p_confirm_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := public.assert_admin();
    em text;
    nm text;
begin
    if p_user = me then raise exception 'Öz hesabınızı admin panelindən silə bilməzsiniz.' using errcode = '42501'; end if;
    select u.email, p.full_name into em, nm from auth.users u join public.profiles p on p.id = u.id where u.id = p_user;
    if not found then raise exception 'İstifadəçi tapılmadı.' using errcode = 'P0002'; end if;
    if exists (select 1 from public.admin_users where user_id = p_user)
       or exists (select 1 from public.profiles where id = p_user and role = 'admin') then
        raise exception 'Admin hesabı silinə bilməz. Əvvəlcə admin hüququ ləğv edilməlidir.' using errcode = '42501';
    end if;
    if p_confirm_email is null or lower(btrim(p_confirm_email)) <> lower(coalesce(em, '')) then
        raise exception 'Təsdiq e-poçtu uyğun gəlmir.' using errcode = '22023';
    end if;
    perform public.audit_write('user.delete', 'user', p_user::text, coalesce(nm, '') || ' <' || coalesce(em, '') || '>', '{}'::jsonb);
    delete from auth.users where id = p_user;
end;
$$;

-- Admin təyin etmək / ləğv etmək: yalnız Super Admin; yeni admin həmişə 'admin' səviyyəsindədir
create or replace function public.admin_grant_admin(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := public.assert_super_admin();
    nm text;
begin
    select p.full_name into nm from public.profiles p join auth.users u on u.id = p.id
     where p.id = p_user and u.email_confirmed_at is not null;
    if not found then raise exception 'İstifadəçi tapılmadı və ya e-poçtu təsdiqlənməyib.' using errcode = 'P0002'; end if;
    insert into public.admin_users (user_id, level, granted_by, note) values (p_user, 'admin', me, null)
    on conflict (user_id) do nothing;
    perform public.audit_write('admin.grant', 'user', p_user::text, nm, jsonb_build_object('level', 'admin'));
end;
$$;

create or replace function public.admin_revoke_admin(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := public.assert_super_admin();
    lvl text;
    nm text;
begin
    if p_user = me then raise exception 'Öz admin hüququnuzu ləğv edə bilməzsiniz.' using errcode = '42501'; end if;
    select level into lvl from public.admin_users where user_id = p_user;
    if lvl is null then raise exception 'Bu istifadəçi admin deyil.' using errcode = 'P0002'; end if;
    if lvl = 'super' then raise exception 'Super Admin ləğv edilə bilməz.' using errcode = '42501'; end if;
    select full_name into nm from public.profiles where id = p_user;
    delete from public.admin_users where user_id = p_user;
    perform public.audit_write('admin.revoke', 'user', p_user::text, nm, '{}'::jsonb);
end;
$$;

create or replace function public.admin_list_admins()
returns table (user_id uuid, full_name text, email text, level text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    perform public.assert_admin();
    return query
    select a.user_id, p.full_name, u.email::text, a.level, a.created_at
    from public.admin_users a
    join auth.users u on u.id = a.user_id
    left join public.profiles p on p.id = a.user_id
    order by (a.level = 'super') desc, a.created_at;
end;
$$;

-- ---------------------------------------------------------------------
-- G. ADMİN RPC-ləri — FORUM MODERASİYASI
-- ---------------------------------------------------------------------
create or replace function public.admin_forum_topic_action(p_id uuid, p_action text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    r public.forum_topics%rowtype;
    note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
begin
    perform public.assert_admin();
    if p_action not in ('hide', 'restore', 'delete', 'pin', 'unpin', 'lock', 'unlock') then
        raise exception 'Yanlış əməliyyat.' using errcode = '22023';
    end if;
    select * into r from public.forum_topics where id = p_id for update;
    if not found then raise exception 'Mövzu tapılmadı.' using errcode = 'P0002'; end if;

    case p_action
        when 'hide'    then update public.forum_topics set status = 'hidden' where id = p_id;
        when 'restore' then update public.forum_topics set status = 'active', deleted_at = null where id = p_id;
        when 'delete'  then update public.forum_topics set status = 'deleted', deleted_at = now() where id = p_id;
        when 'pin'     then update public.forum_topics set is_pinned = true, pinned_at = now() where id = p_id;
        when 'unpin'   then update public.forum_topics set is_pinned = false, pinned_at = null where id = p_id;
        when 'lock'    then update public.forum_topics set is_locked = true where id = p_id;
        when 'unlock'  then update public.forum_topics set is_locked = false where id = p_id;
    end case;

    if p_action in ('hide', 'delete') then
        update public.forum_reports
           set status = 'resolved', resolved_by = auth.uid(), resolved_at = now(),
               resolution_note = coalesce(note, 'Məzmun moderasiya edildi.')
         where topic_id = p_id and status = 'open';
    end if;
    if p_action in ('hide', 'delete', 'lock') and r.author_id is not null and r.author_id <> auth.uid() then
        insert into public.notifications (user_id, actor_id, type, title, body, link, topic_id)
        values (r.author_id, null, 'moderation',
                case p_action when 'hide' then 'Mövzunuz moderator tərəfindən gizlədildi'
                              when 'delete' then 'Mövzunuz moderator tərəfindən silindi'
                              else 'Mövzunuz moderator tərəfindən bağlandı' end,
                coalesce(note, left(r.title, 120)),
                case when p_action = 'lock' then '/forum/' || p_id::text else '/forum' end,
                case when p_action = 'lock' then p_id end);
    end if;
    perform public.audit_write('forum.topic.' || p_action, 'forum_topic', p_id::text, left(r.title, 80),
        jsonb_build_object('note', note));
end;
$$;

create or replace function public.admin_forum_reply_action(p_id uuid, p_action text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    r public.forum_replies%rowtype;
    note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
begin
    perform public.assert_admin();
    if p_action not in ('hide', 'restore', 'delete') then
        raise exception 'Yanlış əməliyyat.' using errcode = '22023';
    end if;
    select * into r from public.forum_replies where id = p_id for update;
    if not found then raise exception 'Cavab tapılmadı.' using errcode = 'P0002'; end if;
    case p_action
        when 'hide'    then update public.forum_replies set status = 'hidden' where id = p_id;
        when 'restore' then update public.forum_replies set status = 'active', deleted_at = null where id = p_id;
        when 'delete'  then update public.forum_replies set status = 'deleted', deleted_at = now() where id = p_id;
    end case;
    if p_action in ('hide', 'delete') then
        update public.forum_reports
           set status = 'resolved', resolved_by = auth.uid(), resolved_at = now(),
               resolution_note = coalesce(note, 'Məzmun moderasiya edildi.')
         where reply_id = p_id and status = 'open';
        if r.author_id is not null and r.author_id <> auth.uid() then
            insert into public.notifications (user_id, actor_id, type, title, body, link, topic_id)
            values (r.author_id, null, 'moderation',
                    case p_action when 'hide' then 'Cavabınız moderator tərəfindən gizlədildi' else 'Cavabınız moderator tərəfindən silindi' end,
                    coalesce(note, left(r.body, 120)), '/forum/' || r.topic_id::text, r.topic_id);
        end if;
    end if;
    perform public.audit_write('forum.reply.' || p_action, 'forum_reply', p_id::text, left(r.body, 80),
        jsonb_build_object('note', note));
end;
$$;

create or replace function public.admin_resolve_report(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := public.assert_admin();
    r public.forum_reports%rowtype;
    note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
begin
    if p_status not in ('resolved', 'dismissed', 'open') then
        raise exception 'Yanlış status.' using errcode = '22023';
    end if;
    select * into r from public.forum_reports where id = p_id for update;
    if not found then raise exception 'Şikayət tapılmadı.' using errcode = 'P0002'; end if;
    update public.forum_reports
       set status = p_status,
           resolved_by = case when p_status = 'open' then null else me end,
           resolved_at = case when p_status = 'open' then null else now() end,
           resolution_note = case when p_status = 'open' then null else note end
     where id = p_id;
    perform public.audit_write('forum.report.' || p_status, 'forum_report', p_id::text,
        case when r.reply_id is null then 'topic:' else 'reply:' end || coalesce(r.reply_id, r.topic_id)::text,
        jsonb_build_object('note', note, 'reason', r.reason));
end;
$$;

-- ---------------------------------------------------------------------
-- H. ADMİN RPC-ləri — KATEQORİYALAR
-- ---------------------------------------------------------------------
create or replace function public.forum_slugify(p_text text)
returns text
language sql
immutable
as $$
    -- Azərbaycan hərfləri açıq şəkildə (böyük/kiçik) latınlaşdırılır: nəticə verilənlər bazasının lokalından asılı deyil
    select btrim(regexp_replace(
        lower(translate(coalesce(p_text, ''), 'əƏıIİöÖüÜçÇşŞğĞâÂîÎûÛ', 'eEiIIoOuUcCsSgGaAiIuU')),
        '[^a-z0-9]+', '-', 'g'), '-');
$$;

create or replace function public.admin_upsert_category(p_id uuid, p_name text, p_description text default null, p_sort integer default 100)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    nm text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
    ds text := nullif(btrim(coalesce(p_description, '')), '');
    base text;
    sl text;
    new_id uuid;
    old_name text;
begin
    perform public.assert_admin();
    if char_length(nm) < 2 or char_length(nm) > 60 then raise exception 'Kateqoriya adı 2–60 simvol olmalıdır.' using errcode = '22023'; end if;
    if ds is not null and char_length(ds) > 200 then raise exception 'Təsvir ən çox 200 simvol ola bilər.' using errcode = '22023'; end if;
    if nm ~ '[<>]' or (ds is not null and ds ~ '[<>]') then raise exception 'Ad və təsvirdə < və > simvolları olmaz.' using errcode = '22023'; end if;
    if exists (select 1 from public.forum_categories where lower(name) = lower(nm) and id is distinct from p_id) then
        raise exception 'Bu adda kateqoriya artıq var.' using errcode = '23505';
    end if;
    if p_id is null then
        base := left(public.forum_slugify(nm), 60);
        if char_length(base) < 2 then base := 'kateqoriya'; end if;
        sl := base;
        while exists (select 1 from public.forum_categories where slug = sl) loop
            sl := base || '-' || substr(md5(random()::text), 1, 4);
        end loop;
        insert into public.forum_categories (slug, name, description, sort_order)
        values (sl, nm, ds, coalesce(p_sort, 100)) returning id into new_id;
        perform public.audit_write('forum.category.create', 'forum_category', new_id::text, nm, '{}'::jsonb);
        return new_id;
    end if;
    select name into old_name from public.forum_categories where id = p_id for update;
    if not found then raise exception 'Kateqoriya tapılmadı.' using errcode = 'P0002'; end if;
    update public.forum_categories set name = nm, description = ds, sort_order = coalesce(p_sort, sort_order) where id = p_id;
    perform public.audit_write('forum.category.update', 'forum_category', p_id::text, nm,
        jsonb_build_object('old_name', old_name));
    return p_id;
end;
$$;

-- Deaktiv etmə təhlükəsizdir: mövcud mövzular qalır və oxunur, yalnız yeni mövzu bu kateqoriyada açılmır
create or replace function public.admin_set_category_active(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    nm text;
begin
    perform public.assert_admin();
    select name into nm from public.forum_categories where id = p_id for update;
    if not found then raise exception 'Kateqoriya tapılmadı.' using errcode = 'P0002'; end if;
    if not p_active and not exists (select 1 from public.forum_categories where is_active and id <> p_id) then
        raise exception 'Ən azı bir aktiv kateqoriya qalmalıdır.' using errcode = '22023';
    end if;
    update public.forum_categories set is_active = p_active where id = p_id;
    perform public.audit_write(case when p_active then 'forum.category.activate' else 'forum.category.deactivate' end,
        'forum_category', p_id::text, nm, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- I. ADMİN RPC-ləri — SINAQLAR (cədvələ birbaşa yazma icazəsi yoxdur; 04 yalnız oxumağı açır)
-- ---------------------------------------------------------------------
create or replace function public.admin_create_quiz(p_title text, p_description text, p_category text, p_duration integer, p_questions jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    me uuid := public.assert_admin();
    qz uuid;
    q jsonb;
    i integer := 0;
    opts jsonb;
    ttl text := btrim(coalesce(p_title, ''));
begin
    if char_length(ttl) < 3 or char_length(ttl) > 150 then raise exception 'Sınaq adı 3–150 simvol olmalıdır.' using errcode = '22023'; end if;
    if p_category not in ('DİM', 'Magistr', 'IELTS', 'Universitet', 'Digər') then raise exception 'Yanlış kateqoriya.' using errcode = '22023'; end if;
    if p_duration is null or p_duration < 30 or p_duration > 14400 then raise exception 'Müddət 30–14400 saniyə olmalıdır.' using errcode = '22023'; end if;
    if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 1 and 50 then
        raise exception 'Sınaqda 1–50 sual olmalıdır.' using errcode = '22023';
    end if;
    insert into public.quizzes (created_by, title, description, category, duration_seconds, is_published)
    values (me, ttl, nullif(left(btrim(coalesce(p_description, '')), 500), ''), p_category, p_duration, false)
    returning id into qz;
    for q in select * from jsonb_array_elements(p_questions) loop
        i := i + 1;
        opts := q -> 'options';
        if jsonb_typeof(q -> 'text') <> 'string' or char_length(btrim(q ->> 'text')) not between 3 and 500 then
            raise exception '% sual: mətn 3–500 simvol olmalıdır.', i using errcode = '22023';
        end if;
        if opts is null or jsonb_typeof(opts) <> 'array' or jsonb_array_length(opts) not between 2 and 6
           or exists (select 1 from jsonb_array_elements(opts) o where jsonb_typeof(o) <> 'string' or char_length(btrim(o #>> '{}')) not between 1 and 300) then
            raise exception '% sual: 2–6 variant (hər biri 1–300 simvol) olmalıdır.', i using errcode = '22023';
        end if;
        if jsonb_typeof(q -> 'correct_index') <> 'number' or (q ->> 'correct_index') !~ '^\d+$'
           or (q ->> 'correct_index')::integer >= jsonb_array_length(opts) then
            raise exception '% sual: düzgün cavab indeksi yanlışdır.', i using errcode = '22023';
        end if;
        insert into public.quiz_questions (quiz_id, position, question_text, options, correct_index, explanation)
        values (qz, i, btrim(q ->> 'text'), opts, (q ->> 'correct_index')::integer,
                nullif(left(btrim(coalesce(q ->> 'explanation', '')), 500), ''));
    end loop;
    perform public.audit_write('quiz.create', 'quiz', qz::text, left(ttl, 80), jsonb_build_object('questions', i));
    return qz;
end;
$$;

create or replace function public.admin_update_quiz(p_id uuid, p_title text, p_description text, p_category text, p_duration integer, p_published boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    ttl text := btrim(coalesce(p_title, ''));
    old public.quizzes%rowtype;
begin
    perform public.assert_admin();
    select * into old from public.quizzes where id = p_id for update;
    if not found then raise exception 'Sınaq tapılmadı.' using errcode = 'P0002'; end if;
    if char_length(ttl) < 3 or char_length(ttl) > 150 then raise exception 'Sınaq adı 3–150 simvol olmalıdır.' using errcode = '22023'; end if;
    if p_category not in ('DİM', 'Magistr', 'IELTS', 'Universitet', 'Digər') then raise exception 'Yanlış kateqoriya.' using errcode = '22023'; end if;
    if p_duration is null or p_duration < 30 or p_duration > 14400 then raise exception 'Müddət 30–14400 saniyə olmalıdır.' using errcode = '22023'; end if;
    update public.quizzes
       set title = ttl, description = nullif(left(btrim(coalesce(p_description, '')), 500), ''),
           category = p_category, duration_seconds = p_duration, is_published = coalesce(p_published, is_published)
     where id = p_id;
    perform public.audit_write('quiz.update', 'quiz', p_id::text, left(ttl, 80),
        jsonb_build_object('published_from', old.is_published, 'published_to', coalesce(p_published, old.is_published)));
end;
$$;

-- DİQQƏT: sınaq silinəndə istifadəçilərin bu sınaq üzrə nəticələri də silinir (cascade). Adətən "dərc etmə"ni söndürmək kifayətdir.
create or replace function public.admin_delete_quiz(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    ttl text;
    attempts integer;
begin
    perform public.assert_admin();
    select title into ttl from public.quizzes where id = p_id for update;
    if not found then raise exception 'Sınaq tapılmadı.' using errcode = 'P0002'; end if;
    select count(*) into attempts from public.quiz_attempts where quiz_id = p_id;
    perform public.audit_write('quiz.delete', 'quiz', p_id::text, left(ttl, 80), jsonb_build_object('attempts_deleted', attempts));
    delete from public.quizzes where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------
-- J. İCAZƏLƏR
-- ---------------------------------------------------------------------
-- Hesab tipi rozeti üçün ictimai oxuma (03 işlədilərkən sütun icazələri sıfırlandığı üçün təkrar təminat; zərərsizdir)
grant select (account_type) on public.profiles to anon, authenticated;

-- Daxili funksiyalar: heç bir klient çağıra bilməz
revoke all on function public.guard_admin_users() from public, anon, authenticated;
revoke all on function public.audit_log_immutable() from public, anon, authenticated;
revoke all on function public.audit_scrub(jsonb) from public, anon, authenticated;
revoke all on function public.audit_write(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.audit_content_change() from public, anon, authenticated;
revoke all on function public.assert_admin() from public, anon, authenticated;
revoke all on function public.assert_super_admin() from public, anon, authenticated;
revoke all on function public.forum_slugify(text) from public, anon, authenticated;

-- RLS və brauzer yoxlamaları üçün
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

-- RPC-lər: yalnız daxil olmuş istifadəçi çağıra bilər; admin yoxlaması funksiyanın içindədir
do $$
declare
    f text;
begin
    foreach f in array array[
        'public.my_context()',
        'public.admin_dashboard_stats()',
        'public.admin_list_users(text,text,text,integer,integer)',
        'public.admin_get_user(uuid)',
        'public.admin_add_user_note(uuid,text)',
        'public.admin_set_account_type(uuid,text)',
        'public.admin_block_user(uuid,timestamptz,text)',
        'public.admin_unblock_user(uuid)',
        'public.admin_delete_user(uuid,text)',
        'public.admin_grant_admin(uuid)',
        'public.admin_revoke_admin(uuid)',
        'public.admin_list_admins()',
        'public.admin_forum_topic_action(uuid,text,text)',
        'public.admin_forum_reply_action(uuid,text,text)',
        'public.admin_resolve_report(uuid,text,text)',
        'public.admin_upsert_category(uuid,text,text,integer)',
        'public.admin_set_category_active(uuid,boolean)',
        'public.admin_create_quiz(text,text,text,integer,jsonb)',
        'public.admin_update_quiz(uuid,text,text,text,integer,boolean)',
        'public.admin_delete_quiz(uuid)',
        'public.delete_my_account()'
    ] loop
        execute format('revoke all on function %s from public, anon', f);
        execute format('grant execute on function %s to authenticated', f);
    end loop;
end
$$;

commit;
