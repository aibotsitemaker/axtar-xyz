'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MOD_TEXT } from '../../lib/admin';
import { errText } from '../../lib/format';
import NoteDialog from '../forum/NoteDialog';

function Inner({ mod, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const info = MOD_TEXT[mod.action];

  async function run(note) {
    setBusy(true);
    setErr('');
    const fn = mod.scope === 'topic' ? 'admin_forum_topic_action' : 'admin_forum_reply_action';
    const { error } = await supabase.rpc(fn, { p_id: mod.id, p_action: mod.action, p_note: note || null });
    setBusy(false);
    if (error) { setErr(errText(error)); return; }
    onDone('Əməliyyat yerinə yetirildi və audit jurnalına yazıldı.');
  }

  return (
    <NoteDialog open title={`${info[0]}?`} text={`${mod.label ? `«${mod.label}» — ` : ''}${info[1]}`} confirmLabel={info[0]} danger={info[2]}
      withNote={['hide', 'delete', 'lock'].includes(mod.action)} busy={busy} error={err} onConfirm={run} onClose={onClose} />
  );
}

// mod: { scope: 'topic' | 'reply', id, action, label? } | null. Hər açılışda vəziyyət sıfırlanır (key).
export default function ModDialog({ mod, onClose, onDone }) {
  if (!mod) return null;
  return <Inner key={`${mod.scope}-${mod.id}-${mod.action}`} mod={mod} onClose={onClose} onDone={onDone} />;
}
