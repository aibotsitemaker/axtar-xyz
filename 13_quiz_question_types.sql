-- V6.4: typed quiz questions, weighted scoring and teacher-owned quiz creation.
-- Additive and safe for existing quiz data, sessions and attempts.
begin;

alter table public.quiz_questions
  add column if not exists question_type text not null default 'single',
  add column if not exists correct_answers jsonb,
  add column if not exists accepted_answers jsonb not null default '[]'::jsonb,
  add column if not exists correct_numeric numeric,
  add column if not exists numeric_tolerance numeric not null default 0,
  add column if not exists points numeric(8,2) not null default 1;

update public.quiz_questions
 set correct_answers=case when correct_answers is null then jsonb_build_array(correct_index) else correct_answers end
 where correct_answers is null;
alter table public.quiz_questions alter column correct_answers set default '[]'::jsonb;
alter table public.quiz_questions alter column correct_answers set not null;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.quiz_questions'::regclass and conname='quiz_questions_type_check') then
  alter table public.quiz_questions add constraint quiz_questions_type_check check(question_type in ('single','multiple','boolean','text','numeric'));
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.quiz_questions'::regclass and conname='quiz_questions_points_check') then
  alter table public.quiz_questions add constraint quiz_questions_points_check check(points>0 and points<=100);
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.quiz_questions'::regclass and conname='quiz_questions_tolerance_check') then
  alter table public.quiz_questions add constraint quiz_questions_tolerance_check check(numeric_tolerance>=0 and numeric_tolerance<=1000000);
 end if;
end $$;

-- Keep the answer key private from PostgREST; only the server-side SECURITY DEFINER RPCs read it.
revoke select on public.quiz_questions from anon,authenticated;
grant select(id,quiz_id,position,question_text,options,question_type,points) on public.quiz_questions to anon,authenticated;

drop policy if exists quizzes_teacher_read_own on public.quizzes;
create policy quizzes_teacher_read_own on public.quizzes for select to authenticated
 using(created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_type='teacher'));
drop policy if exists quiz_questions_teacher_read_own on public.quiz_questions;
create policy quiz_questions_teacher_read_own on public.quiz_questions for select to authenticated
 using(exists(select 1 from public.quizzes q join public.profiles p on p.id=q.created_by where q.id=quiz_id and q.created_by=auth.uid() and p.account_type='teacher'));

