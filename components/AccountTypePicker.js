'use client';
import Icon from './Icons';
import { ACCOUNT_TYPES } from '../lib/roles';

// "Mən kiməm?" seçimi: 3 kart (radio qrupu). Klaviatura (oxlar, Tab, Space) və toxunma ilə işləyir.
export default function AccountTypePicker({ value, onChange, name = 'account_type', disabled = false, legend = 'Mən kiməm?' }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="label">{legend} <span className="text-danger" aria-hidden="true">*</span></legend>
      <div className="grid gap-2" role="radiogroup" aria-label={legend} aria-required="true">
        {ACCOUNT_TYPES.map((t) => {
          const selected = value === t.value;
          return (
            <label key={t.value} className="relative block cursor-pointer">
              <input type="radio" name={name} value={t.value} checked={selected} required
                onChange={() => onChange(t.value)} className="peer sr-only" />
              <span className={`flex items-center gap-3 rounded-xl border p-3 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary ${selected ? 'border-primary bg-primary-soft ring-2 ring-primary/25' : 'border-line bg-surface hover:border-primary/50 hover:bg-canvas'}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${selected ? 'bg-primary text-white' : 'bg-primary-soft text-primary'}`}>
                  <Icon name={t.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{t.label}</span>
                  <span className="block text-xs text-muted">{t.desc}</span>
                </span>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? 'border-primary bg-primary text-white' : 'border-line bg-surface'}`} aria-hidden="true">
                  {selected && <Icon name="check" className="h-3 w-3" />}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
