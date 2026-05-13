import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const KATEQORIYALAR = [
  { ad: 'Santexnik', ikon: '🔧', reng: 'bg-blue-50 text-blue-600' },
  { ad: 'Elektrik', ikon: '⚡', reng: 'bg-yellow-50 text-yellow-600' },
  { ad: 'Təmizlik', ikon: '🧹', reng: 'bg-green-50 text-green-600' },
  { ad: 'Rəssam', ikon: '🎨', reng: 'bg-red-50 text-red-600' },
  { ad: 'Gözəllik', ikon: '💅', reng: 'bg-pink-50 text-pink-600' },
  { ad: 'Kompüter', ikon: '💻', reng: 'bg-emerald-50 text-emerald-600' },
  { ad: 'Avtomobil', ikon: '🚗', reng: 'bg-purple-50 text-purple-600' },
  { ad: 'Köçürmə', ikon: '📦', reng: 'bg-orange-50 text-orange-600' },
]

export default function Home() {
  const [axtaris, setAxtaris] = useState('')
  const [mutexessisler, setMutexessisler] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('mutexessis_hesablari')
      .select('*, hesablar(full_name, city)')
      .order('rating', { ascending: false })
      .limit(6)
      .then(({ data }) => setMutexessisler(data || []))
  }, [])

  const axtar = () => { if (axtaris.trim()) navigate(`/mutexessisler?q=${axtaris}`) }

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-blue-800 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <div className="max-w-2xl">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 text-white/90 text-sm font-medium mb-6">
              🇦🇿 Azərbaycanda #1 xidmət platforması
            </span>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
              Ehtiyacın olan <span className="text-yellow-300">mütəxəssisi tap</span>, işini həll et
            </h1>
            <p className="text-lg text-blue-100 mb-8 leading-relaxed">
              Santexnik, elektrik, təmizlik, gözəllik və daha yüzlərlə sahədə peşəkar mütəxəssislər sizi gözləyir.
            </p>
            <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-xl max-w-lg">
              <input
                value={axtaris}
                onChange={e => setAxtaris(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && axtar()}
                placeholder="Hansı xidməti axtarırsınız?"
                className="flex-1 px-4 py-2.5 text-gray-800 text-sm outline-none rounded-xl bg-transparent"
              />
              <button onClick={axtar} className="btn-primary text-sm px-5 py-2.5 shrink-0">Axtar</button>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {['Santexnik', 'Elektrik', 'Təmizlik', 'Rəssam'].map(t => (
                <button key={t} onClick={() => navigate(`/mutexessisler?q=${t}`)}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors">
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {[['1,240+', 'Qeydiyyatlı mütəxəssis'], ['8,500+', 'Tamamlanmış iş'], ['50+', 'Xidmət kateqoriyası']].map(([n, l]) => (
              <div key={l} className="py-6 text-center">
                <div className="text-2xl md:text-3xl font-bold text-primary-600">{n}</div>
                <div className="text-xs md:text-sm text-gray-500 mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Kateqoriyalar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">Kateqoriyalar</h2>
          <Link to="/mutexessisler" className="text-sm text-primary-600 hover:underline font-medium">Hamısına bax →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {KATEQORIYALAR.map(k => (
            <button key={k.ad} onClick={() => navigate(`/mutexessisler?q=${k.ad}`)}
              className="card p-4 text-center hover:shadow-md hover:border-primary-200 transition-all cursor-pointer group">
              <div className={`w-12 h-12 rounded-2xl ${k.reng} flex items-center justify-center mx-auto mb-3 text-2xl group-hover:scale-110 transition-transform`}>
                {k.ikon}
              </div>
              <div className="text-sm font-semibold text-gray-700">{k.ad}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Mütəxəssislər */}
      <div className="bg-gray-50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">Tövsiyə olunan mütəxəssislər</h2>
            <Link to="/mutexessisler" className="text-sm text-primary-600 hover:underline font-medium">Hamısına bax →</Link>
          </div>
          {mutexessisler.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Hələ mütəxəssis qeydiyyatdan keçməyib</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mutexessisler.map(m => (
                <Link key={m.id} to={`/mutexessis/${m.id}`} className="card p-5 hover:shadow-md hover:border-primary-200 transition-all block">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-600 font-bold text-lg shrink-0">
                      {m.hesablar?.full_name?.[0] || '?'}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800 text-sm">{m.hesablar?.full_name}</div>
                      <div className="text-xs text-gray-500">{m.category} · {m.hesablar?.city}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-yellow-400 text-sm">{'★'.repeat(Math.round(m.rating || 0))}</span>
                        <span className="text-xs text-gray-400">({m.review_count} rəy)</span>
                      </div>
                    </div>
                  </div>
                  {m.is_verified && <span className="badge bg-green-50 text-green-600 mb-2">✅ Təsdiqlənib</span>}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <span className="text-xs text-gray-500">Başlayan: <strong className="text-gray-700">{m.start_price} AZN</strong></span>
                    <span className="text-xs font-medium text-primary-600">Ətraflı →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Necə işləyir */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 text-center mb-10">Necə işləyir?</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
          {[['1','🔍','Xidmət seç','Lazım olan xidməti kateqoriyadan seç'],['2','👤','Mütəxəssisə bax','Profil və rəylərə əsasən seç'],['3','💬','Əlaqə qur','Birbaşa yazış və razılığa gəl'],['4','⭐','Rəy yaz','Xidmətdən sonra rəy yaz']].map(([n,ikon,t,d]) => (
            <div key={n} className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center text-2xl mx-auto mb-4">{ikon}</div>
              <div className="font-semibold text-gray-800 mb-2">{t}</div>
              <div className="text-sm text-gray-500 leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-primary-600 to-blue-700 text-white py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Sən də mütəxəssissən?</h2>
          <p className="text-blue-100 mb-8">Axtar.xyz-də profil aç, elan ver və hər gün yeni müştərilər qazan</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/qeydiyyat" className="bg-white text-primary-600 font-semibold px-8 py-3 rounded-xl hover:bg-blue-50 transition-colors text-sm">
              Mütəxəssis kimi qeydiyyat
            </Link>
            <Link to="/mutexessisler" className="bg-white/10 text-white font-medium px-8 py-3 rounded-xl hover:bg-white/20 transition-colors text-sm border border-white/20">
              Mütəxəssislərə bax
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-bold text-lg text-primary-600">Axtar<span className="text-accent-500">.</span>xyz</span>
          <div className="flex gap-6">
            <Link to="/gizlilik" className="text-sm text-gray-500 hover:text-primary-600 transition-colors">Gizlilik Siyasəti</Link>
            <Link to="/elaqe" className="text-sm text-gray-500 hover:text-primary-600 transition-colors">Əlaqə</Link>
            <Link to="/mutexessisler" className="text-sm text-gray-500 hover:text-primary-600 transition-colors">Mütəxəssislər</Link>
          </div>
          <span className="text-sm text-gray-400">© 2025 Axtar.xyz</span>
        </div>
      </footer>
    </div>
  )
}
