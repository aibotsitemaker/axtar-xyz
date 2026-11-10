-- V6.3 additive completion: feed mentions/reports, profile statistics, quiz review.
-- Apply after 11_supabase_postgrest_compatibility.sql. Preserves existing rows.
begin;

-- Badge is public profile metadata. 03_hardening_phase2.sql resets profile
-- column grants, so explicitly expose only this non-sensitive verification flag.
grant select(is_verified) on public.profiles to anon,authenticated;

-- Notifications generated when a username is mentioned in a Feed post/comment.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in
 ('forum_reply','forum_reply_to_reply','moderation','feed_like','feed_comment','teacher_review','verification','feed_mention'));

create or replace function public.notify_feed_mentions()
returns trigger language plpgsql security definer set search_path=public as $$
declare
 v_post uuid;
 v_actor uuid;
 v_link text;
 v_match text[];
 v_uid uuid;
begin
 if tg_table_name='feed_posts' then
  v_post:=new.id;
  v_actor:=new.author_id;
 else
  v_post:=new.post_id;
  v_actor:=new.author_id;
 end if;
 v_link:='/feed?post='||v_post::text;
 for v_match in
  select regexp_matches(coalesce(new.body,''),'(^|[^[:alnum:]_])@([[:alnum:]_.-]{2,30})','g')
 loop
  select p.id into v_uid from public.profiles p where lower(p.username)=lower(v_match[2]) limit 1;
  if v_uid is not null and v_uid<>v_actor then
   insert into public.notifications(user_id,actor_id,type,title,body,link)
   select v_uid,v_actor,'feed_mention','Feed paylaşımında qeyd edildiniz',left(new.body,300),v_link
   where not exists(select 1 from public.notifications n where n.user_id=v_uid and n.actor_id=v_actor and n.type='feed_mention' and n.link=v_link and n.created_at>now()-interval '2 seconds');
  end if;
 end loop;
 return new;
end;
$$;
drop trigger if exists trg_notify_feed_post_mentions on public.feed_posts;
create trigger trg_notify_feed_post_mentions after insert on public.feed_posts for each row execute function public.notify_feed_mentions();
drop trigger if exists trg_notify_feed_comment_mentions on public.feed_comments;
create trigger trg_notify_feed_comment_mentions after insert on public.feed_comments for each row execute function public.notify_feed_mentions();

