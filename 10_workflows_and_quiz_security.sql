-- Additive V6.1 workflows. Apply after 09_social_trust_views.sql.
begin;

-- Narrow the legacy v6 grants so users can edit their text without touching counters or authorship.
revoke insert,update on public.feed_posts from authenticated;
grant insert(author_id,body) on public.feed_posts to authenticated;
grant update(body) on public.feed_posts to authenticated;
revoke insert,update on public.teacher_reviews,public.verification_requests from authenticated;
grant insert(teacher_id,author_id,rating,body) on public.teacher_reviews to authenticated;
grant insert(user_id,account_name,username,account_kind,work_details) on public.verification_requests to authenticated;
grant update(status) on public.teacher_reviews to authenticated;
grant update(status,admin_note,reviewed_by,reviewed_at) on public.verification_requests to authenticated;

-- Feed notifications share the existing inbox. Preserve existing forum notification values.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in
 ('forum_reply','forum_reply_to_reply','moderation','feed_like','feed_comment','teacher_review','verification'));

create or replace function public.notify_feed_interaction()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_owner uuid; v_post uuid; v_actor uuid; v_kind text; v_link text; v_label text; v_body text;
begin
 if tg_table_name='feed_likes' then v_post:=new.post_id; v_actor:=new.user_id; v_kind:='feed_like'; v_label:='Paylaşımınız bəyənildi';
 else v_post:=new.post_id; v_actor:=new.author_id; v_kind:='feed_comment'; v_label:='Paylaşımınıza şərh yazıldı'; v_body:=new.body; end if;
 select author_id into v_owner from public.feed_posts where id=v_post and status='active';
 if v_owner is not null and v_owner<>v_actor then
   v_link:='/feed?post='||v_post::text;
   insert into public.notifications(user_id,actor_id,type,title,body,link)
    values(v_owner,v_actor,v_kind,v_label,left(v_body,300),v_link);
 end if;
 return new;
end; $$;
drop trigger if exists trg_notify_feed_like on public.feed_likes;
create trigger trg_notify_feed_like after insert on public.feed_likes for each row execute function public.notify_feed_interaction();
drop trigger if exists trg_notify_feed_comment on public.feed_comments;
create trigger trg_notify_feed_comment after insert on public.feed_comments for each row execute function public.notify_feed_interaction();

