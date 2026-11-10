'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../components/AuthProvider';
import Icon from '../../../components/Icons';
import AuthorLine from '../../../components/forum/AuthorLine';
import Linkify from '../../../components/forum/Linkify';
import ReportModal from '../../../components/forum/ReportModal';
import NoteDialog from '../../../components/forum/NoteDialog';
import CharCount from '../../../components/forum/CharCount';
import { Alert, ConfirmDialog, EmptyState, ListSkeleton, LoadMore, Spinner } from '../../../components/ui';
import { REPLY_PAGE, STATUS_LABEL, isUuid, loadCategories, loadProfiles } from '../../../lib/forum';
import { errText, fmtBlockUntil, fmtDateTime, timeAgo } from '../../../lib/format';
import { LoginPrompt } from '../../../components/AuthProvider';

const REPLY_COLS = 'id, parent_id, author_id, body, status, edited_at, created_at';
const BODY_MAX = 10000;
const REPLY_MAX = 5000;

function ReplyItem({ r, profile, nested, orphan, canReply, canEdit, canDelete, canReport, isAdmin, editing, onReply, onEdit, onDelete, onReport, onMod }) {
  const hidden = r.status !== 'active';
  return (
    <article id={`reply-${r.id}`} data-testid="reply" className={`rounded-xl border p-4 ${hidden ? 'border-warning/40 bg-warning-soft' : 'border-line bg-surface'} ${nested ? 'ml-4 sm:ml-8' : ''}`}>
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <AuthorLine id={r.author_id} profile={profile} avatar />
        <span>
          {fmtDateTime(r.created_at)}{r.edited_at ? ' · redaktə edilib' : ''}
        </span>
      </header>
      {orphan && <p className="mb-2 text-xs text-muted">Əvvəlki cavaba cavab (həmin cavab göstərilmir)</p>}
      {hidden && <p className="mb-2 text-xs font-semibold text-warning">{STATUS_LABEL[r.status]} — yalnız adminlərə görünür</p>}
      {editing}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {canReply && <button className="btn btn-ghost btn-sm" onClick={() => onReply(r)}><Icon name="reply" className="h-4 w-4" />Cavab ver</button>}
        {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => onEdit(r)}><Icon name="edit" className="h-4 w-4" />Redaktə</button>}
        {canDelete && <button className="btn btn-ghost btn-sm" onClick={() => onDelete(r)}><Icon name="trash" className="h-4 w-4" />Sil</button>}
        {canReport && <button className="btn btn-ghost btn-sm" onClick={() => onReport(r)}><Icon name="flag" className="h-4 w-4" />Şikayət et</button>}
        {isAdmin && r.status === 'active' && <button className="btn btn-ghost btn-sm" onClick={() => onMod(r, 'hide')}><Icon name="eyeOff" className="h-4 w-4" />Gizlət</button>}
        {isAdmin && r.status !== 'active' && <button className="btn btn-ghost btn-sm" onClick={() => onMod(r, 'restore')}><Icon name="rotate" className="h-4 w-4" />Bərpa et</button>}
      </div>
    </article>
  );
}

