'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth, LoginPrompt } from '../../components/AuthProvider';
import Icon from '../../components/Icons';
import { Alert, PageHeader } from '../../components/ui';

function ChatInner() {
  const { user, loading } = useAuth();
  const sp = useSearchParams();
  const router = useRouter();
  const paramId = sp.get('c');
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(paramId);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const listRef = useRef(null);

  useEffect(() => { if (paramId) setActive(paramId); }, [paramId]);

  const loadConvs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('conversations').select('*, books(title)').order('created_at', { ascending: false });
    const rows = data || [];
    const ids = [...new Set(rows.map((c) => (c.user_a === user.id ? c.user_b : c.user_a)))];
    const names = {};
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      (ps || []).forEach((p) => { names[p.id] = p.full_name; });
    }
    setConvs(rows.map((c) => ({ ...c, partner: names[c.user_a === user.id ? c.user_b : c.user_a] || 'İstifadəçi' })));
  }, [user]);

  useEffect(() => { loadConvs(); }, [loadConvs, paramId]);

  useEffect(() => {
    if (!user || !active) { setMsgs([]); return; }
    let ignore = false;
    const markRead = () =>
      supabase.from('chat_messages').update({ is_read: true })
        .eq('conversation_id', active).neq('sender_id', user.id).eq('is_read', false).then(() => {});

    supabase.from('chat_messages').select('*').eq('conversation_id', active).order('created_at')
      .then(({ data }) => { if (!ignore) { setMsgs(data || []); markRead(); } });

    const channel = supabase.channel(`chat-${active}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${active}` },
        (payload) => {
          setMsgs((m) => (m.some((x) => x.id === payload.new.id) ? m : [...m, payload.new]));
          if (payload.new.sender_id !== user.id) markRead();
        })
      .subscribe();

    return () => { ignore = true; supabase.removeChannel(channel); };
  }, [active, user]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [msgs, active]);

  async function send(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !active) return;
    setText('');
    setErr('');
    const { data, error } = await supabase.from('chat_messages')
      .insert({ conversation_id: active, sender_id: user.id, content }).select().single();
    if (error) { setText(content); setErr(error.message || 'Mesaj göndərilmədi.'); return; }
    setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data]));
  }

  if (loading) return <div className="skeleton h-96" aria-busy="true" />;
  if (!user) return <LoginPrompt text="Çatdan istifadə üçün daxil olun." />;

  const current = convs.find((c) => c.id === active);

  return (
    <div>
      <div className={active ? 'hidden md:block' : ''}><PageHeader title="Mesajlar" subtitle="Satıcılar və digər istifadəçilərlə söhbətlər" /></div>
      <div className="card flex h-[calc(100dvh-10.5rem)] min-h-[440px] overflow-hidden md:h-[calc(100dvh-14rem)]">
        <aside className={`${active ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-line md:w-80`}>
          <div className="border-b border-line px-4 py-3 text-sm font-semibold">Söhbətlər</div>
          <div className="flex-1 overflow-y-auto">
            {convs.length === 0 && (
              <div className="p-8 text-center">
                <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-primary"><Icon name="chat" className="h-5 w-5" /></div>
                <p className="text-sm font-medium">Hələ söhbət yoxdur</p>
                <p className="mt-1 text-xs text-muted">Kitab elanından “Çat” düyməsini sıxın.</p>
              </div>
            )}
            {convs.map((c) => (
              <button key={c.id} onClick={() => { setActive(c.id); router.replace(`/chat?c=${c.id}`); }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas ${active === c.id ? 'bg-primary-soft' : ''}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-white">{c.partner[0]?.toUpperCase()}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{c.partner}</span>
                  <span className="block truncate text-xs text-ink/70">{c.books?.title ? c.books.title : 'Şəxsi söhbət'}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className={`${active ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
          {!active ? (
            <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted">Söhbət seçin</div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <button className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-canvas md:hidden" aria-label="Söhbətlərə qayıt" onClick={() => { setActive(null); router.replace('/chat'); }}>
                  <Icon name="arrowLeft" className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{current?.partner || 'Söhbət'}</div>
                  {current?.books?.title && <div className="truncate text-xs text-muted">{current.books.title}</div>}
                </div>
              </div>
              <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-canvas p-4">
                {msgs.length === 0 && <p className="py-10 text-center text-sm text-muted">Hələ mesaj yoxdur. İlk mesajı yazın.</p>}
                {msgs.map((m) => {
                  const mine = m.sender_id === user.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[82%] rounded-2xl px-4 py-2 text-sm ${mine ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md border border-line bg-surface text-ink'}`}>
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p className={`mt-1 text-right text-[10px] ${mine ? 'text-white' : 'text-muted'}`}>
                          {new Date(m.created_at).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}{mine && (m.is_read ? ' · oxundu' : '')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {err && <div className="border-t border-line bg-surface px-3 pt-3"><Alert type="error">{err}</Alert></div>}
              <form onSubmit={send} className="flex gap-2 border-t border-line bg-surface p-3">
                <input aria-label="Mesaj" className="input" placeholder="Mesaj yazın..." value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
                <button className="btn btn-primary shrink-0" disabled={!text.trim()} aria-label="Göndər"><Icon name="send" className="h-4 w-4" /><span className="hidden sm:inline">Göndər</span></button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96" aria-busy="true" />}>
      <ChatInner />
    </Suspense>
  );
}
