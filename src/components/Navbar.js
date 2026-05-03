import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Navbar() {
  const [user, setUser] = useState(null)
  const [hesab, setHesab] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

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
      } else {
        setHesab(null)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const cixis = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <nav style={styles.nav}>
      <Link to="/" style={styles.logo}>Axtar<span style={{ color: '#E24B4A' }}>.</span>xyz</Link>
      <div style={styles.links}>
        <Link to="/mutexessisler" style={styles.link}>Mütəxəssislər</Link>
        <Link to="/elanlar" style={styles.link}>Elanlar</Link>
        <Link to="/nece-isleyir" style={styles.link}>Necə işləyir</Link>
      </div>
      <div style={styles.actions}>
        {user ? (
          <>
            <Link to="/dashboard" style={styles.link}>{hesab?.full_name || 'Profilim'}</Link>
            <button onClick={cixis} style={styles.btnOutline}>Çıxış</button>
          </>
        ) : (
          <>
            <Link to="/giris" style={styles.link}>Giriş</Link>
            <Link to="/qeydiyyat" style={styles.btn}>Qeydiyyat</Link>
          </>
        )}
      </div>
    </nav>
  )
}

const styles = {
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 32px', background: '#fff', borderBottom: '1px solid #eee', position: 'sticky', top: 0, zIndex: 100 },
  logo: { fontWeight: 700, fontSize: 22, color: '#185FA5', textDecoration: 'none' },
  links: { display: 'flex', gap: 24 },
  link: { fontSize: 14, color: '#555', textDecoration: 'none' },
  actions: { display: 'flex', gap: 10, alignItems: 'center' },
  btn: { background: '#185FA5', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 14, textDecoration: 'none', fontWeight: 500 },
  btnOutline: { background: 'transparent', border: '1px solid #185FA5', color: '#185FA5', padding: '7px 16px', borderRadius: 8, fontSize: 14, cursor: 'pointer' }
}
