'use client';
import { useState } from 'react';
import Icon from '../../Icons';
import { searchLike } from '../../../lib/admin';

// Məzmun siyahıları üçün axtarış + status filtri (admin). statuses: [[dəyər, ad], ...]
export default function ContentFilter({ f, onApply, label, placeholder, statuses }) {
  const [draft, setDraft] = useState(f.q);
  const has = f.q || f.status;
  return (
    <form role="search" aria-label={label} className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]"
      onSubmit={(e) => { e.preventDefault(); onApply({ q: searchLike(draft) }); }}>
      <div className="relative">
        <label htmlFor="cf-q" className="sr-only">Axtarış</label>
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input id="cf-q" type="search" className="input pl-9" maxLength={60} placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} />
      </div>
      <div>
        <label htmlFor="cf-status" className="sr-only">Status</label>
        <select id="cf-status" className="input" value={f.status} onChange={(e) => onApply({ status: e.target.value })}>
          {statuses.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary">Axtar</button>
        {has && <button type="button" className="btn btn-secondary" onClick={() => { setDraft(''); onApply({ q: '', status: '' }); }}>Təmizlə</button>}
      </div>
    </form>
  );
}
