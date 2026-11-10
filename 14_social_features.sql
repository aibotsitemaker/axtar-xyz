-- TəhsilHub v6.7: additive Feed media/polls, teacher follows and learning projects.
-- Run after 13_quiz_question_types.sql. No existing rows are removed or rewritten.
begin;

alter table public.feed_posts add column if not exists post_type text not null default 'text';
alter table public.feed_posts add column if not exists media_urls jsonb not null default '[]'::jsonb;
alter table public.feed_posts drop constraint if exists feed_posts_post_type_check;
alter table public.feed_posts add constraint feed_posts_post_type_check check(post_type in ('text','image','poll','question'));
alter table public.feed_posts drop constraint if exists feed_posts_media_urls_check;
alter table public.feed_posts add constraint feed_posts_media_urls_check check(
 jsonb_typeof(media_urls)='array' and jsonb_array_length(media_urls)<=4
 and ((post_type='image' and jsonb_array_length(media_urls) between 1 and 4)
   or (post_type<>'image' and jsonb_array_length(media_urls)=0))
);
create index if not exists feed_posts_type_recent_idx on public.feed_posts(post_type,status,created_at desc);

create table if not exists public.feed_poll_options(
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.feed_posts(id) on delete cascade,
 position smallint not null check(position between 1 and 6),
 label text not null check(char_length(btrim(label)) between 1 and 120),
 unique(post_id,position), unique(id,post_id)
);
create table if not exists public.feed_poll_votes(
 post_id uuid not null references public.feed_posts(id) on delete cascade,
 option_id uuid not null,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id),
 foreign key(option_id,post_id) references public.feed_poll_options(id,post_id) on delete cascade
);
create index if not exists feed_poll_votes_option_idx on public.feed_poll_votes(option_id);
alter table public.feed_poll_options enable row level security;
alter table public.feed_poll_votes enable row level security;
drop policy if exists feed_poll_options_read on public.feed_poll_options;
create policy feed_poll_options_read on public.feed_poll_options for select using(
 exists(select 1 from public.feed_posts p where p.id=post_id and p.status='active' and p.post_type='poll')
);
drop policy if exists feed_poll_votes_own_read on public.feed_poll_votes;
create policy feed_poll_votes_own_read on public.feed_poll_votes for select to authenticated using(user_id=auth.uid());
revoke all on public.feed_poll_options,public.feed_poll_votes from anon,authenticated;
grant select on public.feed_poll_options to anon,authenticated;
grant select on public.feed_poll_votes to authenticated;

create table if not exists public.feed_media_upload_limits(
 user_id uuid not null references public.profiles(id) on delete cascade,
 window_start timestamptz not null,
 used integer not null check(used between 1 and 20),
 primary key(user_id,window_start)
);
alter table public.feed_media_upload_limits enable row level security;
revoke all on public.feed_media_upload_limits from public,anon,authenticated;
create or replace function public.claim_feed_media_upload()
returns boolean language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); v_used integer;
begin
 if me is null then return false; end if;
 delete from public.feed_media_upload_limits where window_start<date_trunc('hour',now())-interval '48 hours';
 insert into public.feed_media_upload_limits(user_id,window_start,used)
 values(me,date_trunc('hour',now()),1)
 on conflict(user_id,window_start) do update set used=public.feed_media_upload_limits.used+1
 where public.feed_media_upload_limits.used<20 returning used into v_used;
 return v_used is not null;
end; $$;
revoke all on function public.claim_feed_media_upload() from public,anon;
grant execute on function public.claim_feed_media_upload() to authenticated;

