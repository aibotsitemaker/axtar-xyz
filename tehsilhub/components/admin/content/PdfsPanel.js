'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import AuthorLine from '../../forum/AuthorLine';
import ContentFilter from './ContentFilter';
import StatusBadge from '../StatusBadge';
import { useProfileMap } from '../useProfileMap';
import { Table, Td } from '../Table';
import Icon from '../../Icons';
import { Alert, ConfirmDialog, EmptyState, ListSkeleton, LoadMore, Modal, Spinner } from '../../ui';
import { PAGE } from '../../../lib/admin';
import { safeUrl } from '../../../lib/safe';
import { usePaged } from '../../../lib/usePaged';
import { errText, fmtDate } from '../../../lib/format';

// Dəyərlər 01_supabase_schema.sql-dəki CHECK məhdudiyyətləri ilə eynidir.
const LEVELS = ['Orta məktəb', 'DİM', 'Bakalavr', 'Magistr', 'IELTS', 'Digər'];
const STATUSES = [['', 'Bütün statuslar'], ['active', 'Aktiv'], ['hidden', 'Gizli']];

function EditForm({ pdf, onClose, onSaved }) {
  const [title, setTitle] = useState(pdf.title);
  const [subject, setSubject] = useState(pdf.subject);
  const [level, setLevel] = useState(pdf.level);
  const [status, setStatus] = useState(pdf.status);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lock = useRef(false);

  async function submit(e) {
    e.preventDefault();
    if (lock.current) return;
    const t = title.trim().replace(/\s+/g, ' ');
    const s = subject.trim().replace(/\s+/g, ' ');
    if (t.length < 3 || t.length > 150) { setErr('Başlıq 3–150 simvol olmalıdır.'); return; }
    if (s.length < 2 || s.length > 80) { setErr('Fənn 2–80 simvol olmalıdır.'); return; }
    lock.current = true;
    setBusy(true);
    setErr('');
    const { data, error } = await supabase.from('pdfs').update({ title: t, subject: s, level, status }).eq('id', pdf.id).select('id');
    setBusy(false);
    lock.current = false;
    if (error || !data || !data.length) { setErr(errText(error, 'Dəyişiklik saxlanılmadı. İcazəni yoxlayın.')); return; }
    onSaved('PDF yeniləndi.');
  }

  return (
    <Modal open onClose={() => { if (!busy) onClose(); }} title="PDF-i redaktə et">
      <form onSubmit={submit} className="mt-3 space-y-4" noValidate>
        <div>
          <label htmlFor="pe-title" className="label">Başlıq</label>
          <input id="pe-title" className="input" required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pe-subject" className="label">Fənn</label>
            <input id="pe-subject" className="input" required maxLength={80} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pe-level" className="label">Səviyyə</label>
            <select id="pe-level" className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="pe-status" className="label">Status</label>
          <select id="pe-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.filter(([v]) => v).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {err && <Alert type="error">{err}</Alert>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Ləğv et</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}Yadda saxla</button>
        </div>
      </form>
    </Modal>
  );
}

