import { STATUS_BADGE } from '../../lib/admin';

// Tam sinif adları (Tailwind dinamik adları tapa bilmir).
const TONE = {
  active: 'badge',
  hidden: 'badge badge-muted',
  deleted: 'badge border border-danger/30 bg-danger-soft text-danger',
  sold: 'badge bg-success-soft text-success'
};

export default function StatusBadge({ status }) {
  return <span className={TONE[status] || 'badge badge-muted'}>{STATUS_BADGE[status] || status}</span>;
}
