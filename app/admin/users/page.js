'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import AccountBadge from '../../../components/AccountBadge';
import Icon from '../../../components/Icons';
import { Table, Td } from '../../../components/admin/Table';
import { Alert, EmptyState, ListSkeleton, PageHeader, Spinner } from '../../../components/ui';
import { PAGE, USER_STATE_FILTERS, USER_TYPE_FILTERS, levelLabel } from '../../../lib/admin';
import { errText, fmtBlockUntil, fmtDate } from '../../../lib/format';

const TYPE_KEYS = USER_TYPE_FILTERS.map((t) => t[0]);
const STATE_KEYS = USER_STATE_FILTERS.map((t) => t[0]);

// İstifadəçilərin siyahısı: ad / e-poçt axtarışı, tip və vəziyyət filtri, səhifələmə.
// Məlumat admin_list_users() RPC-sindən gəlir; RPC hər çağırışda adminliyi bazada yoxlayır. Şifrələr heç vaxt əlçatan deyil.
export default function AdminUsersPage() {
  const [filters, setFilters] = useState(null); // { q, type, state }
  const [draft, setDraft] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const req = useRef(0);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const type = TYPE_KEYS.includes(sp.get('type')) ? sp.get('type') : '';
    const state = STATE_KEYS.includes(sp.get('state')) ? sp.get('state') : 'all';
    const q = (sp.get('q') || '').slice(0, 100);
    setDraft(q);
    setFilters({ q, type, state });
  }, []);

  const load = useCallback(async (f, p) => {
    const mine = ++req.current;
    setLoading(true);
    setErr('');
    const { data, error } = await supabase.rpc('admin_list_users', {
      p_search: f.q || null, p_type: f.type || null, p_state: f.state, p_limit: PAGE, p_offset: p * PAGE
    });
    if (mine !== req.current) return;
    setLoading(false);
    if (error) { setErr(errText(error, 'İstifadəçilər yüklənmədi. 07 SQL miqrasiyasının işləndiyini yoxlayın.')); setRows([]); setTotal(0); return; }
    setRows(data || []);
    setTotal(data && data.length ? Number(data[0].total_count) : 0);
  }, []);

  useEffect(() => { if (filters) load(filters, page); }, [filters, page, load]);

  function update(next) {
    const f = { ...filters, ...next };
    setPage(0);
    setFilters(f);
    const sp = new URLSearchParams();
    if (f.q) sp.set('q', f.q);
    if (f.type) sp.set('type', f.type);
    if (f.state !== 'all') sp.set('state', f.state);
    const qs = sp.toString();
    window.history.replaceState(null, '', qs ? `/admin/users?${qs}` : '/admin/users');
  }

  const from = total === 0 ? 0 : page * PAGE + 1;
  const to = Math.min(total, page * PAGE + rows.length);
  const hasFilter = filters && (filters.q || filters.type || filters.state !== 'all');

  return (
    <div>
      <PageHeader title="İstifadəçilər" subtitle="Ad, e-poçt, hesab tipi və qeydiyyat tarixi üzrə axtarış. Şifrələr göstərilmir." />

      <form role="search" aria-label="İstifadəçi axtarışı" className="card mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto]"
        onSubmit={(e) => { e.preventDefault(); if (filters) update({ q: draft.trim() }); }}>
        <div className="relative">
          <label htmlFor="u-q" className="sr-only">Ad və ya e-poçt</label>
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input id="u-q" type="search" className="input pl-9" maxLength={100} placeholder="Ad və ya e-poçt axtarın..." value={draft} onChange={(e) => setDraft(e.target.value)} />
        </div>
        <div>
          <label htmlFor="u-type" className="sr-only">Hesab tipi</label>
          <select id="u-type" className="input" disabled={!filters} value={filters?.type || ''} onChange={(e) => update({ type: e.target.value })}>
            {USER_TYPE_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="u-state" className="sr-only">Vəziyyət</label>
          <select id="u-state" className="input" disabled={!filters} value={filters?.state || 'all'} onChange={(e) => update({ state: e.target.value })}>
            {USER_STATE_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary">Axtar</button>
          {hasFilter && <button type="button" className="btn btn-secondary" onClick={() => { setDraft(''); update({ q: '', type: '', state: 'all' }); }}>Təmizlə</button>}
        </div>
      </form>

      {err && <Alert type="error" className="mb-4">{err}</Alert>}
      {loading ? <ListSkeleton count={4} /> : rows.length === 0 && !err ? (
        <EmptyState icon="users" title="İstifadəçi tapılmadı" text="Axtarışı və ya filtrləri dəyişin." />
      ) : rows.length > 0 && (
        <>
          <Table label="İstifadəçilər" head={['İstifadəçi', 'Hesab tipi', 'Qeydiyyat', 'Fəaliyyət', 'Vəziyyət', '']}>
            {rows.map((u) => (
              <tr key={u.id} data-testid="user-row">
                <Td>
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-ink hover:text-primary hover:underline">{u.full_name || 'Adsız'}</Link>
                  <div className="break-all text-xs text-muted">{u.email}</div>
                </Td>
                <Td>{u.account_type ? <AccountBadge type={u.account_type} /> : <span className="text-xs text-muted">seçilməyib</span>}</Td>
                <Td className="whitespace-nowrap text-muted">{fmtDate(u.created_at)}</Td>
                <Td className="whitespace-nowrap text-muted">{u.topic_count} mövzu · {u.reply_count} cavab</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {u.admin_level && <span className="badge bg-ink text-white"><Icon name="shield" className="h-3 w-3" />{levelLabel(u.admin_level)}</span>}
                    {u.blocked_until && <span className="badge border border-danger/30 bg-danger-soft text-danger"><Icon name="ban" className="h-3 w-3" />{fmtBlockUntil(u.blocked_until)}</span>}
                    {!u.email_confirmed && <span className="badge badge-muted">E-poçt təsdiqsiz</span>}
                  </div>
                </Td>
                <Td className="text-right"><Link href={`/admin/users/${u.id}`} className="btn btn-secondary btn-sm">Bax</Link></Td>
              </tr>
            ))}
          </Table>
          <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Səhifələmə">
            <p className="text-muted" aria-live="polite">{from}–{to} / {total}</p>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>Əvvəlki</button>
              <button className="btn btn-secondary btn-sm" disabled={to >= total || loading} onClick={() => setPage((p) => p + 1)}>{loading && <Spinner />}Növbəti</button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
