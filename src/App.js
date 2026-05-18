import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Giris from './pages/Giris'
import Qeydiyyat from './pages/Qeydiyyat'
import SifreSifirla from './pages/SifreSifirla'
import Mutexessisler from './pages/Mutexessisler'
import MutexessisProfile from './pages/MutexessisProfile'
import Elanlar from './pages/Elanlar'
import Dashboard from './pages/Dashboard'
import ProfilRedakte from './pages/ProfilRedakte'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'
import { Gizlilik, Elaqe } from './pages/StatikSehifeler'
import SifreYenile from './pages/SifreYenile'

function GoogleAuthHandler() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!location.hash.includes('access_token')) return
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return
      const { data: hesab } = await supabase.from('hesablar').select('id').eq('id', session.user.id).single()
      if (!hesab) {
        await supabase.from('hesablar').insert({
          id: session.user.id,
          full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
          avatar_url: session.user.user_metadata?.avatar_url,
          role: 'musteri'
        })
      }
      navigate('/dashboard', { replace: true })
    })
  }, [navigate, location.hash])

  return null
}

function MainLayout() {
  return (
    <ErrorBoundary>
      <GoogleAuthHandler />
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/giris" element={<Giris />} />
          <Route path="/qeydiyyat" element={<Qeydiyyat />} />
          <Route path="/sifre-sifirla" element={<SifreSifirla />} />
          <Route path="/mutexessisler" element={<Mutexessisler />} />
          <Route path="/mutexessis/:id" element={<MutexessisProfile />} />
          <Route path="/elanlar" element={<Elanlar />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profil/redakte" element={<ProfilRedakte />} />
          <Route path="/sifre-yenile" element={<SifreYenile />} />
          <Route path="/gizlilik" element={<Gizlilik />} />
          <Route path="/elaqe" element={<Elaqe />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 font-sans">
        <Routes>
          <Route path="/admin" element={<ErrorBoundary><Admin /></ErrorBoundary>} />
          <Route path="/*" element={<MainLayout />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
