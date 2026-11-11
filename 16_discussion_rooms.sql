-- V6.9: topic-based discussion rooms, additive to existing one-to-one messages.
begin;

create table if not exists public.discussion_rooms(
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check(slug ~ '^[a-z0-9-]{2,60}$'),
 title text not null check(char_length(btrim(title)) between 3 and 100),
 subject text not null check(char_length(btrim(subject)) between 2 and 60),
 description text not null check(char_length(btrim(description)) between 10 and 400),
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.discussion_room_members(
 room_id uuid not null references public.discussion_rooms(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(room_id,user_id)
);
create index if not exists discussion_room_members_user_idx on public.discussion_room_members(user_id,joined_at desc);
create table if not exists public.discussion_room_messages(
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.discussion_rooms(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index if not exists discussion_room_messages_recent_idx on public.discussion_room_messages(room_id,created_at desc);

insert into public.discussion_rooms(slug,title,subject,description) values
 ('dim-hazirligi','DİM hazırlığı','İmtahan','DİM fənləri, hazırlıq planları və imtahan strategiyaları haqqında fikir mübadiləsi.'),
 ('riyaziyyat','Riyaziyyat otağı','Riyaziyyat','Riyazi suallar, həll üsulları və mövzular üzrə birgə öyrənmə.'),
 ('ingilis-dili','İngilis dili','Dil öyrənmə','İngilis dili praktikası, qrammatika və öyrənmə resursları.'),
 ('proqramlasdirma','Proqramlaşdırma','Texnologiya','Kodlaşdırma, layihələr, alqoritmlər və texnologiya müzakirələri.'),
 ('universitet-heyati','Universitet həyatı','Tələbə həyatı','Universitet seçimi, tələbə həyatı və akademik imkanlar.'),
 ('mueellimler','Müəllimlər otağı','Tədris','Müəllimlər üçün tədris təcrübəsi, metodika və resurs mübadiləsi.')
on conflict(slug) do nothing;

alter table public.discussion_rooms enable row level security;
alter table public.discussion_room_members enable row level security;
alter table public.discussion_room_messages enable row level security;
drop policy if exists discussion_rooms_read on public.discussion_rooms;
create policy discussion_rooms_read on public.discussion_rooms for select using(is_active or public.is_admin());
drop policy if exists discussion_members_read_own on public.discussion_room_members;
create policy discussion_members_read_own on public.discussion_room_members for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists discussion_messages_read_members on public.discussion_room_messages;
create policy discussion_messages_read_members on public.discussion_room_messages for select to authenticated using(exists(select 1 from public.discussion_room_members m where m.room_id=discussion_room_messages.room_id and m.user_id=auth.uid()));
revoke all on public.discussion_rooms,public.discussion_room_members,public.discussion_room_messages from anon,authenticated;
grant select on public.discussion_rooms to anon,authenticated;
grant select on public.discussion_room_members,public.discussion_room_messages to authenticated;

create or replace function public.list_discussion_rooms()
returns table(room_id uuid,slug text,title text,subject text,description text,member_count bigint,is_member boolean)
language sql stable security definer set search_path=public as $$
 select r.id,r.slug,r.title,r.subject,r.description,count(m.user_id),coalesce(bool_or(m.user_id=auth.uid()),false)
 from public.discussion_rooms r left join public.discussion_room_members m on m.room_id=r.id
 where r.is_active or public.is_admin() group by r.id order by count(m.user_id) desc,r.title;
$$;
revoke all on function public.list_discussion_rooms() from public;
grant execute on function public.list_discussion_rooms() to anon,authenticated;

create or replace function public.join_discussion_room(p_room_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid();
begin
 if me is null then raise exception 'Otağa qoşulmaq üçün daxil olun' using errcode='42501'; end if;
 if not exists(select 1 from public.discussion_rooms where id=p_room_id and is_active) then raise exception 'Müzakirə otağı tapılmadı' using errcode='P0002'; end if;
 insert into public.discussion_room_members(room_id,user_id) values(p_room_id,me) on conflict do nothing;
 return true;
end; $$;
revoke all on function public.join_discussion_room(uuid) from public,anon;
grant execute on function public.join_discussion_room(uuid) to authenticated;

create or replace function public.leave_discussion_room(p_room_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Giriş tələb olunur' using errcode='42501'; end if;
 delete from public.discussion_room_members where room_id=p_room_id and user_id=auth.uid();
 return found;
end; $$;
revoke all on function public.leave_discussion_room(uuid) from public,anon;
grant execute on function public.leave_discussion_room(uuid) to authenticated;

create or replace function public.send_discussion_room_message(p_room_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); msg_id uuid; body_text text:=btrim(coalesce(p_body,''));
begin
 if me is null then raise exception 'Mesaj göndərmək üçün daxil olun' using errcode='42501'; end if;
 if char_length(body_text) not between 1 and 2000 then raise exception 'Mesaj 1–2000 simvol olmalıdır' using errcode='22023'; end if;
 if not exists(select 1 from public.discussion_room_members where room_id=p_room_id and user_id=me) then raise exception 'Mesaj üçün əvvəlcə otağa qoşulun' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text||':'||p_room_id::text,0));
 if (select count(*) from public.discussion_room_messages where sender_id=me and created_at>now()-interval '1 hour')>=60 then raise exception 'Saatlıq mesaj limiti dolub' using errcode='22023'; end if;
 insert into public.discussion_room_messages(room_id,sender_id,body) values(p_room_id,me,body_text) returning id into msg_id;
 return msg_id;
end; $$;
revoke all on function public.send_discussion_room_message(uuid,text) from public,anon;
grant execute on function public.send_discussion_room_message(uuid,text) to authenticated;

notify pgrst,'reload schema';
commit;
