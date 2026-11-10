'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { REPORT_REASONS } from '../../lib/forum';
import { errText } from '../../lib/format';
import { Alert, Modal, Spinner } from '../ui';

// target: { type: 'topic' | 'reply', id } | null.  Səhifədə key={tip-id} ilə istifadə edin ki, hər açılışda sıfırlansın.
export default function ReportModal({ target, onClose, onDone }) {
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (busy || !target) return;
    setBusy(true);
    setErr('');
    const { error } = await supabase.rpc('forum_report', { p_target_type: target.type, p_target: target.id, p_reason: reason, p_details: details.trim() || null });
    setBusy(false);
    if (error) { setErr(errText(error)); return; }
    onDone('Şikayətiniz qəbul edildi. Təşəkkür edirik, moderatorlar baxacaq.');
  }

  return (
    <Modal open={!!target} onClose={() => { if (!busy) onClose(); }} title="Məzmunu şikayət et">
      <form onSubmit={submit} className="mt-3 space-y-4">
        <div>
          <label htmlFor="rep-reason" className="label">Səbəb</label>
          <select id="rep-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rep-details" className="label">Əlavə qeyd <span className="font-normal text-muted">(könüllü)</span></label>
          <textarea id="rep-details" rows={3} maxLength={500} className="input" value={details} onChange={(e) => setDetails(e.target.value)} />
          <p className="hint">{details.length}/500. Əsassız şikayətlər hesabınızın məhdudlaşdırılmasına səbəb ola bilər.</p>
        </div>
        {err && <Alert type="error">{err}</Alert>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Ləğv et</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}Göndər</button>
        </div>
      </form>
    </Modal>
  );
}
