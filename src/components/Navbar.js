import { useLocation, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Navbar() {
  const { user, hesab, cixis } = useAuth()
  const location = useLocation()
  const [oxunmamis, setOxunmamis] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    const yukle = async () => {
      const { count } = await supabase.from('bildirisler')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('oxunub', false)
      setOxunmamis(count || 0)
    }
    yukle()
    const channel = supabase.channel('nav_bil_' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bildirisler', filter: `user_id=eq.${user.id}` }, yukle)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  useEffect(() => { setMenuOpen(false) }, [location])

  const isActive = (path) => location.pathname === path

  const NAV = [
    { to: '/', ikon: '🏠', label: 'Ana' },
    { to: '/mutexessisler', ikon: '🔍', label: 'Axtar' },
    { to: '/elanlar', ikon: '📋', label: 'Elanlar' },
    { to: user ? '/dashboard' : '/giris', ikon: '👤', label: user ? 'Profil' : 'Giriş', badge: oxunmamis },
  ]

  return (
    <>
      {/* Desktop navbar */}
      <nav className="hidden md:flex sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm items-center justify-between px-6 h-16">
        <Link to="/" className="font-bold text-xl text-[#185FA5]">Axtar<span className="text-[#E24B4A]">.</span>xyz</Link>
        <div className="flex items-center gap-6">
          {['/mutexessisler','Mütəxəssislər','/elanlar','Elanlar','/elaqe','Əlaqə'].reduce((acc, val, i, arr) => {
            if (i % 2 === 0) acc.push([arr[i], arr[i+1]])
            return acc
          }, []).map(([to, label]) => (
            <Link key={to} to={to} className={`text-sm font-medium transition-colors ${isActive(to) ? 'text-[#185FA5]' : 'text-gray-600 hover:text-[#185FA5]'}`}>{label}</Link>
          ))}
          {hesab?.role === 'admin' && <Link to="/admin" className="text-sm font-semibold text-[#E24B4A]">⚙️ Admin</Link>}
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm font-medium text-gray-700 hover:text-[#185FA5]">{hesab?.full_name?.split(' ')[0]}</Link>
              <button onClick={cixis} className="text-sm border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50">Çıxış</button>
            </>
          ) : (
            <>
              <Link to="/giris" className="text-sm text-gray-600 hover:text-[#185FA5]">Giriş</Link>
              <Link to="/qeydiyyat" className="bg-[#185FA5] text-white text-sm font-semibold px-4 py-2 rounded-xl">Qeydiyyat</Link>
            </>
          )}
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-lg">
        <div className="flex items-center justify-around py-2 px-2">
          {NAV.map(item => (
            <Link key={item.to} to={item.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all relative ${isActive(item.to) ? 'text-[#185FA5] bg-blue-50' : 'text-gray-400'}`}>
              <span className="text-2xl leading-none">{item.ikon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-[#E24B4A] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom)' }} />
      </div>
    </>
  )
}
