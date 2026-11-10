'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import { Alert, PageHeader, Spinner } from '../../components/ui';

function safeText(text) {
 return text.split(/(https?:\/\/[^\s]+)/g).map((part,i) => /^https?:\/\//i.test(part)
  ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{part}</a> : part);
}

export default function FeedPage() {
 const { user }=useAuth();
 const [posts,setPosts]=useState([]); const [body,setBody]=useState(''); const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [comments,setComments]=useState({});
 const load=useCallback(async()=>{
  setLoading(true);
  const {data,error:loadError}=await supabase.from('feed_posts').select('id,author_id,body,view_count,created_at,profiles:author_id(full_name,username,avatar_url,account_type,is_verified),feed_likes(user_id),feed_comments(id,author_id,parent_id,body,created_at,profiles:author_id(full_name,username))').eq('status','active').order('created_at',{ascending:false}).limit(40);
  setPosts(data||[]); setError(loadError?.message||''); setLoading(false);
 },[]);
 useEffect(()=>{load();},[load]);
 async function publish(e){e.preventDefault();setError('');setNotice('');if(!user){setError('Paylaşım etmək üçün hesabınıza daxil olun.');return;} if(!body.trim()||body.length>500)return;setBusy(true);const {error:e1}=await supabase.from('feed_posts').insert({author_id:user.id,body:body.trim()});setBusy(false);if(e1){setError(e1.message);return;}setBody('');setNotice('Paylaşım dərc edildi.');load();}
 async function toggleLike(post){if(!user){setError('Bəyənmək üçün daxil olun.');return;}const liked=post.feed_likes?.some(x=>x.user_id===user.id);const q=liked?supabase.from('feed_likes').delete().eq('post_id',post.id).eq('user_id',user.id):supabase.from('feed_likes').insert({post_id:post.id,user_id:user.id});const {error:e}=await q;if(e)setError(e.message);else load();}
 async function addComment(postId){if(!user){setError('Şərh yazmaq üçün daxil olun.');return;}const val=(comments[postId]||'').trim();if(!val)return;const {error:e}=await supabase.from('feed_comments').insert({post_id:postId,author_id:user.id,body:val});if(e)setError(e.message);else{setComments(x=>({...x,[postId]:''}));load();}}
 async function removePost(id){if(!confirm('Paylaşımı silmək istəyirsiniz?'))return;const {error:e}=await supabase.from('feed_posts').delete().eq('id',id).eq('author_id',user.id);if(e)setError(e.message);else load();}
 return <div className="mx-auto max-w-2xl"><PageHeader title="TəhsilHub Feed" subtitle="Təhsil icmasının qısa fikirləri və müzakirələri" />
  {error&&<Alert type="error" className="mb-4">{error}</Alert>}{notice&&<Alert type="success" className="mb-4">{notice}</Alert>}
  <form onSubmit={publish} className="card mb-5 p-4"><label htmlFor="feed-body" className="mb-2 block text-sm font-semibold">Nə barədə düşünürsünüz?</label><textarea id="feed-body" value={body} onChange={e=>setBody(e.target.value.slice(0,500))} rows={3} maxLength={500} className="field w-full resize-y" placeholder="Təhsil mövzusu ilə bağlı paylaşım yazın…"/><div className="mt-3 flex items-center justify-between"><span className="text-xs text-muted">{body.length}/500</span><button disabled={busy||!body.trim()} className="btn btn-primary">{busy?<Spinner/>:'Paylaş'}</button></div></form>
  <div className="space-y-4">{loading?<div className="card p-8 text-center"><Spinner/></div>:posts.length===0?<div className="card p-8 text-center text-muted">Hələ paylaşım yoxdur. İlk paylaşımı siz edin.</div>:posts.map(p=>{const author=p.profiles||{};const liked=p.feed_likes?.some(x=>x.user_id===user?.id);return <article key={p.id} className="card p-4 sm:p-5"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft font-bold text-primary">{author.avatar_url?<img src={author.avatar_url} alt="" className="h-full w-full object-cover"/>:(author.full_name||'İ')[0]}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2"><Link href={`/u/${p.author_id}`} className="font-semibold hover:text-primary">{author.full_name||'İstifadəçi'} {author.is_verified&&<span className="text-blue-500" title="TəhsilHub tərəfindən doğrulanıb">✓</span>}</Link><span className="text-xs text-muted">{author.username?`@${author.username} · `:''}{new Date(p.created_at).toLocaleString('az-AZ')}</span>{author.account_type&&<span className="badge">{author.account_type==='teacher'?'Müəllim':'Tələbə'}</span>}</div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{safeText(p.body)}</p><div className="mt-4 flex items-center gap-4 text-sm"><button onClick={()=>toggleLike(p)} className={liked?'font-semibold text-rose-600':'text-muted hover:text-rose-600'} aria-pressed={liked}>♥ {p.feed_likes?.length||0}</button><span className="text-xs text-muted">{p.feed_comments?.length||0} şərh · {p.view_count||0} baxış</span>{user?.id===p.author_id&&<button onClick={()=>removePost(p.id)} className="ml-auto text-xs text-muted hover:text-danger">Sil</button>}</div>
  {p.feed_comments?.length>0&&<div className="mt-3 space-y-2 border-l-2 border-line pl-3">{p.feed_comments.slice(0,5).map(c=><p key={c.id} className="text-sm"><Link href={`/u/${c.author_id}`} className="font-medium hover:text-primary">{c.profiles?.full_name||'İstifadəçi'}</Link> <span>{c.body}</span></p>)}</div>}
  <div className="mt-3 flex gap-2"><input value={comments[p.id]||''} onChange={e=>setComments(x=>({...x,[p.id]:e.target.value.slice(0,1000)}))} maxLength={1000} className="field min-w-0 flex-1" placeholder="Şərh yazın…" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addComment(p.id);}}}/><button className="btn btn-secondary btn-sm" onClick={()=>addComment(p.id)}>Göndər</button></div></div></div></article>;})}</div>
 </div>;
}
