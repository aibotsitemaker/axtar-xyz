-- V6.8 additive profile media, quiz approval and verified account workflows.
begin;

alter table public.profiles add column if not exists cover_url text;
grant select (cover_url) on public.profiles to anon, authenticated;
grant update (cover_url) on public.profiles to authenticated;

-- Cover uploads are public profile media, but only the owning account may write its folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-covers','profile-covers',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists profile_covers_read on storage.objects;
create policy profile_covers_read on storage.objects for select using(bucket_id='profile-covers');
drop policy if exists profile_covers_insert on storage.objects;
create policy profile_covers_insert on storage.objects for insert to authenticated with check(bucket_id='profile-covers' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists profile_covers_delete on storage.objects;
create policy profile_covers_delete on storage.objects for delete to authenticated using(bucket_id='profile-covers' and (storage.foldername(name))[1]=auth.uid()::text);

-- Preserve all legacy published quizzes; new teacher quizzes are created unpublished and pending.
alter table public.quizzes add column if not exists approval_status text;
alter table public.quizzes drop constraint if exists quizzes_approval_status_check;
alter table public.quizzes add constraint quizzes_approval_status_check check(approval_status in ('draft','pending','published','rejected'));
update public.quizzes set approval_status=case when is_published then 'published' else 'draft' end where approval_status is null;
alter table public.quizzes alter column approval_status set default 'published';
alter table public.quizzes alter column approval_status set not null;
-- Row policies limit this to published quizzes, a teacher's own rows, or admins.
grant select on public.quizzes to anon, authenticated;

create or replace function public.teacher_create_quiz(p_title text,p_description text,p_category text,p_duration integer,p_questions jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); qz uuid; q jsonb; i integer:=0; opts jsonb; typ text; ca jsonb; ttl text:=btrim(coalesce(p_title,''));
begin
 if me is null or (not public.is_admin() and not exists(select 1 from public.profiles where id=me and account_type='teacher')) then raise exception 'Yalnız müəllim və admin sınaq yarada bilər' using errcode='42501'; end if;
 if char_length(ttl) not between 3 and 150 or p_category not in ('DİM','Magistr','IELTS','Universitet','Digər') or p_duration not between 30 and 14400 then raise exception 'Sınaq məlumatları yanlışdır' using errcode='22023'; end if;
 if jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions) not between 1 and 50 then raise exception 'Sınaqda 1–50 sual olmalıdır' using errcode='22023'; end if;
 insert into public.quizzes(created_by,title,description,category,duration_seconds,is_published,approval_status) values(me,ttl,nullif(left(btrim(coalesce(p_description,'')),500),''),p_category,p_duration,false,case when public.is_admin() then 'draft' else 'pending' end) returning id into qz;
 for q in select * from jsonb_array_elements(p_questions) loop
  i:=i+1; typ:=coalesce(q->>'type','single'); opts:=coalesce(q->'options','[]'::jsonb); ca:=q->'correct_answers';
  if char_length(btrim(coalesce(q->>'text',''))) not between 3 and 500 or typ not in ('single','multiple','boolean','text','numeric') then raise exception 'Sual % məlumatları yanlışdır',i using errcode='22023'; end if;
  if typ in ('text','numeric') then opts:='[""," "]'::jsonb; end if;
  if typ in ('single','multiple','boolean') and (jsonb_typeof(opts)<>'array' or jsonb_array_length(opts) not between 2 and 6) then raise exception 'Sual % üçün 2–6 variant lazımdır',i using errcode='22023'; end if;
  if typ='boolean' then opts:='["Doğru","Yanlış"]'::jsonb; ca:=coalesce(ca,jsonb_build_array(coalesce((q->>'correct_index')::integer,0))); end if;
  if typ='single' then ca:=coalesce(ca,jsonb_build_array(coalesce((q->>'correct_index')::integer,0))); end if;
  if typ in ('single','boolean') and (jsonb_typeof(ca)<>'array' or jsonb_array_length(ca)<>1 or (ca->>0)::integer<0 or (ca->>0)::integer>=jsonb_array_length(opts)) then raise exception 'Sual % düzgün cavabı yanlışdır',i using errcode='22023'; end if;
  if typ='multiple' and (jsonb_typeof(ca)<>'array' or jsonb_array_length(ca)<1 or exists(select 1 from jsonb_array_elements(ca) x where jsonb_typeof(x)<>'number' or (x::text)::integer<0 or (x::text)::integer>=jsonb_array_length(opts))) then raise exception 'Sual % düzgün cavabları yanlışdır',i using errcode='22023'; end if;
  if typ='text' and (jsonb_typeof(coalesce(q->'accepted_answers',ca))<>'array' or jsonb_array_length(coalesce(q->'accepted_answers',ca))<1) then raise exception 'Sual % üçün qəbul edilən mətn cavabı verin',i using errcode='22023'; end if;
  if typ='numeric' and (q->>'correct_numeric') is null then raise exception 'Sual % üçün rəqəm cavabı verin',i using errcode='22023'; end if;
  if typ='text' and exists(select 1 from jsonb_array_elements_text(q->'accepted_answers') a where char_length(btrim(a)) not between 1 and 1000) then raise exception 'Sual % üçün mətn cavabı 1–1000 simvol olmalıdır',i using errcode='22023'; end if;
  if coalesce(nullif(q->>'points','')::numeric,1)<=0 or coalesce(nullif(q->>'points','')::numeric,1)>100 then raise exception 'Sual % balı 0-dan böyük, ən çox 100 olmalıdır',i using errcode='22023'; end if;
  if typ in ('single','boolean','multiple') and exists(select 1 from jsonb_array_elements(opts) o where jsonb_typeof(o)<>'string' or char_length(btrim(o #>> '{}')) not between 1 and 300) then raise exception 'Sual % variantları yanlışdır',i using errcode='22023'; end if;
  insert into public.quiz_questions(quiz_id,position,question_text,options,correct_index,explanation,question_type,correct_answers,accepted_answers,correct_numeric,numeric_tolerance,points)
  values(qz,i,btrim(q->>'text'),opts,case when typ in ('single','boolean') then (ca->>0)::integer else 0 end,nullif(left(btrim(coalesce(q->>'explanation','')),500),''),typ,
   coalesce(ca,'[]'::jsonb),coalesce(q->'accepted_answers',q->'correct_answers','[]'::jsonb),nullif(q->>'correct_numeric','')::numeric,coalesce(nullif(q->>'numeric_tolerance','')::numeric,0),coalesce(nullif(q->>'points','')::numeric,1));
 end loop;
 perform public.audit_write('quiz.create','quiz',qz::text,left(ttl,80),jsonb_build_object('questions',i,'author',me,'status',case when public.is_admin() then 'draft' else 'pending' end));
 return qz;
end; $$;
revoke all on function public.teacher_create_quiz(text,text,text,integer,jsonb) from public,anon;
grant execute on function public.teacher_create_quiz(text,text,text,integer,jsonb) to authenticated;

create or replace function public.teacher_publish_quiz(p_quiz_id uuid,p_published boolean)
returns void language plpgsql security definer set search_path=public as $$
declare q public.quizzes%rowtype;
begin
 if auth.uid() is null then raise exception 'Giriş tələb olunur' using errcode='42501'; end if;
 select * into q from public.quizzes where id=p_quiz_id for update;
 if not found or not (q.created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_type='teacher') or public.is_admin()) then raise exception 'Bu sınağı idarə etmək icazəniz yoxdur' using errcode='42501'; end if;
 if public.is_admin() then
  if p_published and not exists(select 1 from public.quiz_questions where quiz_id=p_quiz_id) then raise exception 'Sualı olmayan sınaq dərc edilə bilməz'; end if;
  update public.quizzes set is_published=p_published,approval_status=case when p_published then 'published' else 'draft' end where id=p_quiz_id;
  perform public.audit_write(case when p_published then 'quiz.publish' else 'quiz.unpublish' end,'quiz',p_quiz_id::text,null,'{}'::jsonb);
 elsif not p_published then
  update public.quizzes set is_published=false,approval_status=case when approval_status='published' then 'draft' else approval_status end where id=p_quiz_id;
  perform public.audit_write('quiz.unpublish','quiz',p_quiz_id::text,null,'{}'::jsonb);
 else
  if q.approval_status='published' and q.is_published then raise exception 'Sınaq artıq dərc olunub'; end if;
  update public.quizzes set is_published=false,approval_status='pending' where id=p_quiz_id;
  perform public.audit_write('quiz.submit_for_approval','quiz',p_quiz_id::text,null,'{}'::jsonb);
 end if;
end; $$;
revoke all on function public.teacher_publish_quiz(uuid,boolean) from public,anon;
grant execute on function public.teacher_publish_quiz(uuid,boolean) to authenticated;

create or replace function public.admin_quiz_review(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 perform public.assert_admin();
 if p_status is not null and p_status not in ('pending','published','rejected','draft') then raise exception 'Status yanlışdır' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'title',q.title,'description',q.description,'category',q.category,'duration_seconds',q.duration_seconds,'created_by',q.created_by,'approval_status',q.approval_status,'created_at',q.created_at,'author_name',p.full_name,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'position',x.position,'question_text',x.question_text,'options',x.options,'question_type',x.question_type,'correct_index',x.correct_index,'correct_answers',x.correct_answers,'accepted_answers',x.accepted_answers,'correct_numeric',x.correct_numeric,'explanation',x.explanation,'points',x.points) order by x.position) from public.quiz_questions x where x.quiz_id=q.id),'[]'::jsonb)) order by q.created_at desc),'[]'::jsonb) into result
 from public.quizzes q left join public.profiles p on p.id=q.created_by where p_status is null or q.approval_status=p_status;
 return result;
