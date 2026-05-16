import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function NotFound() {
  const navigate = useNavigate()
  const [count, setCount] = useState(5)

  useEffect(() => {
    const t = setInterval(() => {
      setCount(c => {
        if (c <= 1) { clearInterval(t); navigate('/'); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [navigate])

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl mb-6">🔍</div>
        <h1 className="text-6xl font-bold text-primary-600 mb-2">404</h1>
        <h2 className="text-xl font-bold text-gray-800 mb-3">Səhifə tapılmadı</h2>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          Axtardığınız səhifə mövcud deyil və ya köçürülüb.<br />
          <span className="text-primary-600 font-medium">{count} saniyə</span> sonra ana səhifəyə yönləndiriləcəksiniz.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="btn-primary justify-center py-3 px-8">🏠 Ana səhifə</Link>
          <button onClick={() => navigate(-1)} className="btn-secondary justify-center py-3 px-8">← Geri qayıt</button>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-3">Bəlkə bunlardan biri axtardığınızdır?</p>
          <div className="flex gap-2 justify-center flex-wrap">
            {[['Mütəxəssislər', '/mutexessisler'], ['Elanlar', '/elanlar'], ['Əlaqə', '/elaqe']].map(([l, to]) => (
              <Link key={to} to={to} className="text-sm text-primary-600 hover:underline">{l}</Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
