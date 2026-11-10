'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../components/AuthProvider';
import { Alert, PageHeader } from '../../../components/ui';

const roleLabel = { teacher: 'Müəllim', student: 'Şagird', university_student: 'Tələbə' };

export default function TopicPage() {
  const { id } = useParams(); const router = useRouter(); const { user, loading } = useAuth();
  const [topic, setTopic] = useState(null); const [replies, setReplies] = useState([]); const [authors, setAuthors] = useState({}); const [categories, setCategories] = useState([]); const [attachments, setAttachments] = useState([]);
  const [reply, setReply] = useState(''); const [replyParentId, setReplyParentId] = useState(''); const [editId, setEditId] = useState(''); const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState({ type: '', text: '' }); const [editingTopic, setEditingTopic] = useState(false); const [editTitle, setEditTitle] = useState(''); const [editBody, setEditBody] = useState(''); const [editCategory, setEditCategory] = useState(''); const [adminState, setAdminState] = useState({ id: null, value: false });
  const isAdmin = adminState.id === user?.id && adminState.value;
  const load = useCallback(async () => {
    const [t, r, c, a] = await Promise.all([
      supabase.from('forum_topics').select('id,author_id,category_id,title,body,is_pinned,is_locked,created_at,updated_at,forum_categories(name)').eq('id', id).maybeSingle(),
      supabase.from('forum_replies').select('id,topic_id,author_id,parent_id,body,created_at,updated_at').eq('topic_id', id).is('deleted_at', null).order('created_at'),
      supabase.from('forum_categories').select('id,name').eq('is_active', true).order('name'),
      supabase.from('forum_attachments').select('id,storage_path,file_name,mime_type,size_bytes').eq('topic_id', id).order('created_at')
    ]);
    if (t.error || !t.data) { setTopic(null); setNotice({ type: 'error', text: 'Mövzu tapılmadı və ya yüklənmədi.' }); return; }
    const topicData = t.data; setTopic(topicData); setReplies(r.data || []); setCategories(c.data || []);
    const signedFiles = await Promise.all((a.data || []).map(async (file) => {
      const { data: signed } = await supabase.storage.from('tehsilhub-forum-files').createSignedUrl(file.storage_path, 3600);
      return { ...file, download_url: signed?.signedUrl || '' };
    }));
    setAttachments(signedFiles);
    setEditTitle(topicData.title); setEditBody(topicData.body); setEditCategory(String(topicData.category_id));
    const ids = [...new Set([topicData.author_id, ...(r.data || []).map((x) => x.author_id)].filter(Boolean))];
    const p = await supabase.from('profiles').select('id,full_name,user_type').in('id', ids);
    setAuthors(Object.fromEntries((p.data || []).map((x) => [x.id, x])));
  }, [id]);
  useEffect(() => { const timer = setTimeout(() => load(), 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { if (!user) return undefined; let alive = true; supabase.rpc('is_admin').then(({ data }) => { if (alive) setAdminState({ id: user.id, value: data === true }); }); return () => { alive = false; }; }, [user]);
  useEffect(() => {
    const channel = supabase.channel(`forum-topic-${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'forum_replies', filter: `topic_id=eq.${id}` }, () => load()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, load]);

  async function send(e) {
    e.preventDefault(); if (!user) { router.push('/auth'); return; }
    if (busy) return; setBusy(true); setNotice({ type: '', text: '' });
    const { error } = await supabase.from('forum_replies').insert({ topic_id: id, author_id: user.id, parent_id: replyParentId || null, body: reply.trim() });
    setBusy(false);
    if (error) setNotice({ type: 'error', text: error.message || 'Cavab göndərilmədi.' });
    else { setReply(''); setReplyParentId(''); setNotice({ type: 'success', text: 'Cavab əlavə edildi.' }); await load(); }
  }
  async function saveEdit(replyId) {
    const { error } = await supabase.from('forum_replies').update({ body: editText.trim() }).eq('id', replyId);
    setNotice(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Cavab yeniləndi.' }); setEditId(''); if (!error) load();
  }
  async function removeReply(replyId) {
    if (!confirm('Cavab gizlədilsin?')) return;
    const { error } = await supabase.from('forum_replies').update({ deleted_at: new Date().toISOString() }).eq('id', replyId);
    setNotice(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Cavab gizlədildi.' }); if (!error) load();
  }
  async function removeTopic() {
    if (!confirm('Mövzu silinsin? Müzakirə yumşaq silinəcək və admin bərpa edə bilər.')) return;
    const { error } = await supabase.from('forum_topics').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) setNotice({ type: 'error', text: error.message }); else router.push('/forum');
  }
  async function saveTopic(e) {
    e.preventDefault(); const { error } = await supabase.from('forum_topics').update({ title: editTitle.trim(), body: editBody.trim(), category_id: Number(editCategory) }).eq('id', id);
    if (error) setNotice({ type: 'error', text: error.message }); else { setEditingTopic(false); setNotice({ type: 'success', text: 'Mövzu yeniləndi.' }); load(); }
  }
  async function report(kind, targetId) {
    if (!user) { router.push('/auth'); return; }
    const reason = window.prompt('Şikayətin səbəbini yazın (5–1000 simvol):'); if (!reason) return;
    const values = { reporter_id: user.id, reason: reason.trim(), ...(kind === 'topic' ? { topic_id: targetId } : { reply_id: targetId }) };
    const { error } = await supabase.from('forum_reports').insert(values);
    setNotice(error ? { type: 'error', text: error.message } : { type: 'success', text: 'Şikayət adminə göndərildi.' });
  }

  if (loading || !topic && !notice.text) return <div className="skeleton h-64" aria-busy="true" />;
  if (!topic) return <div><Link href="/forum" className="text-primary">← Foruma qayıt</Link>{notice.text && <Alert type="error" className="mt-4">{notice.text}</Alert>}</div>;
  const topicAuthor = authors[topic.author_id];
  return <div>
    <Link href="/forum" className="text-sm font-medium text-primary hover:underline">← Foruma qayıt</Link>
    <PageHeader title={topic.title} subtitle={`${topic.forum_categories?.name || 'Müzakirə'} · ${new Date(topic.created_at).toLocaleString('az-AZ')}`} />
    {notice.text && <Alert type={notice.type} className="mt-4">{notice.text}</Alert>}
    <article className="card mt-5 p-5 sm:p-7"><div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="font-semibold">{topicAuthor?.full_name || 'İstifadəçi'} {topicAuthor?.user_type && <span className="ml-2 rounded-full bg-primary-soft px-2 py-1 text-xs text-primary">{roleLabel[topicAuthor.user_type]}</span>}</span>
      {user && <div className="flex gap-2"><button className="btn btn-secondary btn-sm" onClick={() => report('topic', topic.id)}>Şikayət et</button>{user.id === topic.author_id && <button className="btn btn-secondary btn-sm" onClick={() => setEditingTopic(!editingTopic)}>Redaktə</button>}{(user.id === topic.author_id || isAdmin) && <button className="btn btn-danger btn-sm" onClick={removeTopic}>Sil</button>}</div>}
    </div><p className="whitespace-pre-wrap break-words text-sm leading-7">{topic.body}</p>{attachments.length > 0 && <div className="mt-5 border-t border-line pt-4"><h2 className="mb-2 text-sm font-semibold">Əlavələr ({attachments.length})</h2><ul className="space-y-2">{attachments.map((file) => <li key={file.id} className="flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-2 text-sm"><a href={file.download_url || undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!file.download_url} className="min-w-0 truncate font-medium text-primary hover:underline">{file.file_name}</a><span className="shrink-0 text-xs text-muted">{file.mime_type === 'application/pdf' ? 'PDF' : 'Şəkil'} · {Math.max(1, Math.ceil(file.size_bytes / 1024))} KB</span></li>)}</ul></div>}</article>
    {editingTopic && user?.id === topic.author_id && <form onSubmit={saveTopic} className="card mt-3 space-y-3 p-4"><label className="block"><span className="label">Başlıq</span><input className="input" minLength={8} maxLength={160} required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></label><label className="block"><span className="label">Kateqoriya</span><select className="input" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="block"><span className="label">Mətn</span><textarea className="input min-h-32" minLength={10} maxLength={12000} required value={editBody} onChange={(e) => setEditBody(e.target.value)} /></label><button className="btn btn-primary">Dəyişiklikləri yadda saxla</button></form>}
    <div className="mt-7"><h2 className="text-xl font-bold">Cavablar <span className="text-sm font-medium text-muted">({replies.length})</span></h2>
      <div className="mt-4 space-y-3">{!replies.length && <div className="card p-6 text-center text-sm text-muted">Hələ cavab yoxdur.</div>}
        {replies.map((r) => { const author = authors[r.author_id]; const mine = user?.id === r.author_id; return <article key={r.id} className={`card p-4 sm:p-5 ${r.parent_id ? 'ml-5 border-l-4 border-l-primary/30 sm:ml-10' : ''}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><strong>{author?.full_name || 'İstifadəçi'}</strong>{author?.user_type && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">{roleLabel[author.user_type]}</span>}<time className="text-xs text-muted">{new Date(r.created_at).toLocaleString('az-AZ')}</time>
            <div className="ml-auto flex gap-2">{user && !r.parent_id && !topic.is_locked && <button className="text-xs text-primary" onClick={() => { setReplyParentId(r.id); document.getElementById('forum-reply-input')?.focus(); }}>Cavab yaz</button>}{user && <button className="text-xs text-muted hover:text-primary" onClick={() => report('reply', r.id)}>Şikayət</button>}{mine && <><button className="text-xs text-primary" onClick={() => { setEditId(r.id); setEditText(r.body); }}>Redaktə</button><button className="text-xs text-danger" onClick={() => removeReply(r.id)}>Sil</button></>}</div>
          </div>
          {editId === r.id ? <div className="space-y-2"><textarea className="input min-h-24" maxLength={6000} value={editText} onChange={(e) => setEditText(e.target.value)} /><div className="flex gap-2"><button className="btn btn-primary btn-sm" onClick={() => saveEdit(r.id)}>Yadda saxla</button><button className="btn btn-secondary btn-sm" onClick={() => setEditId('')}>Ləğv et</button></div></div> : <p className="whitespace-pre-wrap break-words text-sm leading-6">{r.body}</p>}
        </article>; })}
      </div>
    </div>
    <form onSubmit={send} className="card mt-5 space-y-3 p-4 sm:p-5">{replyParentId && <div className="flex items-center justify-between text-xs text-muted"><span>Cavaba cavab yazırsınız.</span><button type="button" className="text-primary" onClick={() => setReplyParentId('')}>Əsas mövzuya cavab yaz</button></div>}<label className="block"><span className="label">Cavabınız</span><textarea id="forum-reply-input" className="input min-h-28" required minLength={1} maxLength={6000} value={reply} onChange={(e) => setReply(e.target.value)} disabled={topic.is_locked} placeholder={topic.is_locked ? 'Bu mövzu bağlanıb.' : 'Fikrinizi yazın…'} /></label>
      {topic.is_locked ? <p className="text-sm text-muted">Mövzu admin tərəfindən bağlanıb.</p> : <button className="btn btn-primary" disabled={busy}>{busy ? 'Göndərilir…' : user ? 'Cavabı göndər' : 'Daxil olub cavab yaz'}</button>}
    </form>
  </div>;
}
