'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { Table, Td } from '../../../components/admin/Table';
import Icon from '../../../components/Icons';
import { Alert, EmptyState, ListSkeleton, LoadMore, PageHeader } from '../../../components/ui';
import { AUDIT_GROUPS, PAGE, actionLabel, detailText, searchLike } from '../../../lib/admin';
import { usePaged } from '../../../lib/usePaged';
import { fmtDateTime } from '../../../lib/format';

const GROUP_KEYS = AUDIT_GROUPS.map((g) => g[0]);
const TARGET_LINK = { user: (id) => `/admin/users/${id}`, forum_topic: (id) => `/forum/${id}` };
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const TARGET_TYPE = { user: 'İstifadəçi', forum_topic: 'Mövzu', forum_reply: 'Cavab', forum_category: 'Kateqoriya', forum_report: 'Şikayət', quiz: 'Sınaq', books: 'Elan', pdfs: 'PDF' };

// Audit jurnalı: yalnız oxunur (bazada dəyişdirmək və silmək trigger ilə qadağandır). Yalnız adminlər görə bilər (RLS).
export default function AdminAuditPage() {
  const [f, setF] = useState(null); // { group, q, from, to }
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const group = GROUP_KEYS.includes(sp.get('group')) ? sp.get('group') : '';
    const q = (sp.get('q') || '').slice(0, 60);
    const from = isDay(sp.get('from')) ? sp.get('from') : '';
    const to = isDay(sp.get('to')) ? sp.get('to') : '';
    setDraft(q);
    setF({ group, q, from, to });
  }, []);

  const key = f ? `${f.group}|${f.q}|${f.from}|${f.to}` : '';
  const list = usePaged((from, to) => {
    let q = supabase.from('admin_audit_log')
      .select('id, created_at, actor_id, actor_label, action, target_type, target_id, target_label, details', from === 0 ? { count: 'exact' } : undefined);
    if (f.group) q = q.like('action', f.group);
    const t = searchLike(f.q);
    if (t) q = q.or(`target_label.ilike.%${t}%,actor_label.ilike.%${t}%`);
    if (f.from) q = q.gte('created_at', new Date(`${f.from}T00:00:00`).toISOString());
    if (f.to) q = q.lte('created_at', new Date(`${f.to}T23:59:59.999`).toISOString());
    return q.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to);
  }, PAGE, key, f !== null);

  function update(next) {
    const n = { ...f, ...next };
    setF(n);
    const sp = new URLSearchParams();
    if (n.group) sp.set('group', n.group);
    if (n.q) sp.set('q', n.q);
    if (n.from) sp.set('from', n.from);
    if (n.to) sp.set('to', n.to);
    const qs = sp.toString();
    window.history.replaceState(null, '', qs ? `/admin/audit?${qs}` : '/admin/audit');
  }

  const has = f && (f.group || f.q || f.from || f.to);

  return (
    <div>
      <PageHeader title="Audit jurnalı" subtitle="Adminlərin kritik əməliyyatları. Qeydlər dəyişdirilə və silinə bilməz; şifrə, token və açarlar heç vaxt yazılmır." />

      <form role="search" aria-label="Audit jurnalı filtri" className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]"
        onSubmit={(e) => { e.preventDefault(); if (f) update({ q: searchLike(draft) }); }}>
        <div className="relative">
          <label htmlFor="au-q" className="sr-only">Axtarış</label>
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input id="au-q" type="search" className="input pl-9" maxLength={60} placeholder="Admin və ya hədəf adı..." value={draft} onChange={(e) => setDraft(e.target.value)} />
        </div>
        <div>
          <label htmlFor="au-group" className="sr-only">Əməliyyat qrupu</label>
          <select id="au-group" className="input" disabled={!f} value={f?.group || ''} onChange={(e) => update({ group: e.target.value })}>
            {AUDIT_GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="au-from" className="sr-only">Başlanğıc tarixi</label>
          <input id="au-from" type="date" className="input" disabled={!f} aria-label="Başlanğıc tarixi" value={f?.from || ''} max={f?.to || undefined} onChange={(e) => update({ from: e.target.value })} />
        </div>
        <div>
          <label htmlFor="au-to" className="sr-only">Son tarix</label>
          <input id="au-to" type="date" className="input" disabled={!f} aria-label="Son tarix" value={f?.to || ''} min={f?.from || undefined} onChange={(e) => update({ to: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary">Axtar</button>
          {has && <button type="button" className="btn btn-secondary" onClick={() => { setDraft(''); update({ group: '', q: '', from: '', to: '' }); }}>Təmizlə</button>}
        </div>
      </form>

      <p className="mb-3 text-xs text-muted" aria-live="polite">{!f || list.loading ? 'Yüklənir…' : `${list.total} qeyd`}</p>
      {list.error && <Alert type="error" className="mb-4">{list.error} 07 SQL miqrasiyasının işləndiyini yoxlayın.</Alert>}
      {!f || list.loading ? <ListSkeleton count={4} /> : list.rows.length === 0 && !list.error ? (
        <EmptyState icon="list" title="Qeyd tapılmadı" text={has ? 'Filtrləri dəyişin.' : 'Hələ qeyd olunan admin əməliyyatı yoxdur.'} />
      ) : list.rows.length > 0 && (
        <Table label="Audit jurnalı" head={['Vaxt', 'Admin', 'Əməliyyat', 'Hədəf', 'Təfərrüat']}>
          {list.rows.map((a) => {
            const link = a.target_id && TARGET_LINK[a.target_type] ? TARGET_LINK[a.target_type](a.target_id) : '';
            return (
              <tr key={a.id} data-testid="audit-row">
                <Td className="whitespace-nowrap text-muted">{fmtDateTime(a.created_at)}</Td>
                <Td>{a.actor_label || 'Sistem'}</Td>
                <Td>
                  <span className="font-medium">{actionLabel(a.action)}</span>
                  <div className="text-xs text-muted">{a.action}</div>
                </Td>
                <Td className="max-w-[16rem] break-words">
                  {a.target_label ? (link ? <Link href={link} className="text-primary hover:underline">{a.target_label}</Link> : a.target_label) : '—'}
                  {a.target_type && <div className="text-xs text-muted">{TARGET_TYPE[a.target_type] || a.target_type}</div>}
                </Td>
                <Td className="max-w-[18rem] break-words text-xs text-muted">{detailText(a.details) || '—'}</Td>
              </tr>
            );
          })}
        </Table>
      )}
      <LoadMore onClick={list.more} loading={list.moreLoading} hasMore={list.hasMore} />
    </div>
  );
}
