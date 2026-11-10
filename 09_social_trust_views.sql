-- TəhsilHub V6 additive social, trust and view-counting schema.
-- Run only after existing migrations 01–08. Does not modify legacy rows.
begin;

alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.forum_topics add column if not exists view_count bigint not null default 0;

create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  status text not null default 'active' check (status in ('active','hidden','deleted')),
  view_count bigint not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists feed_posts_recent_idx on public.feed_posts(status, created_at desc);
create index if not exists feed_posts_author_idx on public.feed_posts(author_id, created_at desc);
alter table public.feed_posts enable row level security;
drop policy if exists feed_posts_read on public.feed_posts;
create policy feed_posts_read on public.feed_posts for select using (status='active' or author_id=auth.uid() or public.is_admin());
drop policy if exists feed_posts_insert on public.feed_posts;
create policy feed_posts_insert on public.feed_posts for insert to authenticated with check (author_id=auth.uid() and status='active' and view_count=0);
drop policy if exists feed_posts_update on public.feed_posts;
create policy feed_posts_update on public.feed_posts for update to authenticated using (author_id=auth.uid() or public.is_admin()) with check (author_id=auth.uid() or public.is_admin());
drop policy if exists feed_posts_delete on public.feed_posts;
create policy feed_posts_delete on public.feed_posts for delete to authenticated using (author_id=auth.uid() or public.is_admin());

create table if not exists public.feed_comments (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.feed_posts(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 parent_id uuid references public.feed_comments(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 1000), created_at timestamptz not null default now()
);
create index if not exists feed_comments_post_idx on public.feed_comments(post_id, created_at);
alter table public.feed_comments enable row level security;
drop policy if exists feed_comments_read on public.feed_comments;
create policy feed_comments_read on public.feed_comments for select using (exists(select 1 from public.feed_posts p where p.id=post_id and p.status='active'));
drop policy if exists feed_comments_insert on public.feed_comments;
create policy feed_comments_insert on public.feed_comments for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from public.feed_posts p where p.id=post_id and p.status='active'));
drop policy if exists feed_comments_delete on public.feed_comments;
create policy feed_comments_delete on public.feed_comments for delete to authenticated using(author_id=auth.uid() or public.is_admin());

create table if not exists public.feed_likes (
 post_id uuid not null references public.feed_posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(post_id,user_id)
);
alter table public.feed_likes enable row level security;
drop policy if exists feed_likes_read on public.feed_likes;
create policy feed_likes_read on public.feed_likes for select using(true);
drop policy if exists feed_likes_insert on public.feed_likes;
create policy feed_likes_insert on public.feed_likes for insert to authenticated with check(user_id=auth.uid());
drop policy if exists feed_likes_delete on public.feed_likes;
create policy feed_likes_delete on public.feed_likes for delete to authenticated using(user_id=auth.uid() or public.is_admin());

create table if not exists public.teacher_reviews (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 rating smallint not null check(rating between 1 and 5), body text not null check(char_length(btrim(body)) between 5 and 1500),
 status text not null default 'active' check(status in ('active','hidden')), created_at timestamptz not null default now(),
 unique(teacher_id,author_id), check(teacher_id<>author_id)
);
create index if not exists teacher_reviews_teacher_idx on public.teacher_reviews(teacher_id,status,created_at desc);
alter table public.teacher_reviews enable row level security;
drop policy if exists teacher_reviews_read on public.teacher_reviews;
create policy teacher_reviews_read on public.teacher_reviews for select using(status='active' or public.is_admin());
drop policy if exists teacher_reviews_insert on public.teacher_reviews;
create policy teacher_reviews_insert on public.teacher_reviews for insert to authenticated with check(author_id=auth.uid() and status='active' and teacher_id<>auth.uid() and exists(select 1 from public.profiles p where p.id=teacher_id and p.account_type='teacher'));
drop policy if exists teacher_reviews_moderate on public.teacher_reviews;
create policy teacher_reviews_moderate on public.teacher_reviews for update to authenticated using(public.is_admin()) with check(public.is_admin());

create table if not exists public.verification_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 account_name text not null check(char_length(btrim(account_name)) between 2 and 120),
 username text, account_kind text not null check(char_length(btrim(account_kind)) between 2 and 80),
 work_details text not null check(char_length(btrim(work_details)) between 20 and 2000),
 status text not null default 'pending' check(status in ('pending','approved','rejected','more_info','revoked')),
 admin_note text, reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists verification_status_idx on public.verification_requests(status,created_at);