create or replace function public.save_quiz_session_answer_v2(p_session_id uuid,p_question_id uuid,p_answer jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); v public.quiz_sessions%rowtype; q public.quiz_questions%rowtype; n integer;
begin
 if me is null then raise exception 'Giriş tələb olunur'; end if;
 select * into v from public.quiz_sessions where id=p_session_id and user_id=me for update;
 if not found or v.status<>'active' or v.ends_at<=now() then raise exception 'Sınaq bitib və ya tapılmadı'; end if;
 select * into q from public.quiz_questions where id=p_question_id and quiz_id=v.quiz_id;
 if not found then raise exception 'Sual bu sınağa aid deyil'; end if;
 if p_answer is null or p_answer='null'::jsonb then
  update public.quiz_sessions set answers=answers-p_question_id::text where id=v.id returning answers into v.answers;
  return v.answers;
 end if;
 if q.question_type in ('single','boolean') then
  if jsonb_typeof(p_answer)<>'number' or p_answer::text !~ '^\d+$' or (p_answer::text)::integer<0 or (p_answer::text)::integer>=jsonb_array_length(q.options) then raise exception 'Cavab variantı yanlışdır'; end if;
 elsif q.question_type='multiple' then
  if jsonb_typeof(p_answer)<>'array' or jsonb_array_length(p_answer)<1 or jsonb_array_length(p_answer)>jsonb_array_length(q.options)
   or exists(select 1 from jsonb_array_elements(p_answer) x where jsonb_typeof(x)<>'number' or x::text !~ '^\d+$' or (x::text)::integer<0 or (x::text)::integer>=jsonb_array_length(q.options))
   or (select count(distinct x::text) from jsonb_array_elements(p_answer) x)<>jsonb_array_length(p_answer) then raise exception 'Çoxseçimli cavab yanlışdır'; end if;
 elsif q.question_type='text' then
  if jsonb_typeof(p_answer)<>'string' or char_length(btrim(p_answer #>> '{}'))>1000 then raise exception 'Mətn cavabı yanlışdır'; end if;
 elsif q.question_type='numeric' then
  if jsonb_typeof(p_answer)<>'number' or abs((p_answer::text)::numeric)>1000000000000 then raise exception 'Rəqəm cavabı yanlışdır'; end if;
 end if;
 update public.quiz_sessions set answers=jsonb_set(answers,array[p_question_id::text],p_answer,true) where id=v.id returning answers into v.answers;
 return v.answers;
end; $$;
revoke all on function public.save_quiz_session_answer_v2(uuid,uuid,jsonb) from public,anon;
grant execute on function public.save_quiz_session_answer_v2(uuid,uuid,jsonb) to authenticated;

create or replace function public.quiz_question_answer_correct(p_question_id uuid,p_answer jsonb)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare q public.quiz_questions%rowtype;
begin
 select * into q from public.quiz_questions where id=p_question_id;
 if not found or p_answer is null then return false; end if;
 if q.question_type in ('single','boolean') then return p_answer=q.correct_answers->0;
 elsif q.question_type='multiple' then
  return (select coalesce(array_agg(x::text order by x::text),array[]::text[]) from jsonb_array_elements(p_answer) x)=
         (select coalesce(array_agg(x::text order by x::text),array[]::text[]) from jsonb_array_elements(q.correct_answers) x);
 elsif q.question_type='text' then
  return exists(select 1 from jsonb_array_elements_text(q.accepted_answers) a where lower(translate(regexp_replace(btrim(a),'\s+',' ','g'),'İIı','iii'))=lower(translate(regexp_replace(btrim(p_answer #>> '{}'),'\s+',' ','g'),'İIı','iii')));
 elsif q.question_type='numeric' then
  return q.correct_numeric is not null and abs((p_answer::text)::numeric-q.correct_numeric)<=q.numeric_tolerance;
 end if;
 return false;
end; $$;
revoke all on function public.quiz_question_answer_correct(uuid,jsonb) from public,anon,authenticated;

create or replace function public.finish_quiz_session_v2(p_session_id uuid)
returns table(r_correct integer,r_total integer,r_percent numeric,r_earned_points numeric,r_max_points numeric,r_attempt_id uuid)
language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); v public.quiz_sessions%rowtype; q record; total integer:=0; ok integer:=0; pct numeric:=0; earned numeric:=0; maximum numeric:=0; ans jsonb; match_ok boolean; secs integer; aid uuid;
begin
 if me is null then raise exception 'Giriş tələb olunur'; end if;
 select * into v from public.quiz_sessions where id=p_session_id and user_id=me for update;
 if not found then raise exception 'Sınaq cəhdi tapılmadı'; end if;
 if v.status='completed' or v.status='expired' and v.attempt_id is not null then
  select coalesce(sum(case when a.value->>'correct'='true' then (a.value->>'points')::numeric else 0 end),0),coalesce(sum((a.value->>'points')::numeric),0)
   into earned,maximum from public.quiz_attempts x cross join lateral jsonb_array_elements(x.answers) a where x.id=v.attempt_id;
  return query select v.correct_count,v.total_questions,v.score_percent,earned,maximum,v.attempt_id; return;
 end if;
 for q in select * from public.quiz_questions where quiz_id=v.quiz_id order by position loop
  total:=total+1; maximum:=maximum+q.points; ans:=v.answers->q.id::text; match_ok:=false;
  if ans is not null then match_ok:=public.quiz_question_answer_correct(q.id,ans); end if;
  if match_ok then ok:=ok+1; earned:=earned+q.points; end if;
 end loop;
 pct:=case when maximum=0 then 0 else round(earned*100/maximum,2) end;
 secs:=least(greatest(floor(extract(epoch from (least(now(),v.ends_at)-v.started_at)))::integer,0),floor(extract(epoch from (v.ends_at-v.started_at)))::integer);
 insert into public.quiz_attempts(quiz_id,user_id,correct_count,total_questions,score_percent,seconds_used,answers,submission_key)
 values(v.quiz_id,me,ok,total,pct,secs,(select coalesce(jsonb_agg(jsonb_build_object('q',qq.id,'picked',v.answers->qq.id::text,'correct',public.quiz_question_answer_correct(qq.id,v.answers->qq.id::text),'points',qq.points)),'[]'::jsonb) from public.quiz_questions qq where qq.quiz_id=v.quiz_id),v.id)
 on conflict(user_id,submission_key) where submission_key is not null do nothing returning id into aid;
 if aid is null then select id into aid from public.quiz_attempts where user_id=me and submission_key=v.id; end if;
 -- Store weighted score. Existing attempt history fields and RPC response shape remain intact.
 update public.quiz_sessions set status=case when now()>ends_at then 'expired' else 'completed' end,correct_count=ok,total_questions=total,score_percent=pct,attempt_id=aid where id=v.id;
 -- Correctness/points belong in the immutable attempt payload for idempotent response.
 update public.quiz_attempts x set answers=coalesce((select jsonb_agg(jsonb_build_object('q',qq.id,'picked',v.answers->qq.id::text,'correct',
  public.quiz_question_answer_correct(qq.id,v.answers->qq.id::text),'points',qq.points)) from public.quiz_questions qq where qq.quiz_id=v.quiz_id),'[]'::jsonb) where x.id=aid;
 return query select ok,total,pct,earned,maximum,aid;
end; $$;
revoke all on function public.finish_quiz_session_v2(uuid) from public,anon;
grant execute on function public.finish_quiz_session_v2(uuid) to authenticated;

create or replace function public.quiz_session_review_v2(p_session_id uuid)
returns table(question_id uuid,question_order integer,question_text text,options jsonb,question_type text,picked_answer jsonb,correct_answers jsonb,explanation text,is_correct boolean,points numeric)
language plpgsql stable security definer set search_path=public as $$
declare me uuid:=auth.uid(); v public.quiz_sessions%rowtype;
begin
 if me is null then raise exception 'Giriş tələb olunur'; end if;
 select * into v from public.quiz_sessions where id=p_session_id and user_id=me;
 if not found then raise exception 'Sınaq sessiyası tapılmadı'; end if;
 if v.status not in ('completed','expired') or v.attempt_id is null then raise exception 'Təhlil yalnız təhvil verdikdən sonra açılır'; end if;
 return query select q.id,q.position,q.question_text,q.options,q.question_type,v.answers->q.id::text,
  case when q.question_type='text' then q.accepted_answers when q.question_type='numeric' then jsonb_build_array(q.correct_numeric::text) else q.correct_answers end,q.explanation,
  exists(select 1 from jsonb_array_elements((select x.answers from public.quiz_attempts x where x.id=v.attempt_id)) a where a->>'q'=q.id::text and a->>'correct'='true'),q.points
  from public.quiz_questions q where q.quiz_id=v.quiz_id order by q.position;
end; $$;
revoke all on function public.quiz_session_review_v2(uuid) from public,anon;
grant execute on function public.quiz_session_review_v2(uuid) to authenticated;

create or replace function public.teacher_create_quiz(p_title text,p_description text,p_category text,p_duration integer,p_questions jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); qz uuid; q jsonb; i integer:=0; opts jsonb; typ text; ca jsonb; ttl text:=btrim(coalesce(p_title,''));
begin
 if me is null or (not public.is_admin() and not exists(select 1 from public.profiles where id=me and account_type='teacher')) then raise exception 'Yalnız müəllim və admin sınaq yarada bilər' using errcode='42501'; end if;
 if char_length(ttl) not between 3 and 150 or p_category not in ('DİM','Magistr','IELTS','Universitet','Digər') or p_duration not between 30 and 14400 then raise exception 'Sınaq məlumatları yanlışdır' using errcode='22023'; end if;
 if jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions) not between 1 and 50 then raise exception 'Sınaqda 1–50 sual olmalıdır' using errcode='22023'; end if;
 insert into public.quizzes(created_by,title,description,category,duration_seconds,is_published) values(me,ttl,nullif(left(btrim(coalesce(p_description,'')),500),''),p_category,p_duration,false) returning id into qz;
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
 perform public.audit_write('quiz.create','quiz',qz::text,left(ttl,80),jsonb_build_object('questions',i,'author',me));
 return qz;
end; $$;
revoke all on function public.teacher_create_quiz(text,text,text,integer,jsonb) from public,anon;
grant execute on function public.teacher_create_quiz(text,text,text,integer,jsonb) to authenticated;

create or replace function public.teacher_publish_quiz(p_quiz_id uuid,p_published boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists(select 1 from public.quizzes q where q.id=p_quiz_id and (q.created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_type='teacher') or public.is_admin())) then raise exception 'Bu sınağı idarə etmək icazəniz yoxdur' using errcode='42501'; end if;
 if p_published and not exists(select 1 from public.quiz_questions where quiz_id=p_quiz_id) then raise exception 'Sualı olmayan sınaq dərc edilə bilməz'; end if;
 update public.quizzes set is_published=p_published where id=p_quiz_id;
 perform public.audit_write(case when p_published then 'quiz.publish' else 'quiz.unpublish' end,'quiz',p_quiz_id::text,null,'{}'::jsonb);
end; $$;
revoke all on function public.teacher_publish_quiz(uuid,boolean) from public,anon;
grant execute on function public.teacher_publish_quiz(uuid,boolean) to authenticated;

notify pgrst,'reload schema';
commit;
