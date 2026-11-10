import Link from 'next/link';

// Dashboard göstəricisi. Rəqəm bazadan gəlir; value null/undefined olarsa "—" göstərilir (saxta 0 yox).
export default function StatCard({ label, value, href, tone = 'default' }) {
  const shown = value === null || value === undefined ? '—' : Number(value).toLocaleString('az-AZ');
  const toneCls = tone === 'warn' && Number(value) > 0 ? 'border-warning/40 bg-warning-soft' : tone === 'danger' && Number(value) > 0 ? 'border-danger/30 bg-danger-soft' : '';
  const body = (
    <>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tracking-tight text-ink">{shown}</dd>
    </>
  );
  return href ? (
    <Link href={href} className={`card block p-4 transition-shadow hover:shadow-pop ${toneCls}`}><dl>{body}</dl></Link>
  ) : (
    <div className={`card p-4 ${toneCls}`}><dl>{body}</dl></div>
  );
}
