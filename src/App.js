import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Giris from './pages/Giris'
import Qeydiyyat from './pages/Qeydiyyat'
import Mutexessisler from './pages/Mutexessisler'
import MutexessisProfile from './pages/MutexessisProfile'
import Elanlar from './pages/Elanlar'
import Dashboard from './pages/Dashboard'
import Gizlilik from './pages/Gizlilik'
import Elaqe from './pages/Elaqe'
import Admin from './pages/Admin'

function AuthHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    // Google OAuth-dan sonra token-i işlə
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Hesab var mı yoxla, yoxdursa yarat
        const { data: hesab } = await supabase.from('hesablar').select('id').eq('id', session.user.id).single()
        if (!hesab) {
          await supabase.from('hesablar').insert({
            id: session.user.id,
            full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
            avatar_url: session.user.user_metadata?.avatar_url,
            role: 'musteri'
          })
        }
        // Hash-də token varsa dashboard-a yönləndir
        if (window.location.hash.includes('access_token')) {
          navigate('/dashboard')
        }
      }
    })
  }, [navigate])

  return null
}

function App() {
  return (
    <BrowserRouter>
      <AuthHandler />
      <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: "'Inter', sans-serif" }}>
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={
            <>
              <Navbar />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/giris" element={<Giris />} />
                <Route path="/qeydiyyat" element={<Qeydiyyat />} />
                <Route path="/mutexessisler" element={<Mutexessisler />} />
                <Route path="/mutexessis/:id" element={<MutexessisProfile />} />
                <Route path="/elanlar" element={<Elanlar />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/gizlilik" element={<Gizlilik />} />
                <Route path="/elaqe" element={<Elaqe />} />
              </Routes>
            </>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