-- Only the authenticated owner can write an image to their own folder; downloads are public.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('feed-media','feed-media',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists feed_media_public_read on storage.objects;
create policy feed_media_public_read on storage.objects for select to public using(bucket_id='feed-media');
drop policy if exists feed_media_owner_insert on storage.objects;
create policy feed_media_owner_insert on storage.objects for insert to authenticated
 with check(bucket_id='feed-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists feed_media_owner_delete on storage.objects;
create policy feed_media_owner_delete on storage.objects for delete to authenticated
 using(bucket_id='feed-media' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.create_feed_post(p_body text,p_post_type text default 'text',p_media_urls jsonb default '[]'::jsonb,p_poll_options jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); v_id uuid; v_item text; v_pos integer:=0;
begin
 if me is null then raise exception 'Paylaşım üçün daxil olun' using errcode='42501'; end if;
 p_media_urls:=coalesce(p_media_urls,'[]'::jsonb); p_poll_options:=coalesce(p_poll_options,'[]'::jsonb);
 if char_length(btrim(coalesce(p_body,''))) not between 1 and 500 then raise exception 'Mətn 1–500 simvol olmalıdır' using errcode='22023'; end if;
 if p_post_type not in ('text','image','poll','question') then raise exception 'Paylaşım növü düzgün deyil' using errcode='22023'; end if;
 if jsonb_typeof(coalesce(p_media_urls,'[]'::jsonb))<>'array' or jsonb_typeof(coalesce(p_poll_options,'[]'::jsonb))<>'array' then raise exception 'Paylaşım əlavələri düzgün deyil' using errcode='22023'; end if;
 if p_post_type='image' then
  if jsonb_array_length(p_media_urls) not between 1 and 4 or jsonb_array_length(p_poll_options)<>0 then raise exception '1–4 şəkil əlavə edin' using errcode='22023'; end if;
  for v_item in select jsonb_array_elements_text(p_media_urls) loop
   if v_item !~ ('^'||me::text||'/[A-Za-z0-9_.-]+\.(jpg|png|webp)$') then raise exception 'Şəkil yolu hesabınıza aid deyil' using errcode='22023'; end if;
  end loop;
 elsif p_post_type='poll' then
  if jsonb_array_length(p_media_urls)<>0 or jsonb_array_length(p_poll_options) not between 2 and 6 then raise exception 'Sorğuda 2–6 cavab variantı olmalıdır' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_poll_options) x where char_length(btrim(x)) not between 1 and 120) then raise exception 'Sorğu variantları 1–120 simvol olmalıdır' using errcode='22023'; end if;
  if (select count(distinct lower(btrim(x))) from jsonb_array_elements_text(p_poll_options) x)<>jsonb_array_length(p_poll_options) then raise exception 'Sorğu variantları təkrarlana bilməz' using errcode='22023'; end if;
 else
  if jsonb_array_length(p_media_urls)<>0 or jsonb_array_length(p_poll_options)<>0 then raise exception 'Bu paylaşım növündə əlavə yoxdur' using errcode='22023'; end if;
 end if;
 insert into public.feed_posts(author_id,body,post_type,media_urls) values(me,btrim(p_body),p_post_type,coalesce(p_media_urls,'[]'::jsonb)) returning id into v_id;
 if p_post_type='poll' then
  for v_item in select jsonb_array_elements_text(p_poll_options) loop
   v_pos:=v_pos+1; insert into public.feed_poll_options(post_id,position,label) values(v_id,v_pos,btrim(v_item));
  end loop;
 end if;
 return v_id;
end; $$;
revoke all on function public.create_feed_post(text,text,jsonb,jsonb) from public,anon;
grant execute on function public.create_feed_post(text,text,jsonb,jsonb) to authenticated;

create or replace function public.feed_poll_results(p_post uuid)
returns table(option_id uuid,label text,vote_count bigint,total_votes bigint,percentage integer,has_voted boolean,selected boolean)
language plpgsql stable security definer set search_path=public as $$
declare me uuid:=auth.uid(); v_total bigint; v_voted boolean;
begin
 if not exists(select 1 from public.feed_posts p where p.id=p_post and p.status='active' and p.post_type='poll') then return; end if;
 select count(*) into v_total from public.feed_poll_votes where post_id=p_post;
 select exists(select 1 from public.feed_poll_votes where post_id=p_post and user_id=me) into v_voted;
 return query select o.id,o.label,count(v.user_id)::bigint,v_total,
  case when v_total=0 then 0 else round(count(v.user_id)*100.0/v_total)::integer end,
  v_voted,(me is not null and exists(select 1 from public.feed_poll_votes mine where mine.post_id=p_post and mine.user_id=me and mine.option_id=o.id))
 from public.feed_poll_options o left join public.feed_poll_votes v on v.option_id=o.id and v.post_id=o.post_id
 where o.post_id=p_post group by o.id,o.position,o.label order by o.position;
end; $$;
revoke all on function public.feed_poll_results(uuid) from public;
grant execute on function public.feed_poll_results(uuid) to anon,authenticated;

create or replace function public.vote_feed_poll(p_post uuid,p_option uuid)
returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid();
begin
 if me is null then raise exception 'Sorğuda iştirak üçün daxil olun' using errcode='42501'; end if;
 if not exists(select 1 from public.feed_posts p join public.feed_poll_options o on o.post_id=p.id where p.id=p_post and p.status='active' and p.post_type='poll' and o.id=p_option) then raise exception 'Sorğu və ya cavab tapılmadı' using errcode='22023'; end if;
 insert into public.feed_poll_votes(post_id,option_id,user_id) values(p_post,p_option,me)
 on conflict(post_id,user_id) do update set option_id=excluded.option_id,created_at=now();
end; $$;
revoke all on function public.vote_feed_poll(uuid,uuid) from public,anon;
grant execute on function public.vote_feed_poll(uuid,uuid) to authenticated;

-- Teacher follows are public relationship counts; only the follower can add/remove their row.
create table if not exists public.teacher_follows(
 follower_id uuid not null references public.profiles(id) on delete cascade,
 teacher_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,teacher_id), check(follower_id<>teacher_id)
);
create index if not exists teacher_follows_teacher_idx on public.teacher_follows(teacher_id,created_at desc);
alter table public.teacher_follows enable row level security;
drop policy if exists teacher_follows_read on public.teacher_follows;
create policy teacher_follows_read on public.teacher_follows for select using(true);
drop policy if exists teacher_follows_insert on public.teacher_follows;
create policy teacher_follows_insert on public.teacher_follows for insert to authenticated with check(
 follower_id=auth.uid() and exists(select 1 from public.profiles p where p.id=teacher_id and p.account_type='teacher')
);
drop policy if exists teacher_follows_delete on public.teacher_follows;
create policy teacher_follows_delete on public.teacher_follows for delete to authenticated using(follower_id=auth.uid());
grant select on public.teacher_follows to anon,authenticated;
grant insert(follower_id,teacher_id) on public.teacher_follows to authenticated;
grant delete on public.teacher_follows to authenticated;