// PDF resurslarının idarəsi (elanlarla eyni qaydada: RLS + avtomatik audit).
export default function PdfsPanel({ onFlash }) {
  const [f, setF] = useState({ q: '', status: '' });
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [delErr, setDelErr] = useState('');
  const [pending, setPending] = useState('');

  const list = usePaged((from, to) => {
    let q = supabase.from('pdfs').select('id, uploader_id, title, subject, level, year, file_url, status, created_at', from === 0 ? { count: 'exact' } : undefined);
    if (f.status) q = q.eq('status', f.status);
    if (f.q) q = q.ilike('title', `%${f.q}%`);
    return q.order('created_at', { ascending: false }).range(from, to);
  }, PAGE, `${f.q}|${f.status}`);
  const profiles = useProfileMap(list.rows.map((p) => p.uploader_id));

  async function setStatus(p, status) {
    if (pending) return;
    setPending(p.id);
    const { data, error } = await supabase.from('pdfs').update({ status }).eq('id', p.id).select('id');
    setPending('');
    if (error || !data || !data.length) { onFlash('error', errText(error, 'Status dəyişmədi. İcazəni yoxlayın.')); return; }
    onFlash('success', status === 'hidden' ? 'PDF gizlədildi.' : 'PDF aktiv edildi.');
    list.reload();
  }

  async function remove() {
    setBusy(true);
    setDelErr('');
    const { data, error } = await supabase.from('pdfs').delete().eq('id', del.id).select('id');
    setBusy(false);
    if (error || !data || !data.length) { setDelErr(errText(error, 'PDF silinmədi. İcazəni yoxlayın.')); return; }
    setDel(null);
    onFlash('success', 'PDF silindi və audit jurnalına yazıldı.');
    list.reload();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">{list.loading ? 'Yüklənir…' : `${list.total} PDF`}</p>
        <Link href="/pdfs" className="btn btn-secondary btn-sm"><Icon name="plus" className="h-4 w-4" />Yeni PDF əlavə et</Link>
      </div>
      <ContentFilter f={f} onApply={(n) => setF((p) => ({ ...p, ...n }))} label="PDF axtarışı" placeholder="PDF başlığı axtarın..." statuses={STATUSES} />
      {list.error && <Alert type="error" className="mb-4">{list.error}</Alert>}
      {list.loading ? <ListSkeleton count={3} /> : list.rows.length === 0 && !list.error ? (
        <EmptyState icon="file" title="PDF tapılmadı" text="Axtarışı və ya filtrləri dəyişin." />
      ) : list.rows.length > 0 && (
        <Table label="PDF resursları" head={['PDF', 'Yükləyən', 'Səviyyə', 'Tarix', 'Status', 'Əməliyyatlar']}>
          {list.rows.map((p) => {
            const url = safeUrl(p.file_url);
            return (
              <tr key={p.id} data-testid="pdf-row">
                <Td className="max-w-xs break-words">
                  <span className="font-medium">{p.title}</span>
                  <div className="text-xs text-muted">{p.subject}{p.year ? ` · ${p.year}` : ''}</div>
                </Td>
                <Td><AuthorLine id={p.uploader_id} profile={profiles[p.uploader_id]} /></Td>
                <Td className="text-muted">{p.level}</Td>
                <Td className="whitespace-nowrap text-muted">{fmtDate(p.created_at)}</Td>
                <Td><StatusBadge status={p.status} /></Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {url && <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Aç</a>}
                    <button className="btn btn-secondary btn-sm" onClick={() => setEdit(p)}>Redaktə</button>
                    {p.status === 'hidden'
                      ? <button className="btn btn-secondary btn-sm" disabled={!!pending} onClick={() => setStatus(p, 'active')}>Aktiv et</button>
                      : <button className="btn btn-secondary btn-sm" disabled={!!pending} onClick={() => setStatus(p, 'hidden')}>Gizlət</button>}
                    <button className="btn btn-danger btn-sm" onClick={() => { setDel(p); setDelErr(''); }}>Sil</button>
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
      <LoadMore onClick={list.more} loading={list.moreLoading} hasMore={list.hasMore} />

      {edit && <EditForm key={edit.id} pdf={edit} onClose={() => setEdit(null)} onSaved={(m) => { setEdit(null); onFlash('success', m); list.reload(); }} />}
      <ConfirmDialog open={!!del} danger busy={busy} error={delErr} title="PDF silinsin?" confirmLabel="Sil" onConfirm={remove} onClose={() => setDel(null)}>
        «{del?.title}» qeydi həmişəlik silinəcək, istifadəçilərin sevimlilərindən də çıxacaq (yüklənmiş fayl saxlama sahəsində qala bilər). Çox vaxt «Gizlət» daha təhlükəsizdir.
      </ConfirmDialog>
    </div>
  );
}
