import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Navbar() {
  const [user, setUser] = useState(null)
  const [hesab, setHesab] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        supabase.from('hesablar').select('*').eq('id', data.user.id).single()
          .then(({ data: h }) => setHesab(h))
      }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        supabase.from('hesablar').select('*').eq('id', session.user.id).single()
          .then(({ data: h }) => setHesab(h))
      } else { setHesab(null) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => { setMenuOpen(false) }, [location])

  const cixis = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const isActive = (path) => location.pathname === path

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="navbar-logo">Axtar<span style={{ color: '#E24B4A' }}>.</span>xyz</Link>
        <div className="navbar-links">
          <Link to="/mutexessisler" style={{ color: isActive('/mutexessisler') ? '#185FA5' : '#555' }}>Mütəxəssislər</Link>
          <Link to="/elanlar" style={{ color: isActive('/elanlar') ? '#185FA5' : '#555' }}>Elanlar</Link>
        </div>
        <div className="navbar-actions">
          {user ? (
            <>
              <Link to="/dashboard" style={{ fontSize: 14, color: '#555', textDecoration: 'none' }}>{hesab?.full_name?.split(' ')[0] || 'Profilim'}</Link>
              <button onClick={cixis} className="navbar-btn-outline">Çıxış</button>
            </>
          ) : (
            <>
              <Link to="/giris" style={{ fontSize: 14, color: '#555', textDecoration: 'none' }}>Giriş</Link>
              <Link to="/qeydiyyat" className="navbar-btn">Qeydiyyat</Link>
            </>
          )}
        </div>
        <button className="navbar-hamburger" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      <div className={`navbar-mobile-menu ${menuOpen ? 'open' : ''}`}>
        <Link to="/mutexessisler">Mütəxəssislər</Link>
        <Link to="/elanlar">Elanlar</Link>
        {user ? (
          <>
            <Link to="/dashboard">Profilim</Link>
            <button onClick={cixis}>Çıxış</button>
          </>
        ) : (
          <>
            <Link to="/giris">Giriş</Link>
            <Link to="/qeydiyyat">Qeydiyyat</Link>
          </>
        )}
      </div>

      <div className="mobile-bottom-nav">
        <div className="mobile-bottom-nav-inner">
          <Link to="/" className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`}>
            <span>🏠</span><span>Ana səhifə</span>
          </Link>
          <Link to="/mutexessisler" className={`mobile-nav-item ${isActive('/mutexessisler') ? 'active' : ''}`}>
            <span>🔧</span><span>Mütəxəssislər</span>
          </Link>
          <Link to="/elanlar" className={`mobile-nav-item ${isActive('/elanlar') ? 'active' : ''}`}>
            <span>📋</span><span>Elanlar</span>
          </Link>
          <Link to={user ? '/dashboard' : '/giris'} className={`mobile-nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
            <span>👤</span><span>{user ? 'Profilim' : 'Giriş'}</span>
          </Link>
        </div>
      </div>
    </>
  )
}