create or replace function public.guard_feed_write()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or new.author_id<>auth.uid() then raise exception 'İcazə yoxdur' using errcode='42501'; end if;
 if tg_table_name='feed_posts' then
  if (select count(*) from public.feed_posts where author_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Saatlıq paylaşım limiti dolub'; end if;
  if exists(select 1 from public.feed_posts where author_id=auth.uid() and lower(btrim(body))=lower(btrim(new.body)) and created_at>now()-interval '10 minutes') then raise exception 'Eyni paylaşımı təkrar göndərmək olmaz'; end if;
 else
  if new.parent_id is not null and not exists(select 1 from public.feed_comments where id=new.parent_id and post_id=new.post_id) then raise exception 'Cavab bu paylaşımın şərhinə aid deyil'; end if;
  if (select count(*) from public.feed_comments where author_id=auth.uid() and created_at>now()-interval '1 hour')>=30 then raise exception 'Saatlıq şərh limiti dolub'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists trg_guard_feed_post on public.feed_posts;
create trigger trg_guard_feed_post before insert on public.feed_posts for each row execute function public.guard_feed_write();
drop trigger if exists trg_guard_feed_comment on public.feed_comments;
create trigger trg_guard_feed_comment before insert on public.feed_comments for each row execute function public.guard_feed_write();

create or replace function public.notify_teacher_review()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.notifications(user_id,actor_id,type,title,body,link)
 select new.teacher_id,new.author_id,'teacher_review','Müəllim profilinizə rəy yazıldı',left(new.body,300),'/u/'||new.teacher_id::text
 where new.status='active' and new.teacher_id<>new.author_id;
 return new;
end; $$;
drop trigger if exists trg_notify_teacher_review on public.teacher_reviews;
create trigger trg_notify_teacher_review after insert on public.teacher_reviews for each row execute function public.notify_teacher_review();

create or replace function public.sync_verification_status()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and new.status is distinct from old.status then
   if new.status='approved' then update public.profiles set is_verified=true where id=new.user_id;
   elsif old.status='approved' then update public.profiles set is_verified=false where id=new.user_id; end if;
   update public.verification_requests set reviewed_by=auth.uid(),reviewed_at=now() where id=new.id;
   insert into public.notifications(user_id,actor_id,type,title,body,link)
    values(new.user_id,auth.uid(),'verification','Doğrulama müraciətiniz yeniləndi',left(coalesce(nullif(new.admin_note,''),new.status),300),'/profile');
 end if;
 return new;
end; $$;
drop trigger if exists trg_sync_verification_status on public.verification_requests;
create trigger trg_sync_verification_status after update of status on public.verification_requests for each row execute function public.sync_verification_status();

-- Harden guest view RPC even when migration 09 was installed before the signed-session API existed.
create table if not exists public.view_rate_limits (
 ip_hash text not null check(ip_hash ~ '^[a-f0-9]{64}$'),
 minute_bucket timestamptz not null,
 hits integer not null default 0,
 primary key(ip_hash,minute_bucket)
);
alter table public.view_rate_limits enable row level security;
revoke all on public.view_rate_limits from anon,authenticated;
drop function if exists public.record_content_view(text,text,text);
create or replace function public.record_content_view(p_type text,p_id text,p_guest_key text,p_ip_hash text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_hits integer;
begin
 if p_type not in ('pdf','book','forum_topic','profile','feed_post') or p_id is null or length(p_id)>100 then return false; end if;
 if v_uid is null then
  if coalesce(auth.role(),'')<>'service_role' or p_guest_key is null or p_guest_key !~ '^[a-f0-9-]{36}$' or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  insert into public.view_rate_limits(ip_hash,minute_bucket,hits) values(p_ip_hash,date_trunc('minute',now()),1)
  on conflict(ip_hash,minute_bucket) do update set hits=public.view_rate_limits.hits+1 returning hits into v_hits;
  if v_hits>120 then return false; end if;
 end if;
 if p_type='pdf' and not exists(select 1 from public.pdfs where id::text=p_id and status='active') then return false; end if;
 if p_type='book' and not exists(select 1 from public.books where id::text=p_id and status='active') then return false; end if;
 if p_type='forum_topic' and not exists(select 1 from public.forum_topics where id::text=p_id and status='active') then return false; end if;
 if p_type='feed_post' and not exists(select 1 from public.feed_posts where id::text=p_id and status='active') then return false; end if;
 if p_type='profile' and not exists(select 1 from public.profiles where id::text=p_id) then return false; end if;
 insert into public.content_views(content_type,content_id,viewer_id,guest_key)
 values(p_type,p_id,v_uid,case when v_uid is null then p_guest_key else null end) on conflict do nothing;
 if not found then return false; end if;
 perform set_config('app.allow_counter_update','on',true);
 if p_type='pdf' then update public.pdfs set view_count=view_count+1 where id::text=p_id and status='active';
 elsif p_type='book' then update public.books set view_count=view_count+1 where id::text=p_id and status='active';
 elsif p_type='feed_post' then update public.feed_posts set view_count=view_count+1 where id::text=p_id and status='active';
 elsif p_type='forum_topic' then update public.forum_topics set view_count=view_count+1 where id::text=p_id and status='active'; end if;
 perform set_config('app.allow_counter_update','off',true);
 return true;
end; $$;

-- Polymorphic saved items. The RPC validates that each target exists and is visible.
create table if not exists public.saved_content (
 user_id uuid not null references public.profiles(id) on delete cascade,
 content_type text not null check(content_type in ('forum_topic','feed_post','pdf','book','teacher_profile')),
 content_id text not null check(length(content_id) between 1 and 100),
 created_at timestamptz not null default now(), primary key(user_id,content_type,content_id)
);
create index if not exists saved_content_user_idx on public.saved_content(user_id,created_at desc);
alter table public.saved_content enable row level security;
drop policy if exists saved_content_own on public.saved_content;
create policy saved_content_own on public.saved_content for select to authenticated using(user_id=auth.uid());
revoke all on public.saved_content from anon,authenticated;
grant select on public.saved_content to authenticated;
insert into public.saved_content(user_id,content_type,content_id,created_at)
 select user_id,case when item_type='book' then 'book' else 'pdf' end,coalesce(book_id,pdf_id)::text,created_at
 from public.favorites where item_type in ('book','pdf')
 on conflict(user_id,content_type,content_id) do nothing;

create or replace function public.toggle_saved_content(p_type text,p_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); exists_item boolean:=false; removed integer;
begin
 if me is null then raise exception 'Giriş tələb olunur'; end if;
 if p_type not in ('forum_topic','feed_post','pdf','book','teacher_profile') or p_id is null or length(p_id)>100 then raise exception 'Məzmun növü və ya identifikatoru yanlışdır'; end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text||':'||p_type||':'||p_id,0));
 delete from public.saved_content where user_id=me and content_type=p_type and content_id=p_id;
 get diagnostics removed=row_count;
 if removed>0 then return false; end if;
 if p_type='forum_topic' then select exists(select 1 from public.forum_topics where id::text=p_id and status='active') into exists_item;
 elsif p_type='feed_post' then select exists(select 1 from public.feed_posts where id::text=p_id and status='active') into exists_item;
 elsif p_type='pdf' then select exists(select 1 from public.pdfs where id::text=p_id and status='active') into exists_item;
 elsif p_type='book' then select exists(select 1 from public.books where id::text=p_id and status='active') into exists_item;
 elsif p_type='teacher_profile' then select exists(select 1 from public.profiles where id::text=p_id and account_type='teacher') into exists_item;
 else raise exception 'Məzmun növü yanlışdır'; end if;
 if not exists_item then raise exception 'Məzmun tapılmadı'; end if;
 insert into public.saved_content(user_id,content_type,content_id) values(me,p_type,p_id) on conflict do nothing;
 return true;
