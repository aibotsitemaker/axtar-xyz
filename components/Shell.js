'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';
import Icon from './Icons';

const NAV = [
  { href: '/', label: 'Ana səhifə', exact: true },
  { href: '/quizzes', label: 'Sınaqlar' },
  { href: '/books', label: 'Kitab elanları' },
  { href: '/pdfs', label: 'PDF arxivi' },
  { href: '/chat', label: 'Çat' }
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink" aria-label="TəhsilHub — ana səhifə">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white"><Icon name="cap" className="h-5 w-5" /></span>
      TəhsilHub
    </Link>
  );
}

export default function Shell({ children }) {
  const path = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [menu, setMenu] = useState(false);
  const [drop, setDrop] = useState(false);
  const [unread, setUnread] = useState(0);
  const dropRef = useRef(null);

  const active = (n) => (n.exact ? path === n.href : path === n.href || path.startsWith(n.href + '/'));
  const name = user?.user_metadata?.full_name || user?.email || '';

  useEffect(() => { setMenu(false); setDrop(false); }, [path]);

  useEffect(() => {
    if (!drop) return undefined;
    const onDoc = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDrop(false); };
    const onKey = (e) => { if (e.key === 'Escape') setDrop(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [drop]);

  useEffect(() => {
    if (!user) { setUnread(0); return undefined; }
    let stop = false;
    const load = () => supabase.rpc('unread_message_count').then(({ data, error }) => { if (!stop && !error) setUnread(Number(data) || 0); });
    load();
    const t = setInterval(load, 60000);
    return () => { stop = true; clearInterval(t); };
  }, [user, path]);

  async function logout() {
    setDrop(false); setMenu(false);
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white">
        Əsas məzmuna keç
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Əsas menyu">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n) ? 'page' : undefined}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active(n) ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-canvas hover:text-ink'}`}>
                {n.label}
                {n.href === '/chat' && unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white" aria-label={`${unread} oxunmamış mesaj`}>{unread > 9 ? '9+' : unread}</span>
                )}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {!user ? (
              <>
                <Link href="/auth" className="btn btn-secondary btn-sm">Daxil ol</Link>
                <Link href="/auth?mode=register" className="btn btn-primary btn-sm">Qeydiyyat</Link>
              </>
            ) : (
              <div className="relative" ref={dropRef}>
                <button onClick={() => setDrop(!drop)} aria-haspopup="menu" aria-expanded={drop}
                  className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface pl-1.5 pr-2.5 hover:bg-canvas">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs font-bold text-white">{name[0]?.toUpperCase() || 'U'}</span>
                  <Icon name="chevronDown" className="h-4 w-4 text-muted" />
                </button>
                {drop && (
                  <div role="menu" className="card absolute right-0 mt-2 w-60 p-1.5 shadow-pop">
                    <div className="border-b border-line px-3 py-2">
                      <p className="truncate text-sm font-semibold">{user.user_metadata?.full_name || 'İstifadəçi'}</p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
                    </div>
                    <Link role="menuitem" href="/profile" className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-canvas"><Icon name="user" className="h-4 w-4 text-muted" />Kabinet</Link>
                    <Link role="menuitem" href="/chat" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-canvas"><Icon name="chat" className="h-4 w-4 text-muted" />Mesajlar{unread > 0 ? ` (${unread})` : ''}</Link>
                    <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft"><Icon name="logout" className="h-4 w-4" />Çıxış</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button className="grid h-10 w-10 place-items-center rounded-lg border border-line text-ink md:hidden"
            aria-label={menu ? 'Menyunu bağla' : 'Menyunu aç'} aria-expanded={menu} aria-controls="mobile-menu"
            onClick={() => setMenu(!menu)}>
            <Icon name={menu ? 'x' : 'menu'} />
          </button>
        </div>

        {menu && (
          <div id="mobile-menu" className="border-t border-line bg-surface md:hidden">
            <nav className="container-page flex flex-col gap-1 py-3" aria-label="Mobil menyu">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} aria-current={active(n) ? 'page' : undefined}
                  className={`flex min-h-11 items-center justify-between rounded-lg px-3 text-base font-medium ${active(n) ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-canvas'}`}>
                  {n.label}
                  {n.href === '/chat' && unread > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">{unread}</span>}
                </Link>
              ))}
              <div className="mt-2 grid gap-2 border-t border-line pt-3">
                {!user ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/auth" className="btn btn-secondary">Daxil ol</Link>
                    <Link href="/auth?mode=register" className="btn btn-primary">Qeydiyyat</Link>
                  </div>
                ) : (
                  <>
                    <Link href="/profile" className="btn btn-secondary"><Icon name="user" className="h-4 w-4" />Kabinet</Link>
                    <button onClick={logout} className="btn btn-danger"><Icon name="logout" className="h-4 w-4" />Çıxış</button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="main" className="container-page flex-1 py-6 sm:py-8">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-muted">Sınaqlar, ikinci əl kitablar, PDF resurslar və tələbələr arasında canlı ünsiyyət — hamısı bir platformada.</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Platforma</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><Link href="/quizzes" className="hover:text-primary">Sınaqlar</Link></li>
              <li><Link href="/books" className="hover:text-primary">Kitab elanları</Link></li>
              <li><Link href="/pdfs" className="hover:text-primary">PDF arxivi</Link></li>
              <li><Link href="/chat" className="hover:text-primary">Çat</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Hüquqi</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><Link href="/legal/privacy" className="hover:text-primary">Məxfilik Siyasəti</Link></li>
              <li><Link href="/legal/terms" className="hover:text-primary">İstifadə Şərtləri</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line py-4 text-center text-xs text-muted">© {new Date().getFullYear()} TəhsilHub. Bütün hüquqlar qorunur.</div>
      </footer>
    </div>
  );
}