-- Small learning-project directory with owner-managed content and a safe optional external URL.
create table if not exists public.learning_projects(
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 3 and 120),
 subject text not null check(char_length(btrim(subject)) between 2 and 60),
 summary text not null check(char_length(btrim(summary)) between 10 and 240),
 description text not null check(char_length(btrim(description)) between 10 and 4000),
 tags text[] not null default '{}' check(cardinality(tags)<=8),
 external_url text check(external_url is null or (length(external_url)<=1000 and external_url ~ '^https://[^[:space:]]+$')),
 status text not null default 'active' check(status in ('active','hidden')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists learning_projects_recent_idx on public.learning_projects(status,created_at desc);
create index if not exists learning_projects_author_idx on public.learning_projects(author_id,created_at desc);
alter table public.learning_projects enable row level security;
drop policy if exists learning_projects_read on public.learning_projects;
create policy learning_projects_read on public.learning_projects for select using(status='active' or author_id=auth.uid() or public.is_admin());
drop policy if exists learning_projects_insert on public.learning_projects;
create policy learning_projects_insert on public.learning_projects for insert to authenticated with check(author_id=auth.uid() and status='active');
drop policy if exists learning_projects_update on public.learning_projects;
create policy learning_projects_update on public.learning_projects for update to authenticated using(author_id=auth.uid() or public.is_admin()) with check(author_id=auth.uid() or public.is_admin());
drop policy if exists learning_projects_delete on public.learning_projects;
create policy learning_projects_delete on public.learning_projects for delete to authenticated using(author_id=auth.uid() or public.is_admin());
grant select on public.learning_projects to anon,authenticated;
grant insert(author_id,title,subject,summary,description,tags,external_url) on public.learning_projects to authenticated;
grant update(title,subject,summary,description,tags,external_url) on public.learning_projects to authenticated;
grant delete on public.learning_projects to authenticated;

alter table public.saved_content drop constraint if exists saved_content_content_type_check;
alter table public.saved_content add constraint saved_content_content_type_check check(content_type in ('forum_topic','feed_post','pdf','book','teacher_profile','project'));
create or replace function public.toggle_saved_content(p_type text,p_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); exists_item boolean:=false; removed integer;
begin
 if me is null then raise exception 'Giriş tələb olunur'; end if;
 if p_type not in ('forum_topic','feed_post','pdf','book','teacher_profile','project') or p_id is null or length(p_id)>100 then raise exception 'Məzmun növü və ya identifikatoru yanlışdır'; end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text||':'||p_type||':'||p_id,0));
 delete from public.saved_content where user_id=me and content_type=p_type and content_id=p_id;
 get diagnostics removed=row_count;
 if removed>0 then return false; end if;
 if p_type='forum_topic' then select exists(select 1 from public.forum_topics where id::text=p_id and status='active') into exists_item;
 elsif p_type='feed_post' then select exists(select 1 from public.feed_posts where id::text=p_id and status='active') into exists_item;
 elsif p_type='pdf' then select exists(select 1 from public.pdfs where id::text=p_id and status='active') into exists_item;
 elsif p_type='book' then select exists(select 1 from public.books where id::text=p_id and status='active') into exists_item;
 elsif p_type='teacher_profile' then select exists(select 1 from public.profiles where id::text=p_id and account_type='teacher') into exists_item;
 elsif p_type='project' then select exists(select 1 from public.learning_projects where id::text=p_id and status='active') into exists_item;
 end if;
 if not exists_item then raise exception 'Məzmun tapılmadı'; end if;
 insert into public.saved_content(user_id,content_type,content_id) values(me,p_type,p_id) on conflict do nothing;
 return true;
end; $$;
revoke all on function public.toggle_saved_content(text,text) from public;
grant execute on function public.toggle_saved_content(text,text) to authenticated;

notify pgrst,'reload schema';
commit;