end; $$;
revoke all on function public.toggle_saved_content(text,text) from public;
grant execute on function public.toggle_saved_content(text,text) to authenticated;

create or replace function public.popular_feed_post_ids(p_limit integer default 40)
returns table(post_id uuid,like_count bigint,comment_count bigint)
language sql stable security definer set search_path=public as $$
 select p.id,count(distinct l.user_id),count(distinct c.id)
 from public.feed_posts p left join public.feed_likes l on l.post_id=p.id
 left join public.feed_comments c on c.post_id=p.id
 where p.status='active'
 group by p.id
 order by count(distinct l.user_id) desc,count(distinct c.id) desc,p.created_at desc
 limit least(greatest(coalesce(p_limit,40),1),100);
$$;
revoke all on function public.popular_feed_post_ids(integer) from public;
grant execute on function public.popular_feed_post_ids(integer) to anon,authenticated;

-- Atomic idempotent quiz submission; the client no longer needs per-question answer disclosure.
alter table public.quiz_attempts add column if not exists submission_key uuid;
create unique index if not exists quiz_attempts_submission_key_idx on public.quiz_attempts(user_id,submission_key) where submission_key is not null;
create or replace function public.submit_quiz_attempt_once(p_quiz_id uuid,p_answers jsonb,p_seconds integer,p_submission_key uuid)
returns table(r_correct integer,r_total integer,r_percent numeric,r_attempt_id uuid)
language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); dur integer; total integer; ok integer; pct numeric; secs integer; aid uuid;
begin
 if me is null then raise exception 'Giriş tələb olunur'; end if;
 if p_submission_key is null or jsonb_typeof(p_answers)<>'array' then raise exception 'Cavab məlumatı yanlışdır'; end if;
 select duration_seconds into dur from public.quizzes where id=p_quiz_id and is_published;
 if dur is null then raise exception 'Sınaq tapılmadı'; end if;
 if exists(select 1 from public.quiz_attempts where user_id=me and submission_key=p_submission_key) then
   return query select a.correct_count,a.total_questions,a.score_percent,a.id from public.quiz_attempts a where a.user_id=me and a.submission_key=p_submission_key; return;
 end if;
 if (select count(*) from public.quiz_attempts where user_id=me and created_at>now()-interval '1 hour')>=60 then raise exception 'Saatlıq sınaq limiti dolub'; end if;
 select count(*) into total from public.quiz_questions where quiz_id=p_quiz_id;
 select count(*) into ok from public.quiz_questions q join (select distinct on(a->>'q') a->>'q' qid,a->>'picked' picked from jsonb_array_elements(p_answers) a) x on x.qid=q.id::text and x.picked=q.correct_index::text where q.quiz_id=p_quiz_id;
 pct:=case when total=0 then 0 else round(ok*100.0/total,2) end; secs:=least(greatest(coalesce(p_seconds,0),0),dur);
 insert into public.quiz_attempts(quiz_id,user_id,correct_count,total_questions,score_percent,seconds_used,answers,submission_key)
 values(p_quiz_id,me,ok,total,pct,secs,p_answers,p_submission_key)
 on conflict(user_id,submission_key) where submission_key is not null do nothing returning id into aid;
 if aid is null then
  return query select a.correct_count,a.total_questions,a.score_percent,a.id from public.quiz_attempts a where a.user_id=me and a.submission_key=p_submission_key;
  return;
 end if;
 return query select ok,total,pct,aid;
