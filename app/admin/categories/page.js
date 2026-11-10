'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { Table, Td } from '../../../components/admin/Table';
import Icon from '../../../components/Icons';
import { Alert, ConfirmDialog, EmptyState, ListSkeleton, Modal, PageHeader, Spinner } from '../../../components/ui';
import { loadCategories } from '../../../lib/forum';
import { errText } from '../../../lib/format';

function CategoryForm({ cat, onClose, onSaved }) {
  const [name, setName] = useState(cat?.name || '');
  const [description, setDescription] = useState(cat?.description || '');
  const [sort, setSort] = useState(String(cat?.sort_order ?? 100));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lock = useRef(false);

  async function submit(e) {
    e.preventDefault();
    if (lock.current) return;
    const nm = name.trim().replace(/\s+/g, ' ');
    if (nm.length < 2 || nm.length > 60) { setErr('Ad 2–60 simvol olmalıdır.'); return; }
    const n = Number(sort);
    if (!Number.isInteger(n) || n < 0 || n > 10000) { setErr('Sıra 0–10000 arasında tam ədəd olmalıdır.'); return; }
    lock.current = true;
    setBusy(true);
    setErr('');
    const { error } = await supabase.rpc('admin_upsert_category', { p_id: cat ? cat.id : null, p_name: nm, p_description: description.trim() || null, p_sort: n });
    setBusy(false);
    lock.current = false;
    if (error) { setErr(errText(error)); return; }
    onSaved(cat ? 'Kateqoriya yeniləndi.' : 'Kateqoriya yaradıldı.');
  }

  return (
    <Modal open onClose={() => { if (!busy) onClose(); }} title={cat ? 'Kateqoriyanı redaktə et' : 'Yeni kateqoriya'}>
      <form onSubmit={submit} className="mt-3 space-y-4" noValidate>
        <div>
          <label htmlFor="cat-name" className="label">Ad</label>
          <input id="cat-name" className="input" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <p className="hint">2–60 simvol. Ad unikal olmalıdır.</p>
        </div>
        <div>
          <label htmlFor="cat-desc" className="label">Təsvir <span className="font-normal text-muted">(könüllü)</span></label>
          <textarea id="cat-desc" rows={2} maxLength={200} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label htmlFor="cat-sort" className="label">Sıra nömrəsi</label>
          <input id="cat-sort" type="number" inputMode="numeric" min={0} max={10000} className="input" value={sort} onChange={(e) => setSort(e.target.value)} />
          <p className="hint">Kiçik rəqəm siyahıda yuxarıda görünür.</p>
        </div>
        {err && <Alert type="error">{err}</Alert>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Ləğv et</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}{cat ? 'Yadda saxla' : 'Yarat'}</button>
        </div>
      </form>
    </Modal>
  );
}

