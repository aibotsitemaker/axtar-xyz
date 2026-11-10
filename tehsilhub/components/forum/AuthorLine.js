import Link from 'next/link';
import AccountBadge from '../AccountBadge';

// Müəllif adı (profilə keçid) + hesab tipi nişanı. Nişan yalnız bazadakı profil məlumatından gəlir.
export default function AuthorLine({ id, profile, avatar = false, className = '' }) {
  const name = (profile && profile.full_name && profile.full_name.trim()) || (id ? 'İstifadəçi' : 'Silinmiş istifadəçi');
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {avatar && (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary" aria-hidden="true">{name[0]?.toUpperCase()}</span>
      )}
      {id ? (
        <Link href={`/u/${id}`} className="font-medium text-ink hover:text-primary hover:underline">{name}</Link>
      ) : (
        <span className="font-medium text-muted">{name}</span>
      )}
      <AccountBadge type={profile?.account_type} />
    </span>
  );
}
