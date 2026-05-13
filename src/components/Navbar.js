import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

function Bildirisler({ userId }) {
  const [bildirisler, setBildirisler] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const navigate = useNavigate()

  useEffect(() => {
    if (!userId) return
    yukle()
    const channel = supabase.channel('bildirisler_' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bildirisler', filter: `user_id=eq.${userId}` }, yukle)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId])

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const yukle = async () => {
    const { data } = await supabase.from('bildirisler').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    setBildirisler(data || [])
  }

  const oxu = async (b) => {
    await supabase.from('bildirisler').update({ oxunub: true }).eq('id', b.id)
    yukle()
    if (b.link) { setOpen(false); navigate(b.link) }
  }

  const hamısınıOxu = async () => {
    await supabase.from('bildirisler').update({ oxunub: true }).eq('user_id', userId)
    yukle()
  }

  const oxunmamis = bildirisler.filter(b => !b.oxunub).length
  const tipIkon = (tip) => ({ mesaj: '💬', muraciet: '📋', rey: '⭐' }[tip] || '🔔')

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
        <span className="text-xl">🔔</span>
        {oxunmamis > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {oxunmamis > 9 ? '9+' : oxunmamis}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 card shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm">Bildirişlər</span>
            {oxunmamis > 0 && (
              <button onClick={hamısınıOxu} className="text-xs text-primary-600 hover:underline">Hamısını oxu</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {bildirisler.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Bildiriş yoxdur</div>
            ) : bildirisler.map(b => (
              <div key={b.id} onClick={() => oxu(b)} className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 ${!b.oxunub ? 'bg-blue-50' : ''}`}>
                <span className="text-lg shrink-0">{tipIkon(b.tip)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 leading-snug">{b.metn}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(b.created_at).toLocaleDateString('az')}</p>
                </div>
                {!b.oxunub && <div className="w-2 h-2 rounded-full bg-primary-600 shrink-0 mt-1.5" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const { user, hesab, cixis } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setMenuOpen(false), [location])

  const isActive = (path) => location.pathname === path

  const navLink = (to, label) => (
    <Link to={to} className={`text-sm font-medium transition-colors hover:text-primary-600 ${isActive(to) ? 'text-primary-600' : 'text-gray-600'}`}>{label}</Link>
  )

  return (
    <>
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-1 shrink-0">
            <span className="text-xl font-bold text-primary-600">Axtar</span>
            <span className="text-xl font-bold text-accent-500">.</span>
            <span className="text-xl font-bold text-primary-600">xyz</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {navLink('/mutexessisler', 'Mütəxəssislər')}
            {navLink('/elanlar', 'Elanlar')}
            {navLink('/elaqe', 'Əlaqə')}
            {hesab?.role === 'admin' && (
              <Link to="/admin" className="text-sm font-semibold text-accent-500 hover:text-red-600 transition-colors">⚙️ Admin</Link>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Bildirisler userId={user.id} />
                <Link to="/dashboard" className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 font-semibold text-sm">
                    {hesab?.full_name?.[0] || '?'}
                  </div>
                  {hesab?.full_name?.split(' ')[0] || 'Profilim'}
                </Link>
                <button onClick={cixis} className="btn-secondary text-xs px-3 py-2">Çıxış</button>
              </>
            ) : (
              <>
                <Link to="/giris" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">Giriş</Link>
                <Link to="/qeydiyyat" className="btn-primary text-xs px-4 py-2">Qeydiyyat</Link>
              </>
            )}
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-600">
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-1">
            <Link to="/mutexessisler" className="px-3 py-2.5 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-50">Mütəxəssislər</Link>
            <Link to="/elanlar" className="px-3 py-2.5 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-50">Elanlar</Link>
            <Link to="/elaqe" className="px-3 py-2.5 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-50">Əlaqə</Link>
            {hesab?.role === 'admin' && <Link to="/admin" className="px-3 py-2.5 text-sm font-semibold text-accent-500 rounded-xl hover:bg-red-50">⚙️ Admin Panel</Link>}
            <div className="border-t border-gray-100 mt-1 pt-2">
              {user ? (
                <>
                  <Link to="/dashboard" className="px-3 py-2.5 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-50 block">👤 Profilim</Link>
                  <button onClick={cixis} className="px-3 py-2.5 text-sm font-medium text-red-500 rounded-xl hover:bg-red-50 w-full text-left">Çıxış</button>
                </>
              ) : (
                <>
                  <Link to="/giris" className="px-3 py-2.5 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-50 block">Giriş</Link>
                  <Link to="/qeydiyyat" className="px-3 py-2.5 text-sm font-medium text-primary-600 rounded-xl hover:bg-primary-50 block">Qeydiyyat</Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 shadow-lg">
        <div className="flex justify-around py-2">
          {[['/', '🏠', 'Ana'], ['/mutexessisler', '🔧', 'Ustalar'], ['/elanlar', '📋', 'Elanlar'], [user ? '/dashboard' : '/giris', '👤', user ? 'Profil' : 'Giriş']].map(([to, icon, label]) => (
            <Link key={to} to={to} className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors ${isActive(to) ? 'text-primary-600' : 'text-gray-400'}`}>
              <span className="text-xl">{icon}</span>
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
