'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth, LoginPrompt } from '../../components/AuthProvider';

function ChatInner() {
  const { user, loading } = useAuth();
  const sp = useSearchParams();
  const router = useRouter();
  const paramId = sp.get('c');
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(paramId);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef(null);

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

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  async function send(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !active) return;
    setText('');
    const { data, error } = await supabase.from('chat_messages')
      .insert({ conversation_id: active, sender_id: user.id, content }).select().single();
    if (error) { setText(content); return; }
    setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data]));
  }

  if (loading) return <p className="py-16 text-center text-slate-400">Yüklənir...</p>;
  if (!user) return <LoginPrompt text="Çatdan istifadə üçün daxil olun." />;

  const current = convs.find((c) => c.id === active);

  return (
    <div className="card flex h-[calc(100vh-12rem)] min-h-[460px] overflow-hidden md:h-[calc(100vh-9rem)]">
      <aside className={`${active ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-slate-200 md:w-80`}>
        <div className="border-b border-slate-200 p-4 font-semibold">Söhbətlər</div>
        <div className="flex-1 overflow-y-auto">
          {convs.length === 0 && <p className="p-6 text-center text-sm text-slate-400">Hələ söhbət yoxdur. Kitab elanından “Çat” düyməsini sıxın.</p>}
          {convs.map((c) => (
            <button key={c.id} onClick={() => { setActive(c.id); router.replace(`/chat?c=${c.id}`); }}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${active === c.id ? 'bg-emerald-50' : ''}`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{c.partner[0]?.toUpperCase()}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{c.partner}</span>
                <span className="block truncate text-xs text-slate-400">{c.books?.title ? `📖 ${c.books.title}` : 'Şəxsi söhbət'}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className={`${active ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
        {!active ? (
          <div className="grid flex-1 place-items-center text-slate-400">Söhbət seçin</div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-slate-200 p-4">
              <button className="md:hidden" onClick={() => { setActive(null); router.replace('/chat'); }}>←</button>
              <div>
                <div className="font-semibold">{current?.partner || 'Söhbət'}</div>
                {current?.books?.title && <div className="text-xs text-slate-400">📖 {current.books.title}</div>}
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto bg-canvas p-4">
              {msgs.map((m) => {
                const mine = m.sender_id === user.id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${mine ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md bg-white text-ink shadow-sm'}`}>
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <p className={`mt-1 text-right text-[10px] ${mine ? 'text-emerald-100' : 'text-slate-400'}`}>
                        {new Date(m.created_at).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}{mine && (m.is_read ? ' ✓✓' : ' ✓')}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <form onSubmit={send} className="flex gap-2 border-t border-slate-200 bg-white p-3">
              <input className="input" placeholder="Mesaj yazın..." value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
              <button className="btn btn-primary" disabled={!text.trim()}>Göndər</button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-slate-400">Yüklənir...</p>}>
      <ChatInner />
    </Suspense>
  );
}
