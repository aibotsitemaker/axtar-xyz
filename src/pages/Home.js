import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/* ── TYPEWRITER ── */
const PHRASES = [
  { text: 'santexnik lazımdır?', icon: '🔧' },
  { text: 'elektrik axtarırsın?', icon: '⚡' },
  { text: 'ev təmiri lazımdır?', icon: '🏠' },
  { text: 'gözəllik ustası tap!', icon: '💅' },
  { text: 'kompüter problemi var?', icon: '💻' },
  { text: 'iş axtarırsın? Elanlara bax!', icon: '📋' },
  { text: 'mütəxəssis lazımdır?', icon: '🎯' },
]

function Typewriter() {
  const [display, setDisplay] = useState('')
  const [blink, setBlink] = useState(true)
  const state = useRef({ pi: 0, ci: 0, deleting: false, timer: null })

  useEffect(() => {
    const blinkInterval = setInterval(() => setBlink(b => !b), 530)
    const startDelay = setTimeout(() => {
      clearInterval(blinkInterval)
      setBlink(true)
      tick()
    }, 600)

    function tick() {
      const s = state.current
      const word = PHRASES[s.pi].text
      if (!s.deleting) {
        s.ci++
        setDisplay(word.slice(0, s.ci))
        if (s.ci === word.length) {
          s.deleting = true
          s.timer = setTimeout(tick, 2000)
        } else {
          s.timer = setTimeout(tick, 60)
        }
      } else {
        s.ci--
        setDisplay(word.slice(0, s.ci))
        if (s.ci === 0) {
          s.deleting = false
          s.pi = (s.pi + 1) % PHRASES.length
          s.timer = setTimeout(tick, 350)
        } else {
          s.timer = setTimeout(tick, 30)
        }
      }
    }

    return () => {
      clearInterval(blinkInterval)
      clearTimeout(startDelay)
      clearTimeout(state.current.timer)
    }
  }, [])

  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-yellow-300 font-semibold text-xl md:text-2xl">{display}</span>
      <span className={`inline-block w-0.5 h-5 bg-yellow-300 align-middle transition-opacity duration-100 ${blink ? 'opacity-100' : 'opacity-0'}`} />
    </span>
  )
}

/* ── CAROUSEL ── */
const STEPS = [
  { icon: '🔍', color: 'bg-blue-100 text-blue-600', title: 'Xidmət seç', desc: 'Lazım olan xidməti kateqoriyadan seç ya da axtarış çubuğuna yaz. 50+ kateqoriya mövcuddur.' },
  { icon: '👤', color: 'bg-green-100 text-green-600', title: 'Mütəxəssisə bax', desc: 'Profil, portfolio şəkilləri və real müştəri rəylərinə əsasən ən uyğun mütəxəssisi seç.' },
  { icon: '💬', color: 'bg-orange-100 text-orange-600', title: 'Əlaqə qur', desc: 'Mütəxəssislə birbaşa platformadan yazış, qiymət razılaşdır və işin tarixini müəyyənləşdir.' },
  { icon: '⭐', color: 'bg-pink-100 text-pink-600', title: 'Rəy yaz', desc: 'Xidmət tamamlandıqdan sonra rəy yaz. Rəylər digər istifadəçilərə doğru seçim etməyə kömək edir.' },
]