alter table public.verification_requests enable row level security;
drop policy if exists verification_own_read on public.verification_requests;
create policy verification_own_read on public.verification_requests for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists verification_own_insert on public.verification_requests;
create policy verification_own_insert on public.verification_requests for insert to authenticated with check(user_id=auth.uid() and status='pending');
drop policy if exists verification_admin_update on public.verification_requests;
create policy verification_admin_update on public.verification_requests for update to authenticated using(public.is_admin()) with check(public.is_admin());

create table if not exists public.content_views (
 id bigint generated always as identity primary key, content_type text not null check(content_type in ('pdf','book','forum_topic','profile','feed_post')),
 content_id text not null, viewer_id uuid references public.profiles(id) on delete cascade,
 guest_key text, viewed_at timestamptz not null default now(),
 check((viewer_id is not null and guest_key is null) or (viewer_id is null and guest_key is not null))
);
create index if not exists content_views_lookup_idx on public.content_views(content_type,content_id,viewed_at desc);
create unique index if not exists content_views_user_window_idx on public.content_views(content_type,content_id,viewer_id,date_trunc('hour',viewed_at at time zone 'UTC')) where viewer_id is not null;
create unique index if not exists content_views_guest_window_idx on public.content_views(content_type,content_id,guest_key,date_trunc('hour',viewed_at at time zone 'UTC')) where guest_key is not null;
alter table public.content_views enable row level security;
revoke all on public.content_views from anon, authenticated;

create or replace function public.record_content_view(p_type text,p_id text,p_guest_key text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_key text;
begin
 if p_type not in ('pdf','book','forum_topic','profile','feed_post') or p_id is null or length(p_id)>100 then return false; end if;
 if v_uid is null then
   if auth.role() <> 'service_role' or p_guest_key is null or p_guest_key !~ '^[a-f0-9-]{36}$' then return false; end if;
   v_key:=p_guest_key;
 else v_key:=null; end if;
 insert into public.content_views(content_type,content_id,viewer_id,guest_key)
 values(p_type,p_id,v_uid,v_key) on conflict do nothing;
 if not found then return false; end if;
 perform set_config('app.allow_counter_update','on',true);
 if p_type='pdf' then update public.pdfs set view_count=view_count+1 where id::text=p_id and status='active';
 elsif p_type='book' then update public.books set view_count=view_count+1 where id::text=p_id and status='active';
 elsif p_type='feed_post' then update public.feed_posts set view_count=view_count+1 where id::text=p_id and status='active';
 elsif p_type='forum_topic' then update public.forum_topics set view_count=view_count+1 where id::text=p_id and status='active';
 end if;
 perform set_config('app.allow_counter_update','off',true);
 return true;
end; $$;
revoke all on function public.record_content_view(text,text,text) from public;
grant execute on function public.record_content_view(text,text,text) to anon,authenticated;

create or replace function public.review_rating_summary(p_teacher uuid)
returns table(avg_rating numeric,review_count bigint) language sql stable security definer set search_path=public as $$
 select coalesce(round(avg(rating)::numeric,2),0),count(*) from public.teacher_reviews where teacher_id=p_teacher and status='active';
$$;
revoke all on function public.review_rating_summary(uuid) from public;
grant execute on function public.review_rating_summary(uuid) to anon,authenticated;

grant select,delete on public.feed_posts to authenticated;
grant insert(author_id,body) on public.feed_posts to authenticated;
grant select,insert,delete on public.feed_comments,public.feed_likes to authenticated;
grant select on public.teacher_reviews,public.verification_requests to authenticated;
grant insert(teacher_id,author_id,rating,body) on public.teacher_reviews to authenticated;
grant insert(user_id,account_name,username,account_kind,work_details) on public.verification_requests to authenticated;
grant update(status) on public.teacher_reviews to authenticated;
grant update(status,admin_note,reviewed_by,reviewed_at) on public.verification_requests to authenticated;
grant select on public.feed_posts,public.feed_comments,public.feed_likes,public.teacher_reviews to anon;
grant usage,select on sequence public.content_views_id_seq to service_role;
-- PostgREST may not yet know about the newly-created REST objects.
notify pgrst, 'reload schema';
commit;
