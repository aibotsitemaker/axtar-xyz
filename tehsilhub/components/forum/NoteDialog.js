'use client';
import { useState } from 'react';
import { Alert, Modal, Spinner } from '../ui';

// Admin əməliyyatı üçün təsdiq pəncərəsi (istəyə görə qeyd ilə). Səhifədə key ilə istifadə edin.
export default function NoteDialog({ open, title, text, confirmLabel, danger = false, withNote = true, noteHint = 'müəllifə bildirişdə göstərilir, könüllü', busy = false, error = '', onConfirm, onClose }) {
  const [note, setNote] = useState('');
  return (
    <Modal open={open} onClose={() => { if (!busy) onClose(); }} title={title}>
      <p className="mt-2 text-sm text-muted">{text}</p>
      {withNote && (
        <div className="mt-4">
          <label htmlFor="mod-note" className="label">Qeyd <span className="font-normal text-muted">({noteHint})</span></label>
          <textarea id="mod-note" rows={2} maxLength={300} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}
      {error && <Alert type="error" className="mt-3">{error}</Alert>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Ləğv et</button>
        <button type="button" disabled={busy} onClick={() => onConfirm(note.trim())}
          className={danger ? 'btn bg-danger text-white hover:bg-danger/90' : 'btn btn-primary'}>
          {busy && <Spinner />}{confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