end; $$;
revoke all on function public.submit_quiz_attempt_once(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function public.submit_quiz_attempt_once(uuid,jsonb,integer,uuid) to authenticated;
-- The legacy RPC exposed the correct index and explanation after each answer. Retire it.
revoke all on function public.check_answer(uuid,integer) from public,anon,authenticated;
-- Do not expose correct_index/explanation through PostgREST row selection either.
revoke select on public.quiz_questions from anon,authenticated;
grant select(id,quiz_id,position,question_text,options) on public.quiz_questions to anon,authenticated;

-- Server-owned test session: deadline and every saved answer are authoritative in PostgreSQL.
create table if not exists public.quiz_sessions (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 started_at timestamptz not null default now(), ends_at timestamptz not null,
 status text not null default 'active' check(status in ('active','completed','expired')),
 answers jsonb not null default '{}'::jsonb check(jsonb_typeof(answers)='object'),
 correct_count integer, total_questions integer, score_percent numeric(5,2), attempt_id uuid references public.quiz_attempts(id) on delete set null
);
create unique index if not exists quiz_sessions_one_active_idx on public.quiz_sessions(user_id,quiz_id) where status='active';
create index if not exists quiz_sessions_user_idx on public.quiz_sessions(user_id,started_at desc);
alter table public.quiz_sessions enable row level security;
drop policy if exists quiz_sessions_own_read on public.quiz_sessions;
create policy quiz_sessions_own_read on public.quiz_sessions for select to authenticated using(user_id=auth.uid());
revoke all on public.quiz_sessions from anon,authenticated;
grant select on public.quiz_sessions to authenticated;

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
  update public.quiz_sessions set status='expired' where id=v.id;
 end if;
 if (select count(*) from public.quiz_sessions s where s.user_id=me and s.started_at>now()-interval '1 hour')>=10 then raise exception 'Saatlıq sınaq limiti dolub'; end if;
 select duration_seconds into dur from public.quizzes where id=p_quiz_id and is_published;
 if dur is null then raise exception 'Sınaq tapılmadı'; end if;
 insert into public.quiz_sessions(quiz_id,user_id,ends_at) values(p_quiz_id,me,now()+make_interval(secs=>dur)) returning * into v;
 return query select v.id,v.started_at,v.ends_at,v.answers;
end; $$;
revoke all on function public.start_quiz_session(uuid) from public,anon;
grant execute on function public.start_quiz_session(uuid) to authenticated;

create or replace function public.save_quiz_session_answer(p_session_id uuid,p_question_id uuid,p_picked integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); v public.quiz_sessions%rowtype; opts jsonb;
begin
 if me is null then raise exception 'Giriş tələb olunur'; end if;
 select * into v from public.quiz_sessions where id=p_session_id and user_id=me for update;
 if not found or v.status<>'active' or v.ends_at<=now() then raise exception 'Sınaq bitib və ya tapılmadı'; end if;
 select options into opts from public.quiz_questions where id=p_question_id and quiz_id=v.quiz_id;
 if opts is null or p_picked<0 or p_picked>=jsonb_array_length(opts) then raise exception 'Cavab variantı yanlışdır'; end if;
 update public.quiz_sessions set answers=jsonb_set(answers,array[p_question_id::text],to_jsonb(p_picked),true) where id=v.id returning answers into v.answers;
 return v.answers;
end; $$;
revoke all on function public.save_quiz_session_answer(uuid,uuid,integer) from public,anon;
grant execute on function public.save_quiz_session_answer(uuid,uuid,integer) to authenticated;

create or replace function public.finish_quiz_session(p_session_id uuid)
returns table(r_correct integer,r_total integer,r_percent numeric,r_attempt_id uuid)
language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); v public.quiz_sessions%rowtype; total integer; ok integer; pct numeric; secs integer; aid uuid;
begin
 if me is null then raise exception 'Giriş tələb olunur'; end if;
 select * into v from public.quiz_sessions where id=p_session_id and user_id=me for update;
 if not found then raise exception 'Sınaq cəhdi tapılmadı'; end if;
 if v.status='completed' then return query select v.correct_count,v.total_questions,v.score_percent,v.attempt_id; return; end if;
 select count(*) into total from public.quiz_questions where quiz_id=v.quiz_id;
 select count(*) into ok from public.quiz_questions q join jsonb_each_text(v.answers) a on a.key=q.id::text and a.value=q.correct_index::text where q.quiz_id=v.quiz_id;
 pct:=case when total=0 then 0 else round(ok*100.0/total,2) end;
 secs:=least(greatest(floor(extract(epoch from (least(now(),v.ends_at)-v.started_at)))::integer,0),floor(extract(epoch from (v.ends_at-v.started_at)))::integer);
 insert into public.quiz_attempts(quiz_id,user_id,correct_count,total_questions,score_percent,seconds_used,answers,submission_key)
 values(v.quiz_id,me,ok,total,pct,secs,(select coalesce(jsonb_agg(jsonb_build_object('q',key,'picked',value::integer)),'[]'::jsonb) from jsonb_each_text(v.answers)),v.id)
 on conflict(user_id,submission_key) where submission_key is not null do nothing returning id into aid;
 if aid is null then select id into aid from public.quiz_attempts where user_id=me and submission_key=v.id; end if;
 update public.quiz_sessions set status=case when now()>ends_at then 'expired' else 'completed' end,correct_count=ok,total_questions=total,score_percent=pct,attempt_id=aid where id=v.id;
 return query select ok,total,pct,aid;
