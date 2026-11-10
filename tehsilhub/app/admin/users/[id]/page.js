'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../components/AuthProvider';
import AccountBadge from '../../../../components/AccountBadge';
import Icon from '../../../../components/Icons';
import { Alert, ConfirmDialog, EmptyState, ListSkeleton, Modal, Spinner } from '../../../../components/ui';
import { BLOCK_PRESETS, blockUntil, levelLabel } from '../../../../lib/admin';
import { ACCOUNT_TYPES } from '../../../../lib/roles';
import { isUuid } from '../../../../lib/forum';
import { errText, fmtBlockUntil, fmtDate, fmtDateTime } from '../../../../lib/format';

function Card({ title, id, children, tone = '' }) {
  return (
    <section aria-labelledby={id} className={`card p-5 ${tone}`}>
      <h2 id={id} className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, children }) {
  return (
    <div className="rounded-lg bg-canvas px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{children || '—'}</dd>
    </div>
  );
}

// İstifadəçi profili (admin): hesab tipi, bloklama, admin qeydləri, hesabı silmə, admin hüququ (yalnız Super Admin).
// Bütün dəyişikliklər admin RPC-ləri ilə gedir; hər biri bazada təkrar yoxlanılır və audit jurnalına yazılır.
export default function AdminUserPage() {
  const params = useParams();
  const raw = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const id = isUuid(raw) ? raw : '';
  const router = useRouter();
  const { user, me } = useAuth();
  const [u, setU] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | missing | error
  const [flash, setFlash] = useState({ type: '', text: '' });

  const [typeSel, setTypeSel] = useState('');
  const [typeBusy, setTypeBusy] = useState(false);
  const [preset, setPreset] = useState('7');
  const [reason, setReason] = useState('');
  const [blockBusy, setBlockBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [note, setNote] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [dlg, setDlg] = useState(null); // 'unblock' | 'grant' | 'revoke' | null
  const [dlgBusy, setDlgBusy] = useState(false);
  const [dlgErr, setDlgErr] = useState('');
  const [delOpen, setDelOpen] = useState(false);
  const [delEmail, setDelEmail] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.rpc('admin_get_user', { p_id: id });
    if (error) { setState(/tapılmadı|P0002/i.test(error.message || '') ? 'missing' : 'error'); return; }
    setU(data);
    setTypeSel(data.account_type || '');
    setState('ready');
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const say = (type, text) => setFlash({ type, text });

  async function saveType(e) {
    e.preventDefault();
    if (typeBusy || !typeSel) return;
    setTypeBusy(true);
    const { error } = await supabase.rpc('admin_set_account_type', { p_user: id, p_type: typeSel });
    setTypeBusy(false);
    if (error) { say('error', errText(error)); return; }
    say('success', 'Hesab tipi dəyişdirildi.');
    load();
  }

  async function doBlock() {
    setBlockBusy(true);
    const { error } = await supabase.rpc('admin_block_user', { p_user: id, p_until: blockUntil(preset), p_reason: reason.trim() || null });
    setBlockBusy(false);
    setConfirmBlock(false);
    if (error) { say('error', errText(error)); return; }
    setReason('');
    say('success', 'İstifadəçi bloklandı. Bu müddətdə forumda yaza, elan, PDF və mesaj göndərə bilməyəcək.');
    load();
  }

  async function addNote(e) {
    e.preventDefault();
    if (noteBusy || !note.trim()) return;
    setNoteBusy(true);
    const { error } = await supabase.rpc('admin_add_user_note', { p_user: id, p_note: note.trim() });
    setNoteBusy(false);
    if (error) { say('error', errText(error)); return; }
    setNote('');
    say('success', 'Qeyd əlavə edildi.');
    load();
  }

  async function runDialog() {
    setDlgBusy(true);
    setDlgErr('');
    const fn = dlg === 'unblock' ? ['admin_unblock_user', { p_user: id }] : dlg === 'grant' ? ['admin_grant_admin', { p_user: id }] : ['admin_revoke_admin', { p_user: id }];
    const { error } = await supabase.rpc(fn[0], fn[1]);
    setDlgBusy(false);
    if (error) { setDlgErr(errText(error)); return; }
    setDlg(null);
    say('success', dlg === 'unblock' ? 'Blok götürüldü.' : dlg === 'grant' ? 'Admin hüququ verildi.' : 'Admin hüququ ləğv edildi.');
    load();
  }

  async function doDelete(e) {
    e.preventDefault();
    if (delBusy) return;
    setDelBusy(true);
    setDelErr('');
    const { error } = await supabase.rpc('admin_delete_user', { p_user: id, p_confirm_email: delEmail.trim() });
    setDelBusy(false);
    if (error) { setDelErr(errText(error)); return; }
    router.push('/admin/users');
  }

  if (!id || state === 'missing') {
    return <EmptyState icon="user" title="İstifadəçi tapılmadı" text="Hesab mövcud deyil və ya silinib." action={<Link href="/admin/users" className="btn btn-primary">İstifadəçilərə qayıt</Link>} />;
  }
  if (state === 'loading') return <ListSkeleton count={3} />;
  if (state === 'error') return <Alert type="error">İstifadəçi yüklənmədi. Səhifəni yeniləyin.</Alert>;

  const self = !!user && user.id === u.id;
  const isAdminTarget = !!u.admin_level || u.legacy_role === 'admin';
  const blocked = !!u.blocked_until;
  const name = u.full_name || 'Adsız';

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"><Icon name="arrowLeft" className="h-4 w-4" />İstifadəçilər</Link>

      <div className="card mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary text-xl font-bold text-white" aria-hidden="true">{name[0].toUpperCase()}</div>
          <div className="min-w-0">
            <h1 className="break-words text-xl font-bold tracking-tight">{name}{self && <span className="ml-2 text-sm font-medium text-muted">(siz)</span>}</h1>
            <p className="break-all text-sm text-muted">{u.email}</p>
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              <AccountBadge type={u.account_type} />
              {u.admin_level && <span className="badge bg-ink text-white"><Icon name="shield" className="h-3 w-3" />{levelLabel(u.admin_level)}</span>}
              {!u.admin_level && u.legacy_role === 'admin' && <span className="badge bg-ink text-white"><Icon name="shield" className="h-3 w-3" />Admin (köhnə üsul)</span>}
              {blocked && <span className="badge border border-danger/30 bg-danger-soft text-danger"><Icon name="ban" className="h-3 w-3" />Bloklanıb</span>}
            </p>
          </div>
        </div>
        <Link href={`/u/${u.id}`} className="btn btn-secondary btn-sm"><Icon name="external" className="h-4 w-4" />İctimai profil</Link>
      </div>

      {flash.text && <Alert type={flash.type} className="mb-4">{flash.text}</Alert>}

      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Qeydiyyat">{fmtDate(u.created_at)}</Fact>
        <Fact label="Son giriş">{u.last_sign_in_at ? fmtDateTime(u.last_sign_in_at) : ''}</Fact>
        <Fact label="E-poçt">{u.email_confirmed ? 'Təsdiqlənib' : 'Təsdiqlənməyib'}</Fact>
        <Fact label="Şəhər">{u.city}</Fact>
        <Fact label="Forum mövzusu">{u.topic_count}</Fact>
        <Fact label="Cavab">{u.reply_count}</Fact>
        <Fact label="Elan">{u.book_count}</Fact>
        <Fact label="PDF">{u.pdf_count}</Fact>
      </dl>
      {u.bio && <p className="card mb-5 whitespace-pre-wrap break-words p-4 text-sm text-ink/85">{u.bio}</p>}

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Hesab tipi" id="s-type">
          <form onSubmit={saveType} className="space-y-3">
            <div>
              <label htmlFor="s-type-sel" className="label">Tip</label>
              <select id="s-type-sel" className="input" value={typeSel} onChange={(e) => setTypeSel(e.target.value)}>
                {!u.account_type && <option value="">Seçilməyib</option>}
                {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <p className="hint">«Admin» tipi yoxdur: admin hüququ ayrıca, yalnız Super Admin tərəfindən verilir.</p>
            </div>
            <button className="btn btn-primary btn-sm" disabled={typeBusy || !typeSel || typeSel === u.account_type}>{typeBusy && <Spinner />}Yadda saxla</button>
          </form>
        </Card>

        <Card title="Bloklama" id="s-block" tone={blocked ? 'border-danger/30 bg-danger-soft/40' : ''}>
          {blocked ? (
            <div className="space-y-3">
              <p className="text-sm"><span className="font-semibold text-danger">Bloklanıb:</span> {fmtBlockUntil(u.blocked_until)}</p>
              {u.block_reason && <p className="break-words text-sm text-muted">Səbəb: {u.block_reason}</p>}
              <button className="btn btn-secondary btn-sm" onClick={() => { setDlg('unblock'); setDlgErr(''); }}>Blokdan çıxar</button>
            </div>
          ) : isAdminTarget || self ? (
            <p className="text-sm text-muted">{self ? 'Özünüzü bloklaya bilməzsiniz.' : 'Admin hesabı bloklana bilməz. Əvvəlcə admin hüququ ləğv edilməlidir.'}</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setConfirmBlock(true); }} className="space-y-3">
              <div>
                <label htmlFor="s-preset" className="label">Müddət</label>
                <select id="s-preset" className="input" value={preset} onChange={(e) => setPreset(e.target.value)}>
                  {BLOCK_PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="s-reason" className="label">Səbəb <span className="font-normal text-muted">(könüllü, istifadəçiyə bildirişdə göstərilir)</span></label>
                <textarea id="s-reason" rows={2} maxLength={300} className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <button className="btn btn-danger btn-sm"><Icon name="ban" className="h-4 w-4" />Blokla</button>
              <p className="hint">Bloklanmış istifadəçi forumda mövzu və cavab yaza, şikayət göndərə, elan, PDF və mesaj əlavə edə bilməz.</p>
            </form>
          )}
        </Card>

        {me.isSuperAdmin && (
          <Card title="Admin hüququ" id="s-admin">
            {u.admin_level === 'super' ? (
              <p className="text-sm text-muted">Super Admin hüququ yalnız server tərəfində (SQL) dəyişdirilə bilər.</p>
            ) : u.admin_level === 'admin' ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">Bu istifadəçi adi adminidir.</p>
                {!self && <button className="btn btn-danger btn-sm" onClick={() => { setDlg('revoke'); setDlgErr(''); }}>Admin hüququnu ləğv et</button>}
              </div>
            ) : u.legacy_role === 'admin' ? (
              <p className="text-sm text-muted">Admin hüququ köhnə üsulla (profil rolu) verilib. Dəyişmək üçün SQL Editor lazımdır.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted">Adi admin istifadəçiləri, forumu və məzmunu idarə edir; yeni admin təyin edə bilməz.</p>
                <button className="btn btn-secondary btn-sm" disabled={!u.email_confirmed} onClick={() => { setDlg('grant'); setDlgErr(''); }}>Admin et</button>
                {!u.email_confirmed && <p className="hint">E-poçtu təsdiqlənməyən hesaba admin hüququ verilmir.</p>}
              </div>
            )}
          </Card>
        )}

        <Card title="Admin qeydləri" id="s-notes">
          <form onSubmit={addNote} className="space-y-2">
            <label htmlFor="s-note" className="sr-only">Yeni qeyd</label>
            <textarea id="s-note" rows={2} maxLength={1000} className="input" placeholder="Yalnız adminlərə görünən qeyd…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn-secondary btn-sm" disabled={noteBusy || !note.trim()}>{noteBusy && <Spinner />}Qeyd əlavə et</button>
          </form>
          {(u.notes || []).length === 0 ? <p className="mt-3 text-sm text-muted">Hələ qeyd yoxdur.</p> : (
            <ul className="mt-3 space-y-2">
              {u.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-canvas px-3 py-2">
                  <p className="whitespace-pre-wrap break-words text-sm">{n.note}</p>
                  <p className="mt-1 text-xs text-muted">{n.author_name} · {fmtDateTime(n.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section aria-labelledby="s-danger" className="card mt-5 border-danger/30 p-5">
        <h2 id="s-danger" className="text-base font-semibold text-danger">Təhlükəli zona</h2>
        {self || isAdminTarget ? (
          <p className="mt-1 text-sm text-muted">{self ? 'Öz hesabınızı admin panelindən silə bilməzsiniz.' : 'Admin hesabı silinə bilməz. Əvvəlcə admin hüququ ləğv edilməlidir.'}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">Hesab, elanlar, PDF-lər, mesajlar və sınaq nəticələri birdəfəlik silinir. Forum mövzu və cavabları saxlanılır, müəllif «Silinmiş istifadəçi» kimi görünür. Bu əməliyyat geri qaytarıla bilməz.</p>
            <button className="btn btn-danger mt-4" onClick={() => { setDelOpen(true); setDelEmail(''); setDelErr(''); }}><Icon name="trash" className="h-4 w-4" />Hesabı sil</button>
          </>
        )}
      </section>

      <ConfirmDialog open={confirmBlock} danger busy={blockBusy} confirmLabel="Blokla" title="İstifadəçini blokla" onClose={() => setConfirmBlock(false)} onConfirm={doBlock}>
        <strong className="text-ink">{name}</strong> {BLOCK_PRESETS.find((p) => p[0] === preset)?.[1].toLowerCase()} bloklanacaq. Bu əməliyyat audit jurnalına yazılır.
      </ConfirmDialog>

      <ConfirmDialog open={!!dlg} danger={dlg === 'revoke'} busy={dlgBusy} error={dlgErr}
        title={dlg === 'unblock' ? 'Blokdan çıxar' : dlg === 'grant' ? 'Admin hüququ ver' : 'Admin hüququnu ləğv et'}
        confirmLabel={dlg === 'unblock' ? 'Blokdan çıxar' : dlg === 'grant' ? 'Admin et' : 'Ləğv et'} onClose={() => setDlg(null)} onConfirm={runDialog}>
        {dlg === 'grant' ? <><strong className="text-ink">{name}</strong> adi admin olacaq: istifadəçiləri, forumu və məzmunu idarə edə biləcək. Davam edək?</> : dlg === 'revoke' ? <><strong className="text-ink">{name}</strong> artıq admin olmayacaq. Davam edək?</> : <><strong className="text-ink">{name}</strong> yenidən yaza bilər. Davam edək?</>}
      </ConfirmDialog>

      <Modal open={delOpen} onClose={() => { if (!delBusy) setDelOpen(false); }} title="Hesabı birdəfəlik sil">
        <form onSubmit={doDelete}>
          <p className="mt-2 text-sm text-muted"><strong className="text-ink">{name}</strong> hesabı və əlaqəli verilənlər silinəcək. Təsdiq üçün hesabın e-poçt ünvanını yazın: <span className="break-all font-semibold text-ink">{u.email}</span></p>
          <label htmlFor="del-email" className="sr-only">Təsdiq e-poçtu</label>
          <input id="del-email" className="input mt-4" autoComplete="off" value={delEmail} onChange={(e) => setDelEmail(e.target.value)} placeholder={u.email} />
          {delErr && <Alert type="error" className="mt-3">{delErr}</Alert>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" disabled={delBusy} onClick={() => setDelOpen(false)}>Ləğv et</button>
            <button className="btn bg-danger text-white hover:bg-danger/90" disabled={delBusy || delEmail.trim().toLowerCase() !== String(u.email || '').toLowerCase()}>{delBusy && <Spinner />}Hesabı sil</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