end; $$;
revoke all on function public.admin_quiz_review(text) from public,anon;
grant execute on function public.admin_quiz_review(text) to authenticated;

create or replace function public.admin_decide_quiz(p_id uuid,p_status text,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare q public.quizzes%rowtype;
begin
 perform public.assert_admin();
 if p_status not in ('published','rejected','draft') then raise exception 'Qərar statusu yanlışdır' using errcode='22023'; end if;
 select * into q from public.quizzes where id=p_id for update;
 if not found then raise exception 'Sınaq tapılmadı' using errcode='P0002'; end if;
 if p_status='published' and not exists(select 1 from public.quiz_questions where quiz_id=p_id) then raise exception 'Sualı olmayan sınaq dərc edilə bilməz'; end if;
 update public.quizzes set approval_status=p_status,is_published=(p_status='published') where id=p_id;
 perform public.audit_write('quiz.moderation.'||p_status,'quiz',p_id::text,left(coalesce(p_note,''),120),jsonb_build_object('previous_status',q.approval_status,'owner',q.created_by));
end; $$;
revoke all on function public.admin_decide_quiz(uuid,text,text) from public,anon;
grant execute on function public.admin_decide_quiz(uuid,text,text) to authenticated;

create or replace function public.admin_delete_quiz(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare me uuid:=public.assert_admin(); ttl text;
begin
 select title into ttl from public.quizzes where id=p_id for update;
 if not found then raise exception 'Sınaq tapılmadı' using errcode='P0002'; end if;
 delete from public.quizzes where id=p_id;
 perform public.audit_write('quiz.delete','quiz',p_id::text,left(ttl,80),'{}'::jsonb);
end; $$;
revoke all on function public.admin_delete_quiz(uuid) from public,anon;
grant execute on function public.admin_delete_quiz(uuid) to authenticated;

-- Restrict decision rights to definer RPCs; applicants retain insert and own read.
revoke update on public.verification_requests from authenticated;
create or replace function public.admin_decide_verification(p_id uuid,p_status text,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare r public.verification_requests%rowtype;
begin
 perform public.assert_admin();
 if p_status not in ('approved','rejected','more_info','revoked') then raise exception 'Qərar statusu yanlışdır' using errcode='22023'; end if;
 select * into r from public.verification_requests where id=p_id for update;
 if not found then raise exception 'Müraciət tapılmadı' using errcode='P0002'; end if;
 update public.verification_requests set status=p_status,admin_note=nullif(left(btrim(coalesce(p_note,'')),1000),''),reviewed_by=auth.uid(),reviewed_at=now() where id=p_id;
 perform public.audit_write('verification.'||p_status,'profile',r.user_id::text,null,jsonb_build_object('request_id',p_id));
end; $$;
revoke all on function public.admin_decide_verification(uuid,text,text) from public,anon;
grant execute on function public.admin_decide_verification(uuid,text,text) to authenticated;

create or replace function public.admin_set_verified(p_user_id uuid,p_verified boolean,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 perform public.assert_admin();
 if p_user_id is null then raise exception 'İstifadəçi ID-si yanlışdır' using errcode='22023'; end if;
 update public.profiles set is_verified=p_verified where id=p_user_id;
 if not found then raise exception 'İstifadəçi tapılmadı' using errcode='P0002'; end if;
 perform public.audit_write(case when p_verified then 'verification.direct_grant' else 'verification.direct_revoke' end,'profile',p_user_id::text,left(coalesce(p_note,''),120),'{}'::jsonb);
end; $$;
revoke all on function public.admin_set_verified(uuid,boolean,text) from public,anon;
grant execute on function public.admin_set_verified(uuid,boolean,text) to authenticated;

-- Upload rate limiting uses the existing atomic 10-per-hour account limit.
notify pgrst,'reload schema';
commit;
