import Icon from './Icons';
import { accountIcon, accountLabel } from '../lib/roles';

// Hesab tipi nişanı ("Müəllim", "Şagird", "Tələbə"). Dəyər yalnız bazadakı profildən gəlir.
export default function AccountBadge({ type, className = '' }) {
  const label = accountLabel(type);
  if (!label) return null;
  return (
    <span className={`badge ${className}`} data-account-type={type}>
      <Icon name={accountIcon(type)} className="h-3 w-3" />{label}
    </span>
  );
}