export default function TopicPage() {
  const params = useParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const id = isUuid(rawId) ? rawId : '';
  const router = useRouter();
  const { user, me, loading: authLoading } = useAuth();

  const [topic, setTopic] = useState(null);
  const [tState, setTState] = useState('loading'); // loading | ready | missing | error
  const [cats, setCats] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [replies, setReplies] = useState([]);
  const [repliesTotal, setRepliesTotal] = useState(0);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [repliesError, setRepliesError] = useState('');
  const [limit, setLimit] = useState(REPLY_PAGE);
  const [dir, setDir] = useState('asc');
  const [tick, setTick] = useState(0);
  const [flash, setFlash] = useState({ type: '', text: '' });

  // yazma vəziyyəti
  const [replyText, setReplyText] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { id, name }
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyErr, setReplyErr] = useState('');
  const sendLock = useRef(false);
  const composerRef = useRef(null);
  const composerInput = useRef(null);

  // redaktə
  const [editTopic, setEditTopic] = useState(false);
  const [tForm, setTForm] = useState({ title: '', body: '', category: '' });
  const [tBusy, setTBusy] = useState(false);
  const [tErr, setTErr] = useState('');
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState('');

  // təsdiq pəncərələri
  const [confirm, setConfirm] = useState(null); // { kind: 'topic'|'reply', id }
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmErr, setConfirmErr] = useState('');
  const [report, setReport] = useState(null);
  const [mod, setMod] = useState(null); // { scope, id, action }
  const [modBusy, setModBusy] = useState(false);
  const [modErr, setModErr] = useState('');

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    let stop = false;
    loadCategories().then((c) => { if (!stop) setCats(c); });
    return () => { stop = true; };
  }, []);

  // Mövzu
  useEffect(() => {
    if (!id) return undefined;
    let stop = false;
    supabase.from('forum_topics')
      .select('id, title, body, category_id, author_id, status, is_pinned, is_locked, reply_count, last_activity_at, created_at, edited_at')
      .eq('id', id).maybeSingle()
      .then(async ({ data, error }) => {
        if (stop) return;
        if (error) { setTState('error'); return; }
        if (!data) { setTopic(null); setTState('missing'); return; }
        setTopic(data);
        setTState('ready');
        document.title = `${data.title} | TəhsilHub`;
        const map = await loadProfiles([data.author_id]);
        if (!stop) setProfiles((p) => ({ ...p, ...map }));
      });
    return () => { stop = true; };
  }, [id, tick]);

  // Cavablar
  useEffect(() => {
    if (!id) return undefined;
    let stop = false;
    supabase.from('forum_replies').select(REPLY_COLS, { count: 'exact' })
      .eq('topic_id', id).order('created_at', { ascending: dir === 'asc' }).range(0, limit - 1)
      .then(async ({ data, count, error }) => {
        if (stop) return;
        if (error) { setRepliesError('Cavabları yükləmək mümkün olmadı.'); setRepliesLoaded(true); return; }
        setRepliesError('');
        setReplies(data || []);
        setRepliesTotal(count ?? (data || []).length);
        setRepliesLoaded(true);
        const map = await loadProfiles((data || []).map((x) => x.author_id));
        if (!stop) setProfiles((p) => ({ ...p, ...map }));
      });
    return () => { stop = true; };
  }, [id, tick, limit, dir]);

  // Realtime: yeni/dəyişən cavab gələndə səhifə yenilənir (RLS realtime-a da tətbiq olunur)
  useEffect(() => {
    if (!id) return undefined;
    let timer = null;
    const ch = supabase.channel(`forum-topic-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_replies', filter: `topic_id=eq.${id}` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => setTick((t) => t + 1), 400);
      })
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(ch); };
  }, [id]);

  const { roots, kids, known } = useMemo(() => {
    const ids = new Set(replies.map((r) => r.id));
    const kidsMap = {};
    const rootList = [];
    replies.forEach((r) => {
      if (r.parent_id && ids.has(r.parent_id)) (kidsMap[r.parent_id] = kidsMap[r.parent_id] || []).push(r);
      else rootList.push(r);
    });
    Object.values(kidsMap).forEach((list) => list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    return { roots: rootList, kids: kidsMap, known: ids };
  }, [replies]);

  if (!id) return <EmptyState icon="alert" title="Mövzu tapılmadı" text="Ünvan yanlışdır." action={<Link href="/forum" className="btn btn-primary">Foruma qayıt</Link>} />;
  if (tState === 'loading' || authLoading) return <div className="mx-auto max-w-3xl"><ListSkeleton count={3} /></div>;
  if (tState === 'error') return <Alert type="error">Mövzunu yükləmək mümkün olmadı. Səhifəni yeniləyin.</Alert>;
  if (tState === 'missing' || !topic) {
    return <EmptyState icon="alert" title="Mövzu tapılmadı" text="Mövzu silinib, gizlədilib və ya heç vaxt mövcud olmayıb." action={<Link href="/forum" className="btn btn-primary">Foruma qayıt</Link>} />;
  }

  const isAdmin = me.isAdmin;
  const blocked = !!me.blockedUntil;
  const isAuthor = !!user && topic.author_id === user.id;
  const topicActive = topic.status === 'active';
  const canWrite = !!user && topicActive && !topic.is_locked && !blocked;
  const cat = cats.find((c) => c.id === topic.category_id);
  const editableCats = cats.filter((c) => c.is_active || c.id === topic.category_id);
  const nextHref = `/forum/${id}`;

  function startEditTopic() {
    setTForm({ title: topic.title, body: topic.body, category: topic.category_id });
    setTErr('');
    setEditTopic(true);
  }

  async function saveTopic(e) {
    e.preventDefault();
    if (tBusy) return;
    setTBusy(true);
    setTErr('');
    const { error } = await supabase.rpc('forum_update_topic', { p_id: id, p_title: tForm.title.trim().replace(/\s+/g, ' '), p_body: tForm.body.trim(), p_category: tForm.category });
    setTBusy(false);
    if (error) { setTErr(errText(error)); return; }
    setEditTopic(false);
    setFlash({ type: 'success', text: 'Mövzu yeniləndi.' });
    refresh();
  }

  async function sendReply(e) {
    e.preventDefault();
    if (sendLock.current) return;
    const text = replyText.trim();
    if (!text) return;
    sendLock.current = true;
    setReplyBusy(true);
    setReplyErr('');
    const { error } = await supabase.rpc('forum_create_reply', { p_topic: id, p_body: text, p_parent: replyTo ? replyTo.id : null });
    setReplyBusy(false);
    sendLock.current = false;
    if (error) { setReplyErr(errText(error)); return; }
    setReplyText('');
    setReplyTo(null);
    setFlash({ type: 'success', text: 'Cavabınız göndərildi.' });
    refresh();
  }

  function startReply(r) {
    setReplyTo({ id: r.id, name: profiles[r.author_id]?.full_name || 'istifadəçi' });
    setReplyErr('');
    requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      composerInput.current?.focus();
    });
  }

  function startEditReply(r) { setEditId(r.id); setEditText(r.body); setEditErr(''); }

  async function saveReply(e) {
    e.preventDefault();
    if (editBusy || !editText.trim()) return;
    setEditBusy(true);
    setEditErr('');
    const { error } = await supabase.rpc('forum_update_reply', { p_id: editId, p_body: editText.trim() });
    setEditBusy(false);
    if (error) { setEditErr(errText(error)); return; }
    setEditId(null);
    refresh();
  }

  async function doDelete() {
    if (!confirm) return;
    setConfirmBusy(true);
    setConfirmErr('');
    const isTopic = confirm.kind === 'topic';
    const { error } = await supabase.rpc(isTopic ? 'forum_delete_topic' : 'forum_delete_reply', isTopic ? { p_id: confirm.id } : { p_id: confirm.id });
    setConfirmBusy(false);
    if (error) { setConfirmErr(errText(error)); return; }
    setConfirm(null);
    if (isTopic) { router.push('/forum'); return; }
    setFlash({ type: 'success', text: 'Cavab silindi.' });
    refresh();
  }

  async function doMod(note) {
    if (!mod) return;
    setModBusy(true);
    setModErr('');
    const fn = mod.scope === 'topic' ? 'admin_forum_topic_action' : 'admin_forum_reply_action';
    const { error } = await supabase.rpc(fn, { p_id: mod.id, p_action: mod.action, p_note: note || null });
    setModBusy(false);
    if (error) { setModErr(errText(error)); return; }
    setMod(null);
    setFlash({ type: 'success', text: 'Əməliyyat yerinə yetirildi.' });
    refresh();
  }

  const MOD_TEXT = {
    hide: ['Gizlət', 'Məzmun adi istifadəçilərə görünməyəcək. Sonra bərpa edə bilərsiniz.', true],
    delete: ['Sil', 'Məzmun silinmiş sayılır (yumşaq silinmə, tarixçə saxlanılır) və açıq şikayətlər həll olunur.', true],
    restore: ['Bərpa et', 'Məzmun yenidən hamıya görünəcək.', false],
    pin: ['Sabitlə', 'Mövzu siyahının başında görünəcək.', false],
    unpin: ['Sabiti götür', 'Mövzu adi sıraya qayıdacaq.', false],
    lock: ['Bağla', 'Yeni cavab yazmaq və redaktə mümkün olmayacaq.', false],
    unlock: ['Aç', 'Mövzu yenidən cavablara açılacaq.', false]
  };
  const modInfo = mod ? MOD_TEXT[mod.action] : null;

  function renderReply(r, nested, orphan) {
    const mine = !!user && r.author_id === user.id;
    const editing = editId === r.id;
    const canEdit = !editing && (isAdmin || (mine && r.status === 'active' && topicActive && !topic.is_locked)) && !blocked;
    return (
      <ReplyItem key={r.id} r={r} profile={profiles[r.author_id]} nested={nested} orphan={orphan}
        canReply={!nested && canWrite && r.status === 'active'}
        canEdit={canEdit && (isAdmin || !blocked)}
        canDelete={!editing && (isAdmin || mine) && r.status !== 'deleted'}
        canReport={!!user && !mine && r.status === 'active' && topicActive && !blocked}
        isAdmin={isAdmin}
        editing={editing ? (
          <form onSubmit={saveReply} className="space-y-2">
            <label htmlFor={`edit-${r.id}`} className="sr-only">Cavabı redaktə et</label>
            <textarea id={`edit-${r.id}`} rows={4} maxLength={REPLY_MAX} className="input" value={editText} onChange={(e) => setEditText(e.target.value)} />
            {editErr && <Alert type="error">{editErr}</Alert>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary btn-sm" disabled={editBusy} onClick={() => setEditId(null)}>Ləğv et</button>
              <button className="btn btn-primary btn-sm" disabled={editBusy || !editText.trim()}>{editBusy && <Spinner />}Yadda saxla</button>
            </div>
          </form>
        ) : <Linkify text={r.body} className="text-sm leading-relaxed" />}
        onReply={startReply} onEdit={startEditReply}
        onDelete={(x) => { setConfirm({ kind: 'reply', id: x.id }); setConfirmErr(''); }}
        onReport={(x) => setReport({ type: 'reply', id: x.id })}
        onMod={(x, action) => { setMod({ scope: 'reply', id: x.id, action }); setModErr(''); }} />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/forum" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"><Icon name="arrowLeft" className="h-4 w-4" />Foruma qayıt</Link>

      {isAdmin && (
        <div className="card mb-4 flex flex-wrap items-center gap-2 border-primary/30 bg-primary-soft p-3" data-testid="mod-bar">
          <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-primary"><Icon name="shield" className="h-4 w-4" />Moderator</span>
          {topic.status === 'active' && <button className="btn btn-secondary btn-sm" onClick={() => { setMod({ scope: 'topic', id: id, action: 'hide' }); setModErr(''); }}><Icon name="eyeOff" className="h-4 w-4" />Gizlət</button>}
          {topic.status !== 'active' && <button className="btn btn-secondary btn-sm" onClick={() => { setMod({ scope: 'topic', id: id, action: 'restore' }); setModErr(''); }}><Icon name="rotate" className="h-4 w-4" />Bərpa et</button>}
          {topic.status !== 'deleted' && <button className="btn btn-danger btn-sm" onClick={() => { setMod({ scope: 'topic', id: id, action: 'delete' }); setModErr(''); }}><Icon name="trash" className="h-4 w-4" />Sil</button>}
          {topic.status === 'active' && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setMod({ scope: 'topic', id: id, action: topic.is_pinned ? 'unpin' : 'pin' }); setModErr(''); }}>
              <Icon name="pushpin" className="h-4 w-4" />{topic.is_pinned ? 'Sabiti götür' : 'Sabitlə'}
            </button>
          )}
          {topic.status === 'active' && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setMod({ scope: 'topic', id: id, action: topic.is_locked ? 'unlock' : 'lock' }); setModErr(''); }}>
              <Icon name="lock" className="h-4 w-4" />{topic.is_locked ? 'Aç' : 'Bağla'}
            </button>
          )}
        </div>
      )}

      {topic.status !== 'active' && <Alert type="warning" className="mb-4">Bu mövzu {STATUS_LABEL[topic.status].toLowerCase()} və yalnız adminlərə görünür.</Alert>}
      {flash.text && <Alert type={flash.type || 'success'} className="mb-4">{flash.text}</Alert>}

      <article className="card p-5 sm:p-6">
        {editTopic ? (
          <form onSubmit={saveTopic} className="space-y-4">
            <h1 className="text-lg font-semibold">Mövzunu redaktə et</h1>
            <div>
              <label htmlFor="et-cat" className="label">Kateqoriya</label>
              <select id="et-cat" className="input" value={tForm.category} onChange={(e) => setTForm({ ...tForm, category: e.target.value })}>
                {editableCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="et-title" className="label">Başlıq</label>
              <input id="et-title" className="input" maxLength={150} value={tForm.title} onChange={(e) => setTForm({ ...tForm, title: e.target.value })} />
              <p className="hint text-right"><CharCount value={tForm.title} max={150} min={5} /></p>
            </div>
            <div>
              <label htmlFor="et-body" className="label">Mətn</label>
              <textarea id="et-body" rows={10} className="input" maxLength={BODY_MAX} value={tForm.body} onChange={(e) => setTForm({ ...tForm, body: e.target.value })} />
              <p className="hint text-right"><CharCount value={tForm.body} max={BODY_MAX} min={10} /></p>
            </div>
            {tErr && <Alert type="error">{tErr}</Alert>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" disabled={tBusy} onClick={() => setEditTopic(false)}>Ləğv et</button>
              <button className="btn btn-primary" disabled={tBusy}>{tBusy && <Spinner />}Yadda saxla</button>
            </div>
          </form>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {topic.is_pinned && <span className="badge"><Icon name="pushpin" className="h-3 w-3" />Sabit</span>}
              {topic.is_locked && <span className="badge badge-muted"><Icon name="lock" className="h-3 w-3" />Bağlı</span>}
              {cat && <Link href={`/forum?category=${cat.slug}`} className="badge badge-muted hover:text-primary">{cat.name}</Link>}
            </div>
            <h1 className="break-words text-xl font-bold leading-snug tracking-tight sm:text-2xl" data-testid="topic-title">{topic.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
              <AuthorLine id={topic.author_id} profile={profiles[topic.author_id]} avatar />
              <span>{fmtDateTime(topic.created_at)}{topic.edited_at ? ' · redaktə edilib' : ''}</span>
              <span>Son aktivlik: {timeAgo(topic.last_activity_at)}</span>
            </div>
            <Linkify text={topic.body} className="mt-5 text-[15px] leading-relaxed" />
            <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-line pt-4">
              {(isAdmin || (isAuthor && topicActive && !topic.is_locked && !blocked)) && (
                <button className="btn btn-ghost btn-sm" onClick={startEditTopic}><Icon name="edit" className="h-4 w-4" />Redaktə</button>
              )}
              {(isAdmin || isAuthor) && topic.status !== 'deleted' && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setConfirm({ kind: 'topic', id }); setConfirmErr(''); }}><Icon name="trash" className="h-4 w-4" />Sil</button>
              )}
              {!!user && !isAuthor && topicActive && !blocked && (
                <button className="btn btn-ghost btn-sm" onClick={() => setReport({ type: 'topic', id })}><Icon name="flag" className="h-4 w-4" />Şikayət et</button>
              )}
            </div>
          </>
        )}
      </article>

      <section className="mt-8" aria-labelledby="replies-h">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="replies-h" className="text-lg font-semibold">Cavablar <span className="text-muted">({topic.reply_count})</span></h2>
          <div>
            <label htmlFor="reply-dir" className="sr-only">Cavabların sırası</label>
            <select id="reply-dir" className="input h-9 w-auto py-0 text-sm" value={dir} onChange={(e) => setDir(e.target.value)}>
              <option value="asc">Əvvəlcə köhnə</option>
              <option value="desc">Əvvəlcə yeni</option>
            </select>
          </div>
        </div>

        {repliesError && <Alert type="error" className="mb-3">{repliesError}</Alert>}
        {!repliesLoaded ? <ListSkeleton count={2} /> : roots.length === 0 && !repliesError ? (
          <div className="card px-6 py-10 text-center text-sm text-muted">Hələ cavab yoxdur. İlk cavabı siz yazın.</div>
        ) : (
          <div className="space-y-3">
            {roots.map((r) => (
              <div key={r.id} className="space-y-2">
                {renderReply(r, false, !!r.parent_id && !known.has(r.parent_id))}
                {(kids[r.id] || []).map((k) => renderReply(k, true, false))}
              </div>
            ))}
          </div>
        )}
        <LoadMore onClick={() => setLimit((l) => l + REPLY_PAGE)} hasMore={repliesLoaded && replies.length < repliesTotal} label="Daha çox cavab yüklə" />
      </section>

      <section className="mt-8" aria-label="Cavab yaz" ref={composerRef}>
        {!user ? (
          <LoginPrompt text="Cavab yazmaq üçün daxil olun." next={nextHref} />
        ) : blocked ? (
          <Alert type="warning">Hesabınız {fmtBlockUntil(me.blockedUntil)} məhdudlaşdırılıb. Bu müddətdə cavab yaza bilməzsiniz.</Alert>
        ) : !topicActive ? null : topic.is_locked ? (
          <Alert type="info"><Icon name="lock" className="mr-1 inline h-4 w-4" />Bu mövzu bağlanıb, yeni cavab yazmaq mümkün deyil.</Alert>
        ) : (
          <form onSubmit={sendReply} className="card space-y-3 p-4 sm:p-5">
            <label htmlFor="reply-text" className="label !mb-0">{replyTo ? `Cavab: ${replyTo.name}` : 'Cavabınız'}</label>
            {replyTo && (
              <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setReplyTo(null)}>Ümumi cavaba qayıt</button>
            )}
            <textarea id="reply-text" ref={composerInput} rows={4} maxLength={REPLY_MAX} className="input" value={replyText}
              onChange={(e) => setReplyText(e.target.value)} placeholder="Fikrinizi yazın…" />
            <p className="hint flex justify-between"><span>Sadə mətn. HTML işlənmir.</span><CharCount value={replyText} max={REPLY_MAX} /></p>
            {replyErr && <Alert type="error">{replyErr}</Alert>}
            <div className="flex justify-end">
              <button className="btn btn-primary" disabled={replyBusy || !replyText.trim()}>{replyBusy ? <Spinner /> : <Icon name="send" className="h-4 w-4" />}Göndər</button>
            </div>
          </form>
        )}
      </section>

      <ConfirmDialog open={!!confirm} danger busy={confirmBusy} error={confirmErr} confirmLabel="Sil"
        title={confirm?.kind === 'topic' ? 'Mövzunu sil' : 'Cavabı sil'} onClose={() => setConfirm(null)} onConfirm={doDelete}>
        {confirm?.kind === 'topic' ? 'Mövzu siyahıdan silinəcək. Tarixçə moderasiya üçün saxlanılır.' : 'Cavab silinəcək.'} Davam edək?
      </ConfirmDialog>

      <ReportModal key={`${report?.type}-${report?.id}`} target={report} onClose={() => setReport(null)}
        onDone={(text) => { setReport(null); setFlash({ type: 'success', text }); }} />

      <NoteDialog key={`${mod?.scope}-${mod?.id}-${mod?.action}`} open={!!mod} title={modInfo ? `${modInfo[0]}?` : ''}
        text={modInfo ? modInfo[1] : ''} confirmLabel={modInfo ? modInfo[0] : 'Təsdiq'} danger={modInfo ? modInfo[2] : false}
        withNote={!!mod && ['hide', 'delete', 'lock'].includes(mod.action)} busy={modBusy} error={modErr}
        onConfirm={doMod} onClose={() => setMod(null)} />
    </div>
  );
}