-- Reports for Feed posts/comments with admin-only review and no client-side status edits.
create table if not exists public.feed_reports(
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references public.profiles(id) on delete cascade,
 post_id uuid references public.feed_posts(id) on delete cascade,
 comment_id uuid references public.feed_comments(id) on delete cascade,
 reason text not null check(reason in ('spam','harassment','misinformation','other')),
 details text check(details is null or char_length(details)<=1000),
 status text not null default 'open' check(status in ('open','resolved','dismissed')),
 resolution_note text check(resolution_note is null or char_length(resolution_note)<=1000),
 resolved_by uuid references public.profiles(id) on delete set null,
 resolved_at timestamptz,
 created_at timestamptz not null default now(),
 check((post_id is not null) <> (comment_id is not null))
);
create unique index if not exists feed_reports_reporter_target_idx on public.feed_reports
 (reporter_id,coalesce(post_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(comment_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists feed_reports_status_created_idx on public.feed_reports(status,created_at desc);
alter table public.feed_reports enable row level security;
drop policy if exists feed_reports_admin_read on public.feed_reports;
create policy feed_reports_admin_read on public.feed_reports for select to authenticated using(public.is_admin());
drop policy if exists feed_reports_own_insert on public.feed_reports;
create policy feed_reports_own_insert on public.feed_reports for insert to authenticated with check(
 reporter_id=auth.uid() and status='open' and resolved_by is null and resolved_at is null
 and ((post_id is not null and exists(select 1 from public.feed_posts p where p.id=post_id and p.status='active' and p.author_id<>auth.uid()))
   or (comment_id is not null and exists(select 1 from public.feed_comments c join public.feed_posts p on p.id=c.post_id where c.id=comment_id and p.status='active' and c.author_id<>auth.uid())))
);
revoke all on public.feed_reports from anon,authenticated;
grant select on public.feed_reports to authenticated;
grant insert(reporter_id,post_id,comment_id,reason,details) on public.feed_reports to authenticated;

create or replace function public.admin_resolve_feed_report(p_id uuid,p_status text,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.assert_admin(); v public.feed_reports%rowtype;
begin
 if p_status not in ('resolved','dismissed','open') then raise exception 'Şikayət statusu yanlışdır'; end if;
 select * into v from public.feed_reports where id=p_id for update;
 if not found then raise exception 'Şikayət tapılmadı'; end if;
 update public.feed_reports set status=p_status,resolution_note=nullif(left(btrim(coalesce(p_note,'')),1000),''),resolved_by=me,resolved_at=now() where id=p_id;
 perform public.audit_write('feed.report.'||p_status,'feed_report',p_id::text,v.reason,jsonb_build_object('post_id',v.post_id,'comment_id',v.comment_id));
end;
$$;
revoke all on function public.admin_resolve_feed_report(uuid,text,text) from public,anon;
grant execute on function public.admin_resolve_feed_report(uuid,text,text) to authenticated;

-- Public aggregate only; does not expose private profile data or individual viewers.
create or replace function public.public_profile_stats(p_user uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
  'feed_posts',(select count(*) from public.feed_posts where author_id=p_user and status='active'),
  'feed_likes_received',(select count(*) from public.feed_likes l join public.feed_posts p on p.id=l.post_id where p.author_id=p_user and p.status='active'),
  'forum_topics',(select count(*) from public.forum_topics where author_id=p_user and status='active'),
  'forum_replies',(select count(*) from public.forum_replies where author_id=p_user and status='active'),
  'total_views',(select count(*) from public.content_views v where
    (v.content_type='profile' and v.content_id=p_user::text)
    or (v.content_type='feed_post' and exists(select 1 from public.feed_posts p where p.id::text=v.content_id and p.author_id=p_user))
    or (v.content_type='forum_topic' and exists(select 1 from public.forum_topics t where t.id::text=v.content_id and t.author_id=p_user))),
  'avg_rating',(select coalesce(round(avg(r.rating)::numeric,2),0) from public.teacher_reviews r where r.teacher_id=p_user and r.status='active'),
  'review_count',(select count(*) from public.teacher_reviews r where r.teacher_id=p_user and r.status='active')
 ) where exists(select 1 from public.profiles p where p.id=p_user);
$$;
revoke all on function public.public_profile_stats(uuid) from public;
grant execute on function public.public_profile_stats(uuid) to anon,authenticated;

-- Reveal answer keys only after the owner has submitted/expired the session.
create or replace function public.quiz_session_review(p_session_id uuid)
returns table(question_id uuid,question_order integer,question_text text,options jsonb,picked_index integer,correct_index integer,explanation text,is_correct boolean)
language plpgsql stable security definer set search_path=public as $$
declare me uuid:=auth.uid(); v public.quiz_sessions%rowtype;
begin
 if me is null then raise exception 'Giriş tələb olunur'; end if;
 select * into v from public.quiz_sessions where id=p_session_id and user_id=me;
 if not found then raise exception 'Sınaq sessiyası tapılmadı'; end if;
 if v.status not in ('completed','expired') or v.attempt_id is null then raise exception 'Nəticəni təhvil verdikdən sonra təhlilə baxa bilərsiniz'; end if;
 return query select q.id,q.position,q.question_text,q.options,(v.answers->>q.id::text)::integer,q.correct_index,q.explanation,
   (v.answers ? q.id::text and (v.answers->>q.id::text)::integer=q.correct_index)
  from public.quiz_questions q where q.quiz_id=v.quiz_id order by q.position;
end;
$$;
revoke all on function public.quiz_session_review(uuid) from public,anon;
grant execute on function public.quiz_session_review(uuid) to authenticated;

-- Complete overdue active sessions before opening a new attempt; never discard them.
create or replace function public.start_quiz_session(p_quiz_id uuid)
returns table(session_id uuid,started_at timestamptz,ends_at timestamptz,answers jsonb)
language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); v public.quiz_sessions%rowtype; dur integer;
begin
 if me is null then raise exception 'Giriş tələb olunur'; end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text||':'||p_quiz_id::text,0));
 select * into v from public.quiz_sessions where user_id=me and quiz_id=p_quiz_id and status='active' for update;
 if found then
  if v.ends_at>now() then return query select v.id,v.started_at,v.ends_at,v.answers; return; end if;
  perform public.finish_quiz_session(v.id);
 end if;
 if (select count(*) from public.quiz_sessions s where s.user_id=me and s.started_at>now()-interval '1 hour')>=10 then raise exception 'Saatlıq sınaq limiti dolub'; end if;
 select duration_seconds into dur from public.quizzes where id=p_quiz_id and is_published;
 if dur is null then raise exception 'Sınaq tapılmadı'; end if;
 insert into public.quiz_sessions(quiz_id,user_id,ends_at) values(p_quiz_id,me,now()+make_interval(secs=>dur)) returning * into v;
 return query select v.id,v.started_at,v.ends_at,v.answers;
end;
$$;
revoke all on function public.start_quiz_session(uuid) from public,anon;
grant execute on function public.start_quiz_session(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
