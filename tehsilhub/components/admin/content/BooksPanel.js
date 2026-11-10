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
import { usePaged } from '../../../lib/usePaged';
import { errText, fmtDate } from '../../../lib/format';

// Dəyərlər 01_supabase_schema.sql-dəki CHECK məhdudiyyətləri ilə eynidir.
const CATS = ['DİM', 'Magistr', 'IELTS', 'Universitet', 'Digər'];
const STATUSES = [['', 'Bütün statuslar'], ['active', 'Aktiv'], ['sold', 'Satılıb'], ['hidden', 'Gizli']];
const price = (n) => `${Number(n).toLocaleString('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₼`;

function EditForm({ book, onClose, onSaved }) {
  const [title, setTitle] = useState(book.title);
  const [category, setCategory] = useState(book.category);
  const [p, setP] = useState(String(book.price));
  const [status, setStatus] = useState(book.status);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lock = useRef(false);

  async function submit(e) {
    e.preventDefault();
    if (lock.current) return;
    const t = title.trim().replace(/\s+/g, ' ');
    const n = Number(p);
    if (t.length < 3 || t.length > 150) { setErr('Başlıq 3–150 simvol olmalıdır.'); return; }
    if (!Number.isFinite(n) || n < 0 || n > 99999999) { setErr('Qiymət 0 və ya daha böyük ədəd olmalıdır.'); return; }
    lock.current = true;
    setBusy(true);
    setErr('');
    const { data, error } = await supabase.from('books').update({ title: t, category, price: n, status }).eq('id', book.id).select('id');
    setBusy(false);
    lock.current = false;
    if (error || !data || !data.length) { setErr(errText(error, 'Dəyişiklik saxlanılmadı. İcazəni yoxlayın.')); return; }
    onSaved('Elan yeniləndi.');
  }

  return (
    <Modal open onClose={() => { if (!busy) onClose(); }} title="Elanı redaktə et">
      <form onSubmit={submit} className="mt-3 space-y-4" noValidate>
        <div>
          <label htmlFor="be-title" className="label">Başlıq</label>
          <input id="be-title" className="input" required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="be-cat" className="label">Kateqoriya</label>
            <select id="be-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="be-price" className="label">Qiymət (₼)</label>
            <input id="be-price" type="number" inputMode="decimal" min={0} step="0.01" className="input" value={p} onChange={(e) => setP(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="be-status" className="label">Status</label>
          <select id="be-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
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

// Kitab elanlarının idarəsi. Dəyişikliklər adi cədvəl sorğuları ilə gedir; icazəni RLS yoxlayır (yalnız admin başqasının elanını dəyişə bilər),
// admin tərəfindən edilən hər dəyişiklik/silmə bazadakı trigger ilə audit jurnalına yazılır.
export default function BooksPanel({ onFlash }) {
  const [f, setF] = useState({ q: '', status: '' });
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [delErr, setDelErr] = useState('');
  const [pending, setPending] = useState('');

  const list = usePaged((from, to) => {
    let q = supabase.from('books').select('id, seller_id, title, category, price, status, city, created_at', from === 0 ? { count: 'exact' } : undefined);
    if (f.status) q = q.eq('status', f.status);
    if (f.q) q = q.ilike('title', `%${f.q}%`);
    return q.order('created_at', { ascending: false }).range(from, to);
  }, PAGE, `${f.q}|${f.status}`);
  const profiles = useProfileMap(list.rows.map((b) => b.seller_id));

  async function setStatus(b, status) {
    if (pending) return;
    setPending(b.id);
    const { data, error } = await supabase.from('books').update({ status }).eq('id', b.id).select('id');
    setPending('');
    if (error || !data || !data.length) { onFlash('error', errText(error, 'Status dəyişmədi. İcazəni yoxlayın.')); return; }
    onFlash('success', status === 'hidden' ? 'Elan gizlədildi.' : 'Elan aktiv edildi.');
    list.reload();
  }

  async function remove() {
    setBusy(true);
    setDelErr('');
    const { data, error } = await supabase.from('books').delete().eq('id', del.id).select('id');
    setBusy(false);
    if (error || !data || !data.length) { setDelErr(errText(error, 'Elan silinmədi. İcazəni yoxlayın.')); return; }
    setDel(null);
    onFlash('success', 'Elan silindi və audit jurnalına yazıldı.');
    list.reload();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">{list.loading ? 'Yüklənir…' : `${list.total} elan`}</p>
        <Link href="/books" className="btn btn-secondary btn-sm"><Icon name="plus" className="h-4 w-4" />Yeni elan əlavə et</Link>
      </div>
      <ContentFilter f={f} onApply={(n) => setF((p) => ({ ...p, ...n }))} label="Elan axtarışı" placeholder="Elan başlığı axtarın..." statuses={STATUSES} />
      {list.error && <Alert type="error" className="mb-4">{list.error}</Alert>}
      {list.loading ? <ListSkeleton count={3} /> : list.rows.length === 0 && !list.error ? (
        <EmptyState icon="book" title="Elan tapılmadı" text="Axtarışı və ya filtrləri dəyişin." />
      ) : list.rows.length > 0 && (
        <Table label="Kitab elanları" head={['Elan', 'Satıcı', 'Qiymət', 'Tarix', 'Status', 'Əməliyyatlar']}>
          {list.rows.map((b) => (
            <tr key={b.id} data-testid="book-row">
              <Td className="max-w-xs break-words"><span className="font-medium">{b.title}</span><div className="text-xs text-muted">{b.category} · {b.city}</div></Td>
              <Td><AuthorLine id={b.seller_id} profile={profiles[b.seller_id]} /></Td>
              <Td className="whitespace-nowrap text-muted">{price(b.price)}</Td>
              <Td className="whitespace-nowrap text-muted">{fmtDate(b.created_at)}</Td>
              <Td><StatusBadge status={b.status} /></Td>
              <Td>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <button className="btn btn-secondary btn-sm" onClick={() => setEdit(b)}>Redaktə</button>
                  {b.status === 'hidden'
                    ? <button className="btn btn-secondary btn-sm" disabled={!!pending} onClick={() => setStatus(b, 'active')}>Aktiv et</button>
                    : <button className="btn btn-secondary btn-sm" disabled={!!pending} onClick={() => setStatus(b, 'hidden')}>Gizlət</button>}
                  <button className="btn btn-danger btn-sm" onClick={() => { setDel(b); setDelErr(''); }}>Sil</button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <LoadMore onClick={list.more} loading={list.moreLoading} hasMore={list.hasMore} />

      {edit && <EditForm key={edit.id} book={edit} onClose={() => setEdit(null)} onSaved={(m) => { setEdit(null); onFlash('success', m); list.reload(); }} />}
      <ConfirmDialog open={!!del} danger busy={busy} error={delErr} title="Elan silinsin?" confirmLabel="Sil" onConfirm={remove} onClose={() => setDel(null)}>
        «{del?.title}» elanı həmişəlik silinəcək, istifadəçilərin sevimlilərindən də çıxacaq. Çox vaxt «Gizlət» daha təhlükəsizdir: elan saxlanılır, amma görünmür.
      </ConfirmDialog>
    </div>
  );
}
