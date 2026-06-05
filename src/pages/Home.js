import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const KATEQORIYALAR = [
  { ad: 'Santexnik', ikon: '🔧', reng: 'from-blue-500 to-blue-600' },
  { ad: 'Elektrik',  ikon: '⚡', reng: 'from-yellow-400 to-orange-500' },
  { ad: 'Təmizlik',  ikon: '🧹', reng: 'from-green-400 to-emerald-600' },
  { ad: 'Rəssam',    ikon: '🎨', reng: 'from-pink-400 to-rose-600' },
  { ad: 'Gözəllik',  ikon: '💅', reng: 'from-purple-400 to-violet-600' },
  { ad: 'Kompüter',  ikon: '💻', reng: 'from-cyan-400 to-blue-500' },
  { ad: 'Avtomobil', ikon: '🚗', reng: 'from-slate-500 to-gray-700' },
  { ad: 'Köçürmə',   ikon: '📦', reng: 'from-orange-400 to-amber-600' },
]

const PHRASES = ['santexnik tap', 'elektrik axtar', 'gözəllik ustası tap', 'kompüter ustası tap', 'ev təmizliyi tap']

function useTypewriter() {
  const [text, setText] = useState('')
  const [blink, setBlink] = useState(true)
  const state = useRef({ pi: 0, ci: 0, del: false, t: null })
  useEffect(() => {
    const bi = setInterval(() => setBlink(b => !b), 530)
    const delay = setTimeout(() => {
      clearInterval(bi); setBlink(true)
      function tick() {
        const s = state.current; const word = PHRASES[s.pi]
        if (!s.del) {
          s.ci++; setText(word.slice(0, s.ci))
          s.t = setTimeout(tick, s.ci === word.length ? 2000 : 65)
          if (s.ci === word.length) s.del = true
        } else {
          s.ci--; setText(word.slice(0, s.ci))
          if (s.ci === 0) { s.del = false; s.pi = (s.pi + 1) % PHRASES.length }
          s.t = setTimeout(tick, s.ci === 0 ? 400 : 35)
        }
      }
      tick()
    }, 800)
    return () => { clearInterval(bi); clearTimeout(delay); clearTimeout(state.current.t) }
  }, [])
  return { text, blink }
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-4 animate-pulse border border-gray-100">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-gray-100 rounded-full w-3/4" />
          <div className="h-3 bg-gray-100 rounded-full w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-gray-100 rounded-full w-full mb-2" />
      <div className="h-3 bg-gray-100 rounded-full w-4/5" />
    </div>
  )
}