function HowCarousel() {
  const [cur, setCur] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState(0)
  const [animating, setAnimating] = useState(false)
  const autoRef = useRef(null)
  const trackRef = useRef(null)
  const startX = useRef(0)
  const currentOffset = useRef(0)
  const swiped = useRef(false)
  const isDragging = useRef(false)
  const TOTAL = STEPS.length

  const goTo = useCallback((i, anim = true) => {
    const next = Math.max(0, Math.min(TOTAL - 1, i))
    if (anim) setAnimating(true)
    setCur(next)
    setOffset(0)
    currentOffset.current = 0
    setTimeout(() => setAnimating(false), 500)
  }, [TOTAL])

  const startAuto = useCallback(() => {
    stopAuto()
    autoRef.current = setInterval(() => {
      setCur(c => {
        const next = c < TOTAL - 1 ? c + 1 : 0
        return next
      })
    }, 3800)
  }, [TOTAL])

  const stopAuto = () => {
    if (autoRef.current) clearInterval(autoRef.current)
  }

  useEffect(() => {
    startAuto()
    return () => stopAuto()
  }, [startAuto])

  const handlePrev = () => { stopAuto(); goTo(cur - 1) }
  const handleNext = () => { stopAuto(); goTo(cur + 1) }

  const onDragStart = (x) => {
    isDragging.current = true
    swiped.current = false
    startX.current = x
    setDragging(true)
    stopAuto()
  }

  const onDragMove = (x) => {
    if (!isDragging.current) return
    const dx = x - startX.current
    if (Math.abs(dx) > 8) swiped.current = true
    currentOffset.current = dx
    setOffset(dx)
  }

  const onDragEnd = () => {
    if (!isDragging.current) return
    isDragging.current = false
    setDragging(false)
    const thresh = (trackRef.current?.offsetWidth || 300) * 0.25
    if (currentOffset.current < -thresh && cur < TOTAL - 1) goTo(cur + 1)
    else if (currentOffset.current > thresh && cur > 0) goTo(cur - 1)
    else goTo(cur)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') { stopAuto(); goTo(cur - 1) }
      if (e.key === 'ArrowRight') { stopAuto(); goTo(cur + 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cur, goTo])

  const pct = ((cur + 1) / TOTAL) * 100

  return (
    <div className="max-w-lg mx-auto select-none">
      {/* Track */}
      <div
        ref={trackRef}
        className="overflow-hidden rounded-2xl cursor-grab active:cursor-grabbing"
        onMouseDown={e => { onDragStart(e.clientX); e.preventDefault() }}
        onMouseMove={e => { if (isDragging.current) onDragMove(e.clientX) }}
        onMouseUp={onDragEnd}
        onMouseLeave={onDragEnd}
        onTouchStart={e => onDragStart(e.touches[0].clientX)}
        onTouchMove={e => {
          if (!isDragging.current) return
          onDragMove(e.touches[0].clientX)
          if (swiped.current) e.preventDefault()
        }}
        onTouchEnd={onDragEnd}
        style={{ touchAction: 'pan-y' }}
      >
        <div
          className="flex"
          style={{
            transform: `translateX(calc(-${cur * 100}% + ${offset}px))`,
            transition: animating && !dragging ? 'transform 0.48s cubic-bezier(0.4,0,0.2,1)' : 'none',
          }}
        >
          {STEPS.map((step, i) => (
            <div key={i} className="min-w-full px-0.5">
              <div className={`bg-white border border-gray-100 rounded-2xl p-8 flex flex-col items-center text-center gap-4 transition-all duration-300 ${cur === i ? 'shadow-sm' : 'opacity-80'}`}>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${step.color} transition-transform duration-500 ${cur === i ? 'scale-110' : 'scale-100'}`}>
                  {step.icon}
                </div>
                <div className="text-xs font-medium text-gray-400 tracking-widest uppercase">
                  Addım {i + 1} / {TOTAL}
                </div>
                <h3 className="text-lg font-semibold text-gray-800">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handlePrev}
          disabled={cur === 0}
          className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-25 disabled:cursor-default transition-all shrink-0"
        >
          ‹
        </button>
        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <button
          onClick={handleNext}
          disabled={cur === TOTAL - 1}
          className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-25 disabled:cursor-default transition-all shrink-0"
        >
          ›
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 mt-3">
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => { stopAuto(); goTo(i) }}
            className={`h-1.5 rounded-full transition-all duration-300 ${cur === i ? 'w-6 bg-primary-600' : 'w-1.5 bg-gray-200 hover:bg-gray-300'}`}
            aria-label={`Addım ${i + 1}`}
          />
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-gray-400">
        <span>👆</span>
        <span>Sürükləyin · toxunun · ox düymələri</span>
        <span className={`w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse`} />
      </div>
    </div>
  )
}

/* ── ANA KATEQORIYALAR ── */
const KATEQORIYALAR = [
  { ad: 'Santexnik', ikon: '🔧', reng: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100' },
  { ad: 'Elektrik', ikon: '⚡', reng: 'bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100' },
  { ad: 'Təmizlik', ikon: '🧹', reng: 'bg-green-50 text-green-600 group-hover:bg-green-100' },
  { ad: 'Rəssam', ikon: '🎨', reng: 'bg-red-50 text-red-600 group-hover:bg-red-100' },
  { ad: 'Gözəllik', ikon: '💅', reng: 'bg-pink-50 text-pink-600 group-hover:bg-pink-100' },
  { ad: 'Kompüter', ikon: '💻', reng: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100' },
  { ad: 'Avtomobil', ikon: '🚗', reng: 'bg-purple-50 text-purple-600 group-hover:bg-purple-100' },
  { ad: 'Köçürmə', ikon: '📦', reng: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100' },
]

/* ── ANA KOMPONENT ── */
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

  const axtar = () => {
    if (axtaris.trim()) navigate(`/mutexessisler?q=${axtaris.trim()}`)
  }

  return (
    <div>
      {/* ── HERO ── */}
      <div className="bg-gradient-to-br from-primary-700 via-primary-600 to-blue-700 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm text-white/90 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Azərbaycanda #1 xidmət platforması
            </div>

            {/* Başlıq */}
            <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4">
              Ehtiyacın olan<br />
              <span className="text-yellow-300">mütəxəssisi tap,</span>
            </h1>

            {/* Typewriter */}
            <div className="flex items-center gap-2 mb-8 min-h-[40px]">
              <span className="text-blue-100 text-lg">işini həll et —</span>
              <Typewriter />
            </div>

            {/* Axtarış */}
            <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-xl max-w-lg mb-4">
              <input
                value={axtaris}
                onChange={e => setAxtaris(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && axtar()}
                placeholder="Hansı xidməti axtarırsınız?"
                className="flex-1 px-4 py-2 text-gray-800 text-sm outline-none rounded-xl bg-transparent min-w-0"
              />
              <button
                onClick={axtar}
                className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shrink-0"
              >
                Axtar
              </button>
            </div>

            {/* Quick tags */}
            <div className="flex flex-wrap gap-2">
              {['Santexnik', 'Elektrik', 'Gözəllik', 'Kompüter', 'Təmizlik'].map(t => (
                <button
                  key={t}
                  onClick={() => navigate(`/mutexessisler?q=${t}`)}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-medium transition-all"
                >
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
            {[['1,240+', 'Qeydiyyatlı mütəxəssis'], ['8,500+', 'Tamamlanmış iş'], ['50+', 'Kateqoriya']].map(([n, l]) => (
              <div key={l} className="py-5 text-center">
                <div className="text-2xl font-bold text-primary-600">{n}</div>
                <div className="text-xs text-gray-400 mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Kateqoriyalar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Kateqoriyalar</h2>
          <Link to="/mutexessisler" className="text-sm text-primary-600 hover:underline font-medium">Hamısına bax →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {KATEQORIYALAR.map(k => (
            <button
              key={k.ad}
              onClick={() => navigate(`/mutexessisler?q=${k.ad}`)}
              className="group card p-4 text-center hover:shadow-md hover:border-primary-200 transition-all cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl transition-all ${k.reng}`}>
                {k.ikon}
              </div>
              <div className="text-sm font-semibold text-gray-700 group-hover:text-primary-600 transition-colors">{k.ad}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Mütəxəssislər */}
      {mutexessisler.length > 0 && (
        <div className="bg-gray-50 py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Tövsiyə olunan mütəxəssislər</h2>
              <Link to="/mutexessisler" className="text-sm text-primary-600 hover:underline font-medium">Hamısına bax →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mutexessisler.map(m => (
                <Link key={m.id} to={`/mutexessis/${m.id}`} className="card p-5 hover:shadow-md hover:border-primary-200 transition-all block group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-600 font-bold text-lg shrink-0 group-hover:bg-primary-100 transition-colors">
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
                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <span className="text-xs text-gray-500">Başlayan: <strong className="text-gray-700">{m.start_price} AZN</strong></span>
                    <span className="text-xs font-medium text-primary-600 group-hover:translate-x-0.5 transition-transform">Ətraflı →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── NECƏ İŞLƏYİR — ANİMASİYALI CAROUSEL ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="text-center mb-10">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Necə işləyir?</h2>
          <p className="text-sm text-gray-500">Dörd sadə addımda işini həll et</p>
        </div>
        <HowCarousel />
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-primary-600 to-blue-700 text-white py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Sən də mütəxəssississən?</h2>
          <p className="text-blue-100 mb-8 text-sm">Axtar.xyz-də profil aç, elan ver və hər gün yeni müştərilər qazan</p>
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
