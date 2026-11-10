-- Repair the V6 REST objects after 09/10 have been applied.
-- Safe to re-run. If the prerequisite tables are missing, apply 09 then 10 first.
begin;

do $$
begin
 if to_regclass('public.feed_posts') is null then
  raise exception 'public.feed_posts yoxdur. Əvvəl 09_social_trust_views.sql, sonra 10_workflows_and_quiz_security.sql miqrasiyalarını tətbiq edin.';
 end if;
 if to_regclass('public.feed_comments') is null or to_regclass('public.feed_likes') is null
    or to_regclass('public.teacher_reviews') is null or to_regclass('public.verification_requests') is null
    or to_regclass('public.content_views') is null or to_regclass('public.saved_content') is null then
  raise exception 'V6 cədvəlləri natamamdır. Əvvəl 09 və 10 miqrasiyalarını ardıcıllıqla tətbiq edin.';
 end if;
end;
$$;

-- PostgreSQL identifies this function by (text,text), so argument renames alone
-- cannot be deployed with CREATE OR REPLACE. PostgREST needs these exact names.
drop function if exists public.global_search(text,text);
create function public.global_search(p_query text,p_kind text default 'all')
returns table(kind text,id text,title text,excerpt text,href text,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
declare q text:=left(btrim(coalesce(p_query,'')),100); pat text;
begin
 if char_length(q)<2 then return; end if;
 pat:='%'||replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_')||'%';
 return query
 (select 'profile',p.id::text,p.full_name,coalesce(p.bio,''),'/u/'||p.id::text,p.created_at
  from public.profiles p
  where (p.full_name ilike pat or coalesce(p.username,'') ilike pat)
    and p_kind in ('all','profiles','teachers','verified')
    and (p_kind not in ('teachers','verified') or p.account_type='teacher')
    and (p_kind<>'verified' or p.is_verified)
  order by p.is_verified desc,p.full_name limit 10)
 union all
 (select 'book',b.id::text,b.title,coalesce(b.description,''),'/books',b.created_at
  from public.books b where b.status='active' and (b.title ilike pat or coalesce(b.description,'') ilike pat)
    and p_kind in ('all','books') order by b.created_at desc limit 10)
 union all
 (select 'pdf',d.id::text,d.title,coalesce(d.description,''),'/pdfs',d.created_at
  from public.pdfs d where d.status='active' and (d.title ilike pat or coalesce(d.description,'') ilike pat or d.subject ilike pat)
    and p_kind in ('all','pdfs') order by d.created_at desc limit 10)
 union all
 (select 'forum',t.id::text,t.title,t.excerpt,'/forum/'||t.id::text,t.created_at
  from public.forum_topics t where t.status='active' and (t.title ilike pat or t.body ilike pat)
    and p_kind in ('all','forum') order by t.last_activity_at desc limit 10)
 union all
 (select 'forum_reply',r.id::text,left(r.body,100),r.body,'/forum/'||r.topic_id::text||'#reply-'||r.id::text,r.created_at
  from public.forum_replies r join public.forum_topics t on t.id=r.topic_id
  where r.status='active' and t.status='active' and r.body ilike pat and p_kind in ('all','forum')
  order by r.created_at desc limit 10)
 union all
 (select 'feed',f.id::text,left(f.body,120),f.body,'/feed?post='||f.id::text,f.created_at
  from public.feed_posts f where f.status='active' and f.body ilike pat and p_kind in ('all','feed')
  order by f.created_at desc limit 10)
 order by 6 desc limit 40;
end;
$$;

revoke all on function public.global_search(text,text) from public;
grant execute on function public.global_search(text,text) to anon,authenticated;

-- DDL reload notifications are transactional and delivered after commit.
notify pgrst, 'reload schema';
commit;