export default function Home() {
  const { user, hesab } = useAuth()
  const { text, blink } = useTypewriter()
  const [mutexessisler, setMutexessisler] = useState([])
  const [loading, setLoading] = useState(true)
  const [axtaris, setAxtaris] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('mutexessis_hesablari')
      .select('*, hesablar(full_name, city)')
      .order('rating', { ascending: false })
      .limit(6)
      .then(({ data }) => { setMutexessisler(data || []); setLoading(false) })
  }, [])

  const axtar = useCallback(() => {
    if (axtaris.trim()) navigate(`/mutexessisler?q=${axtaris.trim()}`)
  }, [axtaris, navigate])

  return (
    <div className="bg-[#F2F4F7] min-h-screen pb-24">
      <div className="bg-[#185FA5] pt-14 pb-6 px-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-blue-200 text-xs font-medium">Salam, {hesab?.full_name?.split(' ')[0] || 'istifadəçi'} 👋</p>
            <h1 className="text-white font-bold text-xl leading-tight mt-0.5">Axtar<span className="text-yellow-300">.</span>xyz</h1>
          </div>
          <Link to={user ? '/dashboard' : '/giris'} className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white text-lg active:scale-95 transition-transform">👤</Link>
        </div>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</div>
          <input value={axtaris} onChange={e => setAxtaris(e.target.value)} onKeyDown={e => e.key === 'Enter' && axtar()}
            placeholder={`${text}${blink ? '|' : ' '}`}
            className="w-full bg-white rounded-2xl pl-10 pr-4 py-3.5 text-sm text-gray-800 outline-none shadow-lg placeholder:text-gray-400" />
        </div>
      </div>

      <div className="px-4 -mt-2">
        <div className="grid grid-cols-3 gap-2 mb-4 mt-4">
          {[['1,240+','Mütəxəssis','👷'],['8,500+','İş','✅'],['50+','Kateqoriya','📂']].map(([n,l,ikon]) => (
            <div key={l} className="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
              <div className="text-xl mb-1">{ikon}</div>
              <div className="text-base font-bold text-[#185FA5]">{n}</div>
              <div className="text-xs text-gray-400 mt-0.5">{l}</div>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800 text-base">Kateqoriyalar</h2>
            <Link to="/mutexessisler" className="text-xs text-[#185FA5] font-semibold">Hamısı →</Link>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {KATEQORIYALAR.map(k => (
              <button key={k.ad} onClick={() => navigate(`/mutexessisler?q=${k.ad}`)} className="active:scale-95 transition-transform">
                <div className={`bg-gradient-to-br ${k.reng} rounded-2xl p-3 flex flex-col items-center gap-1.5 shadow-sm`}>
                  <span className="text-2xl">{k.ikon}</span>
                  <span className="text-white text-[10px] font-semibold text-center leading-tight">{k.ad}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <Link to="/elanlar" className="bg-gradient-to-br from-[#185FA5] to-blue-700 rounded-2xl p-4 text-white shadow-sm active:scale-95 transition-transform">
            <div className="text-2xl mb-2">📋</div>
            <div className="font-bold text-sm">Elanlar</div>
            <div className="text-blue-200 text-xs mt-0.5">Xidmət tap və ya elan ver</div>
          </Link>
          <Link to="/mutexessisler" className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-4 text-white shadow-sm active:scale-95 transition-transform">
            <div className="text-2xl mb-2">🔧</div>
            <div className="font-bold text-sm">Mütəxəssislər</div>
            <div className="text-green-100 text-xs mt-0.5">Peşəkar tap</div>
          </Link>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800 text-base">Tövsiyə olunanlar</h2>
            <Link to="/mutexessisler" className="text-xs text-[#185FA5] font-semibold">Hamısı →</Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
          ) : mutexessisler.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center py-10 text-center px-6">
              <div className="text-4xl mb-3">👷</div>
              <h3 className="font-semibold text-gray-600 text-sm mb-1">Hələ mütəxəssis yoxdur</h3>
              <p className="text-xs text-gray-400 mb-4">İlk mütəxəssis olmaq istəyirsən?</p>
              <Link to="/qeydiyyat" className="bg-[#185FA5] text-white text-sm font-semibold px-5 py-2.5 rounded-2xl">Qeydiyyat</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {mutexessisler.map(m => (
                <Link key={m.id} to={`/mutexessis/${m.id}`} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:scale-[0.98] transition-transform block">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#185FA5] font-bold text-lg shrink-0">
                      {m.hesablar?.full_name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-gray-800 text-sm truncate">{m.hesablar?.full_name}</span>
                        {m.is_verified && <span className="text-green-500 text-xs">✅</span>}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{m.category} · {m.hesablar?.city}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-yellow-400 text-xs">{'★'.repeat(Math.round(m.rating || 0))}</span>
                        <span className="text-xs text-gray-400">({m.review_count})</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-[#185FA5]">{m.start_price}</div>
                      <div className="text-xs text-gray-400">AZN</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-[#185FA5] to-blue-700 rounded-2xl p-5 text-white text-center mb-4 shadow-md">
          <div className="text-3xl mb-2">🛠️</div>
          <h3 className="font-bold text-base mb-1">Sən də mütəxəssississən?</h3>
          <p className="text-blue-100 text-xs mb-4 leading-relaxed">Profil aç, elan ver, hər gün yeni müştərilər qazan</p>
          <Link to="/qeydiyyat" className="bg-white text-[#185FA5] font-bold text-sm px-6 py-2.5 rounded-xl inline-block active:scale-95 transition-transform">Başla →</Link>
        </div>

        <footer className="text-center pb-4">
          <div className="flex justify-center gap-6 text-xs text-gray-400 mb-2">
            <Link to="/gizlilik" className="hover:text-gray-600">Gizlilik</Link>
            <Link to="/elaqe" className="hover:text-gray-600">Əlaqə</Link>
          </div>
          <p className="text-xs text-gray-300">© 2025 Axtar.xyz</p>
        </footer>
      </div>
    </div>
  )
}