// Forum kateqoriyaları. Silmə yoxdur: istifadə olunan kateqoriya təhlükəsiz şəkildə deaktiv edilir
// (mövcud mövzular qalır və oxunur, yalnız yeni mövzu həmin kateqoriyada açıla bilmir).
export default function AdminCategoriesPage() {
  const [cats, setCats] = useState(null);
  const [counts, setCounts] = useState({});
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [form, setForm] = useState(null); // null | 'new' | cat
  const [toggle, setToggle] = useState(null); // cat
  const [busy, setBusy] = useState(false);
  const [togErr, setTogErr] = useState('');

  const load = useCallback(async () => {
    const list = await loadCategories();
    if (!list.length) { setErr('Kateqoriyalar yüklənmədi və ya hələ yaradılmayıb. 06 SQL miqrasiyasının işləndiyini yoxlayın.'); setCats([]); return; }
    setErr('');
    setCats(list);
    const res = await Promise.all(list.map((c) => supabase.from('forum_topics').select('id', { count: 'exact', head: true }).eq('category_id', c.id).neq('status', 'deleted')));
    const m = {};
    list.forEach((c, i) => { m[c.id] = res[i].count ?? 0; });
    setCounts(m);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runToggle() {
    setBusy(true);
    setTogErr('');
    const { error } = await supabase.rpc('admin_set_category_active', { p_id: toggle.id, p_active: !toggle.is_active });
    setBusy(false);
    if (error) { setTogErr(errText(error)); return; }
    setFlash(toggle.is_active ? 'Kateqoriya deaktiv edildi.' : 'Kateqoriya yenidən aktivləşdirildi.');
    setToggle(null);
    load();
  }

  const activeCount = (cats || []).filter((c) => c.is_active).length;

  return (
    <div>
      <PageHeader title="Forum kateqoriyaları" subtitle="Yeni kateqoriya yaradın, adını dəyişin və ya istifadədən çıxarın."
        action={<button className="btn btn-primary" onClick={() => setForm('new')}><Icon name="plus" className="h-4 w-4" />Yeni kateqoriya</button>} />
      {flash && <Alert type="success" className="mb-4">{flash}</Alert>}
      {err && <Alert type="error" className="mb-4">{err}</Alert>}
      {cats === null ? <ListSkeleton count={3} /> : cats.length === 0 ? (
        <EmptyState icon="folder" title="Kateqoriya yoxdur" text="İlk kateqoriyanı yaradın." />
      ) : (
        <Table label="Forum kateqoriyaları" head={['Ad', 'Təsvir', 'Sıra', 'Mövzu', 'Vəziyyət', 'Əməliyyatlar']}>
          {cats.map((c) => (
            <tr key={c.id} data-testid="category-row">
              <Td>
                <Link href={`/forum?category=${c.slug}`} className="font-medium text-ink hover:text-primary hover:underline">{c.name}</Link>
                <div className="text-xs text-muted">{c.slug}</div>
              </Td>
              <Td className="max-w-xs break-words text-muted">{c.description || '—'}</Td>
              <Td className="text-muted">{c.sort_order}</Td>
              <Td className="text-muted">{counts[c.id] ?? '…'}</Td>
              <Td>{c.is_active ? <span className="badge">Aktiv</span> : <span className="badge badge-muted">Deaktiv</span>}</Td>
              <Td>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <button className="btn btn-secondary btn-sm" onClick={() => setForm(c)}>Redaktə</button>
                  {c.is_active
                    ? <button className="btn btn-danger btn-sm" onClick={() => { setToggle(c); setTogErr(''); }} disabled={activeCount <= 1} title={activeCount <= 1 ? 'Ən azı bir aktiv kateqoriya qalmalıdır' : undefined}>Deaktiv et</button>
                    : <button className="btn btn-secondary btn-sm" onClick={() => { setToggle(c); setTogErr(''); }}>Aktivləşdir</button>}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {form && <CategoryForm key={form === 'new' ? 'new' : form.id} cat={form === 'new' ? null : form} onClose={() => setForm(null)}
        onSaved={(m) => { setForm(null); setFlash(m); load(); }} />}

      <ConfirmDialog open={!!toggle} danger={!!toggle?.is_active} busy={busy} error={togErr}
        title={toggle?.is_active ? 'Kateqoriyanı deaktiv et?' : 'Kateqoriyanı aktivləşdir?'}
        confirmLabel={toggle?.is_active ? 'Deaktiv et' : 'Aktivləşdir'} onConfirm={runToggle} onClose={() => setToggle(null)}>
        {toggle?.is_active
          ? <>«{toggle.name}» kateqoriyasında yeni mövzu açmaq mümkün olmayacaq. Mövcud {counts[toggle.id] ?? 0} mövzu silinmir, oxunmağa və cavablara davam edir. İstənilən vaxt yenidən aktivləşdirə bilərsiniz.</>
          : <>«{toggle?.name}» kateqoriyasında yenidən mövzu açmaq mümkün olacaq.</>}
      </ConfirmDialog>
    </div>
  );
}
