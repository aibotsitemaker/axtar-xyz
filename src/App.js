import { BrowserRouter, Routes, Route } from 'react-router-dom'
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

function App() {
  return (
    <BrowserRouter>
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
