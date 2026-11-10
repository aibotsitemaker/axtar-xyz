'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, LoginPrompt } from '../AuthProvider';
import Icon from '../Icons';
import { EmptyState } from '../ui';

const TABS = [
  { href: '/admin', label: 'Dashboard', icon: 'grid', exact: true },
  { href: '/admin/users', label: 'İstifadəçilər', icon: 'users' },
  { href: '/admin/forum', label: 'Forum', icon: 'message' },
  { href: '/admin/reports', label: 'Şikayətlər', icon: 'flag' },
  { href: '/admin/feed-reports', label: 'Feed şikayətləri', icon: 'flag' },
  { href: '/admin/categories', label: 'Kateqoriyalar', icon: 'folder' },
  { href: '/admin/content', label: 'Məzmun', icon: 'book' },
  { href: '/admin/quizzes', label: 'Sınaqların təsdiqi', icon: 'quiz' },
  { href: '/admin/verification', label: 'Mavi tık', icon: 'shield' },
  { href: '/admin/audit', label: 'Audit jurnalı', icon: 'list' },
  { href: '/admin/admins', label: 'Adminlər', icon: 'shield' }
];

// Admin bölməsinin qabığı. Alt səhifələr YALNIZ admin təsdiqləndikdən sonra render olunur (heç bir admin sorğusu göndərilmir).
// Bu interfeys yoxlamasıdır; real qoruma hər admin RPC-də (assert_admin) və RLS-də bazada tətbiq olunur.
export default function AdminGuard({ children }) {
  const { user, loading, me } = useAuth();
  const path = usePathname();

  if (loading || (user && !me.loaded)) {
    return <div className="space-y-4" aria-busy="true" aria-label="Yüklənir"><div className="skeleton h-12" /><div className="skeleton h-64" /></div>;
  }
  if (!user) return <LoginPrompt text="Admin panelinə daxil olmaq üçün giriş edin." next="/admin" />;
  if (!me.isAdmin) {
    return <EmptyState icon="shield" title="İcazə yoxdur" text="Bu bölmə yalnız administratorlar üçündür." action={<Link href="/" className="btn btn-primary">Ana səhifəyə qayıt</Link>} />;
  }

  const active = (t) => (t.exact ? path === t.href : path === t.href || path.startsWith(`${t.href}/`));
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary-soft px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-white"><Icon name="shield" className="h-5 w-5" /></span>
          <div>
            <p className="text-base font-bold leading-tight text-ink">Admin paneli</p>
            <p className="text-xs text-muted">{me.isSuperAdmin ? 'Super Admin' : 'Admin'} · bütün əməliyyatlar audit jurnalında qeyd olunur</p>
          </div>
        </div>
        <Link href="/" className="btn btn-secondary btn-sm"><Icon name="external" className="h-4 w-4" />Sayta qayıt</Link>
      </div>
      <nav className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Admin bölmələri">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={active(t) ? 'page' : undefined}
            className={`btn btn-sm shrink-0 ${active(t) ? 'btn-primary' : 'btn-secondary'}`}>
            <Icon name={t.icon} className="h-4 w-4" />{t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
