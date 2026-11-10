'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';
import Icon from './Icons';
import ThemeToggle from './ThemeToggle';

const NAV = [
  { href: '/', label: 'Ana səhifə', icon: 'home', exact: true },
  { href: '/feed', label: 'TəhsilHub Feed', icon: 'feed' },
  { href: '/quizzes', label: 'Sınaqlar', icon: 'quiz' },
  { href: '/forum', label: 'Forum', icon: 'message' },
  { href: '/search?q=müəllim', label: 'Müəllimlər', icon: 'teacher' },
  { href: '/books', label: 'Kitab elanları', icon: 'book' },
  { href: '/pdfs', label: 'PDF resurslar', icon: 'file' },
  { href: '/chat', label: 'Mesajlar', icon: 'chat' },
  { href: '/notifications', label: 'Bildirişlər', icon: 'bell' },
  { href: '/profile?tab=saved', label: 'Yadda saxlananlar', icon: 'bookmark' },
  { href: '/profile', label: 'Profilim', icon: 'user' }
];
const MOBILE_NAV = NAV.filter((n) => ['/', '/feed', '/quizzes', '/forum', '/chat'].includes(n.href));

function Logo() {
  return <Link href="/" className="flex items-center gap-3 text-lg font-extrabold tracking-tight text-ink" aria-label="TəhsilHub — ana səhifə"><span className="brand-mark"><Icon name="cap" className="h-5 w-5" /></span><span>Təhsil<span className="text-primary">Hub</span></span></Link>;
}

