'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../components/AuthProvider';
import AccountBadge from '../../../components/AccountBadge';
import { Table, Td } from '../../../components/admin/Table';
import Icon from '../../../components/Icons';
import { Alert, ConfirmDialog, EmptyState, ListSkeleton, PageHeader, Spinner } from '../../../components/ui';
import { levelLabel } from '../../../lib/admin';
import { errText, fmtDate } from '../../../lib/format';

// Admin hüquqlarının siyahısı. Yeni admin təyin etmək və ləğv etmək YALNIZ Super Admin üçündür (server bunu admin RPC-lərində yoxlayır).
// "Super Admin" səviyyəsi brauzerdən verilə bilməz: yalnız 08_bootstrap_super_admin.sql ilə (SQL Editor) təyin olunur.
export default function AdminAdminsPage() {
  const { user, me } = useAuth();
  const isSuper = me.isSuperAdmin;
  const [admins, setAdmins] = useState(null);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');

  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const seq = useRef(0);

  const [dlg, setDlg] = useState(null); // { kind: 'grant' | 'revoke', id, name }
  const [busy, setBusy] = useState(false);
  const [dlgErr, setDlgErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_admins');
    if (error) { setErr(errText(error, 'Adminlər siyahısı yüklənmədi. 07 SQL miqrasiyasının işləndiyini yoxlayın.')); setAdmins([]); return; }
    setErr('');
    setAdmins(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function search(e) {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) { setSearchErr('Ən azı 2 simvol yazın.'); return; }
    const mine = ++seq.current;
    setSearching(true);
    setSearchErr('');
    const { data, error } = await supabase.rpc('admin_list_users', { p_search: term, p_type: null, p_state: 'all', p_limit: 8, p_offset: 0 });
    if (mine !== seq.current) return;
    setSearching(false);
    if (error) { setSearchErr(errText(error)); setResults([]); return; }
    setResults(data || []);
  }

  async function run() {
    setBusy(true);
    setDlgErr('');
    const fn = dlg.kind === 'grant' ? 'admin_grant_admin' : 'admin_revoke_admin';
    const { error } = await supabase.rpc(fn, { p_user: dlg.id });
    setBusy(false);
    if (error) { setDlgErr(errText(error)); return; }
    setFlash(dlg.kind === 'grant' ? `${dlg.name} admin təyin edildi.` : `${dlg.name} adlı istifadəçinin admin hüququ ləğv edildi.`);
    setDlg(null);
    setResults(null);
    setQ('');
    load();
  }

  return (
    <div>
      <PageHeader title="Adminlər" subtitle="Admin hüquqları e-poçt mətninə deyil, Auth istifadəçi ID-sinə bağlıdır və yalnız serverdə verilir." />
      {flash && <Alert type="success" className="mb-4">{flash}</Alert>}
      {err && <Alert type="error" className="mb-4">{err}</Alert>}

      {admins === null ? <ListSkeleton count={2} /> : admins.length === 0 && !err ? (
        <EmptyState icon="shield" title="Admin qeydi yoxdur" text="İlk Super Admin 08_bootstrap_super_admin.sql ilə təyin olunur (ADMIN_SETUP.md)." />
      ) : admins.length > 0 && (
        <Table label="Adminlər" head={['Ad', 'E-poçt', 'Səviyyə', 'Təyin tarixi', '']}>
          {admins.map((a) => (
            <tr key={a.user_id} data-testid="admin-row">
              <Td><Link href={`/admin/users/${a.user_id}`} className="font-medium text-ink hover:text-primary hover:underline">{a.full_name || 'Adsız'}</Link>{user && a.user_id === user.id && <span className="ml-2 text-xs text-muted">(siz)</span>}</Td>
              <Td className="break-all text-muted">{a.email}</Td>
              <Td><span className="badge bg-ink text-white"><Icon name="shield" className="h-3 w-3" />{levelLabel(a.level)}</span></Td>
              <Td className="whitespace-nowrap text-muted">{fmtDate(a.created_at)}</Td>
              <Td className="text-right">
                {isSuper && a.level !== 'super' && (!user || a.user_id !== user.id) && (
                  <button className="btn btn-danger btn-sm" onClick={() => { setDlg({ kind: 'revoke', id: a.user_id, name: a.full_name || a.email }); setDlgErr(''); }}>Hüququ ləğv et</button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <section className="card mt-8 p-5" aria-labelledby="grant-title">
        <h2 id="grant-title" className="text-base font-semibold">Yeni admin təyin et</h2>
        {!isSuper ? (
          <Alert type="info" className="mt-3">Admin təyin etmək və ya ləğv etmək yalnız Super Admin üçündür.</Alert>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">Ad və ya e-poçt ilə axtarın. Yalnız e-poçtu təsdiqlənmiş istifadəçi admin ola bilər. Yeni admin həmişə «Admin» səviyyəsindədir (Super Admin deyil).</p>
            <form onSubmit={search} role="search" aria-label="Admin üçün istifadəçi axtarışı" className="mt-4 flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <label htmlFor="ga-q" className="sr-only">Ad və ya e-poçt</label>
                <input id="ga-q" type="search" className="input" maxLength={100} placeholder="Ad və ya e-poçt..." value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <button className="btn btn-primary" disabled={searching}>{searching && <Spinner />}Axtar</button>
            </form>
            {searchErr && <Alert type="error" className="mt-3">{searchErr}</Alert>}
            {results && (results.length === 0 ? <p className="mt-4 text-sm text-muted">İstifadəçi tapılmadı.</p> : (
              <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
                {results.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" data-testid="grant-result">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">{u.full_name || 'Adsız'} {u.account_type && <AccountBadge type={u.account_type} />}</p>
                      <p className="break-all text-xs text-muted">{u.email}{u.email_confirmed ? '' : ' · e-poçt təsdiqsiz'}</p>
                    </div>
                    {u.admin_level ? <span className="badge badge-muted">Artıq {levelLabel(u.admin_level)}</span>
                      : <button className="btn btn-secondary btn-sm" disabled={!u.email_confirmed} onClick={() => { setDlg({ kind: 'grant', id: u.id, name: u.full_name || u.email }); setDlgErr(''); }}>Admin et</button>}
                  </li>
                ))}
              </ul>
            ))}
          </>
        )}
      </section>

      <ConfirmDialog open={!!dlg} danger={dlg?.kind === 'revoke'} busy={busy} error={dlgErr}
        title={dlg?.kind === 'grant' ? 'Admin hüququ verilsin?' : 'Admin hüququ ləğv edilsin?'}
        confirmLabel={dlg?.kind === 'grant' ? 'Admin et' : 'Ləğv et'} onConfirm={run} onClose={() => setDlg(null)}>
        {dlg?.kind === 'grant'
          ? <>«{dlg?.name}» istifadəçilərə, forum moderasiyasına və məzmuna tam çıxış əldə edəcək. Bu əməliyyat audit jurnalında qeyd olunacaq.</>
          : <>«{dlg?.name}» admin panelinə çıxışı itirəcək. Hesabın özü silinmir.</>}
      </ConfirmDialog>
    </div>
  );
}