end; $$;
revoke all on function public.finish_quiz_session(uuid) from public,anon;
grant execute on function public.finish_quiz_session(uuid) to authenticated;
revoke all on function public.submit_quiz_attempt_once(uuid,jsonb,integer,uuid) from public,anon,authenticated;
revoke all on function public.submit_quiz_attempt(uuid,jsonb,integer) from public,anon,authenticated;

drop function if exists public.admin_v6_analytics();
create or replace function public.admin_v6_analytics(p_from timestamptz,p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_from timestamptz:=greatest(coalesce(p_from,now()-interval '7 days'),now()-interval '90 days'); v_to timestamptz:=least(coalesce(p_to,now()),now());
begin
 if not public.is_admin() then raise exception 'İcazə yoxdur' using errcode='42501'; end if;
 if v_to<v_from then raise exception 'Tarix aralığı yanlışdır'; end if;
 return jsonb_build_object(
  'verified_users',(select count(*) from public.profiles where is_verified and created_at between v_from and v_to),
  'pending_verifications',(select count(*) from public.verification_requests where status='pending' and created_at between v_from and v_to),
  'feed_posts',(select count(*) from public.feed_posts where status='active' and created_at between v_from and v_to),
  'feed_likes',(select count(*) from public.feed_likes where created_at between v_from and v_to),
  'feed_comments',(select count(*) from public.feed_comments where created_at between v_from and v_to),
  'teacher_reviews',(select count(*) from public.teacher_reviews where status='active' and created_at between v_from and v_to),
  'saved_items',(select count(*) from public.saved_content where created_at between v_from and v_to),
  'tracked_views',(select count(*) from public.content_views where viewed_at between v_from and v_to),
  'quiz_attempts',(select count(*) from public.quiz_attempts where created_at between v_from and v_to),
  'views_by_day',(select coalesce(jsonb_agg(jsonb_build_object('day',d.bucket_day,'views',coalesce(x.n,0)) order by d.bucket_day),'[]'::jsonb) from generate_series(date_trunc('day',v_from),date_trunc('day',v_to),interval '1 day') as d(bucket_day) left join (select date_trunc('day',viewed_at) as bucket_day,count(*) as n from public.content_views where viewed_at between v_from and v_to group by 1) x on x.bucket_day=d.bucket_day));
end; $$;
revoke all on function public.admin_v6_analytics(timestamptz,timestamptz) from public,anon;
grant execute on function public.admin_v6_analytics(timestamptz,timestamptz) to authenticated;
-- Anonymous counts must pass through the signed, HttpOnly session endpoint. Keep authenticated counting available.
revoke execute on function public.record_content_view(text,text,text,text) from public,anon;
grant execute on function public.record_content_view(text,text,text,text) to authenticated,service_role;
revoke execute on function public.increment_book_view(uuid) from public,anon,authenticated;
revoke execute on function public.increment_pdf_view(uuid) from public,anon,authenticated;

-- Search RPC only returns public/active content, caps result count, and treats input as plain text.
-- Drop first so an older function with the same SQL types but different argument names
-- cannot make CREATE OR REPLACE fail (PostgREST resolves RPC arguments by name).
drop function if exists public.global_search(text,text);
create or replace function public.global_search(p_query text,p_kind text default 'all')
returns table(kind text,id text,title text,excerpt text,href text,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
declare q text:=left(btrim(coalesce(p_query,'')),100); pat text;
begin
 if char_length(q)<2 then return; end if; pat:='%'||replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_')||'%';
 return query
 (select 'profile',p.id::text,p.full_name,coalesce(p.bio,''),'/u/'||p.id::text,p.created_at from public.profiles p where (p.full_name ilike pat or coalesce(p.username,'') ilike pat) and (p_kind in ('all','profiles','teachers','verified') and (p_kind not in ('teachers','verified') or p.account_type='teacher') and (p_kind<>'verified' or p.is_verified)) order by p.is_verified desc,p.full_name limit 10)
 union all
 (select 'book',b.id::text,b.title,coalesce(b.description,''),'/books',b.created_at from public.books b where b.status='active' and (b.title ilike pat or coalesce(b.description,'') ilike pat) and p_kind in ('all','books') order by b.created_at desc limit 10)
 union all
 (select 'pdf',d.id::text,d.title,coalesce(d.description,''),'/pdfs',d.created_at from public.pdfs d where d.status='active' and (d.title ilike pat or coalesce(d.description,'') ilike pat or d.subject ilike pat) and p_kind in ('all','pdfs') order by d.created_at desc limit 10)
 union all
 (select 'forum',t.id::text,t.title,t.excerpt,'/forum/'||t.id::text,t.created_at from public.forum_topics t where t.status='active' and (t.title ilike pat or t.body ilike pat) and p_kind in ('all','forum') order by t.last_activity_at desc limit 10)
 union all
 (select 'forum_reply',r.id::text,left(r.body,100),r.body,'/forum/'||r.topic_id::text||'#reply-'||r.id::text,r.created_at from public.forum_replies r join public.forum_topics t on t.id=r.topic_id where r.status='active' and t.status='active' and r.body ilike pat and p_kind in ('all','forum') order by r.created_at desc limit 10)
 union all
 (select 'feed',f.id::text,left(f.body,120),f.body,'/feed?post='||f.id::text,f.created_at from public.feed_posts f where f.status='active' and f.body ilike pat and p_kind in ('all','feed') order by f.created_at desc limit 10)
 order by 6 desc limit 40;
end; $$;
revoke all on function public.global_search(text,text) from public;
grant execute on function public.global_search(text,text) to anon,authenticated;

notify pgrst, 'reload schema';
commit;