function LeftRail({ active, user, me, unread, notif, logout }) {
  const name = me.fullName || user?.user_metadata?.full_name || user?.email || 'İstifadəçi';
  return <aside className="app-left-rail" aria-label="Əsas naviqasiya">
    <div className="px-3 pb-5 pt-2"><Logo /></div>
    <nav className="space-y-1" aria-label="Platforma">
      {NAV.map((n) => <Link key={n.href} href={n.href} aria-current={active(n) ? 'page' : undefined} className={`rail-link ${active(n) ? 'rail-link-active' : ''}`}>
        <span className="relative"><Icon name={n.icon} className="h-5 w-5" />{n.href === '/chat' && unread > 0 && <i className="nav-dot" />}{n.href === '/notifications' && notif > 0 && <i className="nav-dot" />}</span><span className="min-w-0 flex-1 truncate">{n.label}</span>{n.href === '/chat' && unread > 0 && <span className="rail-count">{unread > 9 ? '9+' : unread}</span>}{n.href === '/notifications' && notif > 0 && <span className="rail-count">{notif > 9 ? '9+' : notif}</span>}
      </Link>)}
    </nav>
    <Link href={user ? '/feed' : '/auth?mode=register'} className="rail-join-card mt-6 block">
      <span className="join-orbit"><Icon name="sparkle" className="h-5 w-5" /></span><strong>Öyrən, paylaş, inkişaf et</strong><span>İcmanın bir hissəsi ol və yeni imkanları kəşf et.</span><span className="join-action">{user ? 'Feed-ə keç' : 'İndi qoşul'} <Icon name="arrowRight" className="h-4 w-4" /></span>
    </Link>
    {user && <div className="rail-account"><span className="avatar avatar-sm">{name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{name}</strong><span className="block truncate text-xs text-muted">{user.email}</span></span><button type="button" title="Çıxış" aria-label="Hesabdan çıxış" onClick={logout} className="icon-button h-9 w-9 shrink-0"><Icon name="logout" className="h-4 w-4" /></button></div>}
  </aside>;
}

function RightRail({ user }) {
  const [teachers, setTeachers] = useState([]);
  useEffect(() => {
    let live = true;
    supabase.from('profiles').select('id,full_name,username,avatar_url,is_verified').eq('account_type','teacher').order('is_verified',{ascending:false}).limit(3)
      .then(({data}) => { if (live) setTeachers(data || []); });
    return () => { live = false; };
  }, []);
  return <aside className="app-right-rail" aria-label="Kəşf et">
    <div className="sticky top-24 space-y-5">
      <section className="rail-panel"><div className="flex items-center justify-between"><h2 className="rail-heading">Bu gün öyrən</h2><span className="text-lg" aria-hidden="true">✨</span></div><p className="mt-2 text-sm leading-6 text-muted">Biliklərini möhkəmləndirmək üçün qısa sınaqla başla.</p><Link href="/quizzes" className="btn btn-primary mt-4 w-full">Sınaqlara bax <Icon name="arrowRight" className="h-4 w-4" /></Link></section>
      <section className="rail-panel"><div className="mb-3 flex items-center justify-between"><h2 className="rail-heading">Təhsil mövzuları</h2><Icon name="trending" className="h-4 w-4 text-primary" /></div><div className="flex flex-wrap gap-2">{[['İmtahan hazırlığı','imtahan'],['Rəqəmsal təhsil','texnologiya'],['Karyera','karyera'],['Müəllimlik','müəllim']].map(([label,q])=><Link key={q} href={`/search?q=${encodeURIComponent(q)}`} className="topic-chip">#{label}</Link>)}</div><Link href="/search" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">Mövzuları kəşf et <Icon name="arrowRight" className="h-4 w-4" /></Link></section>
      <section className="rail-panel"><div className="mb-3 flex items-center justify-between"><h2 className="rail-heading">Müəllimləri kəşf et</h2><Icon name="teacher" className="h-4 w-4 text-primary" /></div>{teachers.length ? <div className="space-y-3">{teachers.map((t)=><div key={t.id} className="flex items-center gap-2.5"><Link href={`/u/${t.id}`} className="avatar avatar-sm overflow-hidden">{t.avatar_url?<img src={t.avatar_url} alt="" className="h-full w-full object-cover"/>:(t.full_name||'M')[0]}</Link><Link href={`/u/${t.id}`} className="min-w-0 flex-1"><strong className="block truncate text-sm">{t.full_name||'Müəllim'}{t.is_verified&&<span className="verified-mark ml-1" title="Doğrulanmış hesab">✓</span>}</strong><span className="block truncate text-xs text-muted">{t.username?`@${t.username}`:'TəhsilHub müəllimi'}</span></Link><Link href={`/u/${t.id}`} aria-label={`${t.full_name||'Müəllim'} profilinə bax`} className="icon-button h-8 w-8"><Icon name="arrowRight" className="h-4 w-4" /></Link></div>)}</div> : <p className="text-sm leading-6 text-muted">Müəllim profillərini axtarış bölməsindən tapın.</p>}<Link href="/search?q=müəllim" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">Hamısına bax <Icon name="arrowRight" className="h-4 w-4" /></Link></section>
      {!user && <section className="rail-join-card"><span className="join-orbit"><Icon name="users" className="h-5 w-5" /></span><strong>İcma ilə birlikdə böyü</strong><span>Profil yarat, suallar ver və faydalı resursları yadda saxla.</span><Link href="/auth?mode=register" className="join-action">Pulsuz qeydiyyat <Icon name="arrowRight" className="h-4 w-4" /></Link></section>}
      <p className="px-2 text-xs leading-5 text-muted">Haqqımızda · Məxfilik · İstifadə şərtləri<br/>© {new Date().getFullYear()} TəhsilHub</p>
    </div>
  </aside>;
}

export default function Shell({ children }) {
  const path = usePathname();
  const router = useRouter();
  const { user, me } = useAuth();
  const [menu, setMenu] = useState(false);
  const [drop, setDrop] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notif, setNotif] = useState(0);
  const [query, setQuery] = useState('');
  const dropRef = useRef(null);
  const searchRef = useRef(null);
  const active = (n) => (n.exact ? path === n.href : path === n.href || path.startsWith(n.href + '/'));
  const name = me.fullName || user?.user_metadata?.full_name || user?.email || 'İstifadəçi';

  useEffect(() => { setMenu(false); setDrop(false); }, [path]);
  useEffect(() => {
    const onShortcut = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); } };
    document.addEventListener('keydown', onShortcut);
    return () => document.removeEventListener('keydown', onShortcut);
  }, []);
  useEffect(() => {
    if (!drop) return undefined;
    const onDoc = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDrop(false); };
    const onKey = (e) => { if (e.key === 'Escape') setDrop(false); };
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [drop]);
  useEffect(() => {
    if (!user) { setUnread(0); setNotif(0); return undefined; }
    let stop = false;
    const load = async () => {
      const [m,n] = await Promise.all([supabase.rpc('unread_message_count'),supabase.rpc('unread_notification_count')]);
      if (!stop) { if (!m.error) setUnread(Number(m.data)||0); if (!n.error) setNotif(Number(n.data)||0); }
    };
    load(); const t=setInterval(load,60000); return()=>{stop=true;clearInterval(t);};
  },[user,path]);
  async function logout(){setDrop(false);setMenu(false);await supabase.auth.signOut();router.push('/');}
  function search(e){e.preventDefault();const value=query.trim();if(value.length>=2)router.push(`/search?q=${encodeURIComponent(value)}`);else router.push('/search');}

  return <div className="app-shell min-h-screen">
    <a href="#main" className="skip-link">Əsas məzmuna keç</a>
    <header className="app-topbar"><div className="app-topbar-inner"><div className="lg:hidden"><Logo/></div><form onSubmit={search} role="search" className="top-search"><Icon name="search" className="h-5 w-5 shrink-0 text-muted"/><input ref={searchRef} aria-label="Platformada axtar" value={query} onChange={(e)=>setQuery(e.target.value.slice(0,100))} placeholder="Müəllim, mövzu və resurs axtar..."/><kbd className="hidden sm:inline-flex">Ctrl K</kbd></form><div className="flex items-center gap-2"><ThemeToggle/>{user&&<Link href="/notifications" aria-label={notif?`Bildirişlər, ${notif} oxunmamış`:'Bildirişlər'} className="icon-button relative"><Icon name="bell" className="h-5 w-5"/>{notif>0&&<span className="notification-badge">{notif>9?'9+':notif}</span>}</Link>}{!user?<><Link href="/auth" className="btn btn-ghost btn-sm hidden sm:inline-flex">Daxil ol</Link><Link href="/auth?mode=register" className="btn btn-primary btn-sm">Qoşul</Link></>:<div className="relative" ref={dropRef}><button type="button" onClick={()=>setDrop(!drop)} aria-haspopup="menu" aria-expanded={drop} className="profile-trigger"><span className="avatar avatar-sm">{name[0]?.toUpperCase()||'İ'}</span><span className="hidden max-w-28 truncate text-sm font-semibold md:inline">{name}</span><Icon name="chevronDown" className="h-4 w-4 text-muted"/></button>{drop&&<div role="menu" className="profile-menu"><div className="mb-1 border-b border-line px-3 pb-3 pt-2"><strong className="block truncate text-sm">{name}</strong><span className="text-xs text-muted">{user.email}</span></div>{me.isAdmin&&<Link role="menuitem" href="/admin" className="menu-link"><Icon name="shield" className="h-4 w-4"/>Admin paneli</Link>}{(me.accountType==='teacher'||me.isAdmin)&&<Link role="menuitem" href="/teacher/quizzes" className="menu-link"><Icon name="quiz" className="h-4 w-4"/>Sınaqlarımı idarə et</Link>}<Link role="menuitem" href="/profile" className="menu-link"><Icon name="user" className="h-4 w-4"/>Profilim</Link><button role="menuitem" onClick={logout} className="menu-link w-full text-danger"><Icon name="logout" className="h-4 w-4"/>Çıxış</button></div>}</div>}<button type="button" className="icon-button lg:hidden" aria-label="Naviqasiyanı aç" aria-expanded={menu} onClick={()=>setMenu(!menu)}><Icon name={menu?'x':'menu'} className="h-5 w-5"/></button></div></div></header>
    {menu&&<div className="mobile-drawer lg:hidden"><nav className="space-y-1">{NAV.map(n=><Link key={n.href} href={n.href} className={`rail-link ${active(n)?'rail-link-active':''}`}><Icon name={n.icon} className="h-5 w-5"/>{n.label}</Link>)}</nav>{user&&<div className="mt-3 border-t border-line pt-3"><Link href="/profile" className="menu-link">Profilim</Link><button onClick={logout} className="menu-link w-full text-danger">Çıxış</button></div>}</div>}
    <div className="app-layout"><LeftRail active={active} user={user} me={me} unread={unread} notif={notif} logout={logout}/><main id="main" className="app-main">{children}</main><RightRail user={user}/></div>
    <nav className="mobile-tabbar lg:hidden" aria-label="Mobil əsas menyu">{MOBILE_NAV.map(n=><Link key={n.href} href={n.href} aria-current={active(n)?'page':undefined} className={`mobile-tab ${active(n)?'mobile-tab-active':''}`}><span className="relative"><Icon name={n.icon} className="h-5 w-5"/>{n.href==='/chat'&&unread>0&&<i className="nav-dot"/>}</span><span>{n.label==='Ana səhifə'?'Ana səh.':n.label==='Sınaqlar'?'Sınaq':n.label==='TəhsilHub Feed'?'Feed':n.label==='Mesajlar'?'Mesaj':'Forum'}</span></Link>)}</nav>
  </div>;
}
