import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const KATEQORIYALAR = ['Hamısı','Santexnik','Elektrik','Təmizlik','Rəssam','Gözəllik','Kompüter','Avtomobil','Köçürmə','Digər']

/* Ziyarətçi ID — sessionStorage əsaslı, hər sessiyada unikal */
function getVisitorId() {
  let vid = sessionStorage.getItem('axtar_vid')
  if (!vid) {
    vid = 'v_' + Math.random().toString(36).slice(2) + '_' + Date.now()
    sessionStorage.setItem('axtar_vid', vid)
  }
  return vid
}

/* Baxış sayğacı komponenti */
function ViewCount({ count, animate }) {
  const [displayed, setDisplayed] = useState(count)
  const prev = useRef(count)

  useEffect(() => {
    if (count === prev.current) return
    const diff = count - prev.current
    const steps = Math.min(Math.abs(diff), 20)
    let step = 0
    const interval = setInterval(() => {
      step++
      setDisplayed(Math.round(prev.current + (diff * step) / steps))
      if (step >= steps) {
        setDisplayed(count)
        prev.current = count
        clearInterval(interval)
      }
    }, 30)
    return () => clearInterval(interval)
  }, [count])

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium transition-all ${animate ? 'text-primary-600' : 'text-gray-400'}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      {displayed}
    </span>
  )
}

/* Trending badge */
function TrendingBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-400 to-pink-500 text-white text-[10px] font-bold shadow-sm">
      <span className="animate-bounce">🔥</span> Trending
    </span>
  )
}

/* Sayğac animasiyası — canlı baxış */
function LiveViewPulse() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300)
    return () => clearTimeout(t)
  }, [])
  return show ? (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 absolute" />
    </span>
  ) : null
}

/* Elan kartı */
function ElanCard({ elan, user, onMuraciet, trendingId }) {
  const [views, setViews] = useState(elan.views || 0)
  const [baxisEdilib, setBaxisEdilib] = useState(false)
  const cardRef = useRef(null)
  const isTrending = elan.id === trendingId

  /* Intersection Observer ilə baxış qeydiyyatı */
  useEffect(() => {
    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !baxisEdilib) {
          setBaxisEdilib(true)
          const vid = getVisitorId()

          /* 24 saatda bir dəfə sayıl */
          const { data: movcud } = await supabase
            .from('elan_baxislar')
            .select('id')
            .eq('elan_id', elan.id)
            .eq('visitor_id', vid)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .single()

          if (!movcud) {
            await supabase.from('elan_baxislar').insert({ elan_id: elan.id, visitor_id: vid })
            const { data } = await supabase
              .from('elanlar')
              .update({ views: (elan.views || 0) + 1 })
              .eq('id', elan.id)
              .select('views')
              .single()
            if (data) setViews(data.views)
          }
        }
      },
      { threshold: 0.5 }
    )
    if (cardRef.current) observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [elan.id, elan.views, baxisEdilib])

  return (
    <div
      ref={cardRef}
      className={`card p-5 relative transition-all hover:shadow-md ${
        isTrending
          ? 'border-2 border-orange-300 shadow-orange-100 shadow-md'
          : elan.is_vip
          ? 'border-2 border-yellow-300'
          : elan.is_featured
          ? 'border-2 border-primary-300'
          : 'hover:border-primary-200'
      }`}
    >
      {/* Badges */}
      <div className="absolute -top-2.5 right-3 flex gap-1.5">
        {isTrending && <TrendingBadge />}
        {elan.is_vip && !isTrending && (
          <span className="badge bg-yellow-400 text-white text-xs font-bold shadow">⭐ VIP</span>
        )}
        {elan.is_featured && !elan.is_vip && !isTrending && (
          <span className="badge bg-primary-600 text-white text-xs font-bold shadow">🔝 Öndə</span>
        )}
      </div>

      {/* Kateqoriya + baxış */}
      <div className="flex items-center justify-between mb-3">
        <span className="badge bg-primary-50 text-primary-600 text-xs">{elan.category}</span>
        <div className="flex items-center gap-2">
          {baxisEdilib && <LiveViewPulse />}
          <ViewCount count={views} animate={baxisEdilib} />
        </div>
      </div>

      <h3 className="font-semibold text-gray-800 text-sm mb-2 leading-snug">{elan.title}</h3>

      {elan.description && (
        <p className="text-xs text-gray-500 leading-relaxed mb-4 line-clamp-2">{elan.description}</p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>📍 {elan.city || elan.hesablar?.city}</span>
          {elan.budget && <span>💰 {elan.budget} AZN</span>}
        </div>
        {user && elan.user_id !== user.id ? (
          <button
            onClick={() => onMuraciet(elan)}
            className="btn-primary text-xs py-1.5 px-3"
          >
            Müraciət et
          </button>
        ) : !user ? (
          <Link to="/giris" className="btn-primary text-xs py-1.5 px-3">Müraciət et</Link>
        ) : null}
      </div>
    </div>
  )
}

/* Trending Panel */
function TrendingPanel({ elan }) {
  if (!elan) return null
  return (
    <div className="card p-5 mb-6 border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-pink-50">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-2xl shrink-0 shadow-md">
          🔥
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">Bu günün ən məşhur elanı</span>
            <TrendingBadge />
          </div>
          <h3 className="font-bold text-gray-800 text-sm leading-snug mb-2">{elan.title}</h3>
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span className="badge bg-orange-100 text-orange-600">{elan.category}</span>
            <span>📍 {elan.city}</span>
            {elan.budget && <span>💰 {elan.budget} AZN</span>}
            <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              {elan.views} baxış
            </span>
            <span className="text-pink-600 font-medium">📨 {elan.muraciet_sayi} müraciət</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── ANA KOMPONENT ── */
export default function Elanlar() {
  const { user } = useAuth()
  const [elanlar, setElanlar] = useState([])
  const [loading, setLoading] = useState(true)
  const [kateqoriya, setKateqoriya] = useState('Hamısı')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'Santexnik', city: 'Bakı', budget: '' })
  const [muracietModal, setMuracietModal] = useState(null)
  const [muracietForm, setMuracietForm] = useState({ message: '', price_offer: '' })
  const [muracietGonderilib, setMuracietGonderilib] = useState(false)
  const [trendingElan, setTrendingElan] = useState(null)
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  const yukle = useCallback(async (kat) => {
    setLoading(true)
    let q = supabase
      .from('elanlar')
      .select('*, hesablar(full_name, city)')
      .eq('status', 'aktiv')
      .order('is_featured', { ascending: false })
      .order('is_vip', { ascending: false })
      .order('views', { ascending: false })
      .order('created_at', { ascending: false })
    if (kat && kat !== 'Hamısı') q = q.eq('category', kat)
    const { data } = await q
    setElanlar(data || [])
    setLoading(false)
  }, [])

  const yukletrending = useCallback(async () => {
    const { data } = await supabase.rpc('get_trending_elan')
    if (data && data.length > 0) setTrendingElan(data[0])
  }, [])

  useEffect(() => {
    yukle('Hamısı')
    yukletrending()

    /* Real-time: yeni elan əlavə olunanda yenilə */
    const channel = supabase.channel('elanlar_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'elanlar' }, () => {
        yukle(kateqoriya)
        yukletrending()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const elanEkle = async () => {
    setFormError('')
    if (!form.title.trim()) { setFormError('Başlıq boş ola bilməz'); return }
    if (!user) { setFormError('Daxil olun'); return }
    setFormSaving(true)
    const { error } = await supabase.from('elanlar').insert({
      ...form,
      user_id: user.id,
      budget: parseFloat(form.budget) || null,
      views: 0
    })
    if (error) { setFormError('Xəta baş verdi'); setFormSaving(false); return }
    setShowForm(false)
    setForm({ title: '', description: '', category: 'Santexnik', city: 'Bakı', budget: '' })
    setFormSaving(false)
    yukle(kateqoriya)
    yukletrending()
  }

  const muracietGonder = async () => {
    if (!muracietForm.message.trim()) return
    await supabase.from('muracietler').insert({
      elan_id: muracietModal.id,
      mutexessis_id: user.id,
      message: muracietForm.message,
      price_offer: parseFloat(muracietForm.price_offer) || null
    })
    await supabase.from('bildirisler').insert({
      user_id: muracietModal.user_id,
      tip: 'muraciet',
      metn: `"${muracietModal.title}" elanınıza yeni müraciət var`,
      link: '/dashboard'
    })
    setMuracietGonderilib(true)
  }

  const modalBag = () => {
    setMuracietModal(null)
    setMuracietForm({ message: '', price_offer: '' })
    setMuracietGonderilib(false)
  }

  const trendingId = trendingElan?.id

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Elanlar</h1>
          <p className="text-sm text-gray-500 mt-0.5">{elanlar.length} aktiv elan</p>
        </div>
        {user ? (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? '✕ Bağla' : '+ Elan ver'}
          </button>
        ) : (
          <Link to="/giris" className="btn-primary">Elan üçün daxil ol</Link>
        )}
      </div>

      {/* Trending panel */}
      <TrendingPanel elan={trendingElan} />

      {/* Elan forması */}
      {showForm && (
        <div className="card p-5 mb-6 border-primary-100">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 text-sm">+</span>
            Yeni elan
          </h3>
          {formError && (
            <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-2.5 text-sm mb-4">⚠️ {formError}</div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Başlıq *</label>
              <input className="input" placeholder="məs: Santexnik lazımdır" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ətraflı təsvir</label>
              <textarea className="input resize-none" rows={3} placeholder="İş haqqında ətraflı yazın..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Kateqoriya</label>
                <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {KATEQORIYALAR.filter(k => k !== 'Hamısı').map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Şəhər</label>
                <select className="input" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}>
                  {['Bakı','Gəncə','Sumqayıt','Mingəçevir','Digər'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Büdcə (AZN)</label>
              <input className="input" type="number" min="0" placeholder="məs: 50" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={elanEkle} disabled={formSaving} className="btn-primary">
              {formSaving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Elan verilir...</> : '📢 Elan ver'}
            </button>
            <button onClick={() => { setShowForm(false); setFormError('') }} className="btn-secondary">Ləğv et</button>
          </div>
        </div>
      )}

      {/* Filterlər */}
      <div className="flex gap-2 flex-wrap mb-6 overflow-x-auto pb-1">
        {KATEQORIYALAR.map(k => (
          <button
            key={k}
            onClick={() => { setKateqoriya(k); yukle(k) }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              kateqoriya === k
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Elanlar siyahısı */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Elanlar yüklənir...</p>
        </div>
      ) : elanlar.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-500 font-medium">Elan tapılmadı</p>
          <p className="text-sm text-gray-400 mt-1">Filteri dəyişdirməyi cəhd edin</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {elanlar.map(e => (
            <ElanCard
              key={e.id}
              elan={e}
              user={user}
              onMuraciet={setMuracietModal}
              trendingId={trendingId}
            />
          ))}
        </div>
      )}

      {/* Müraciət modal */}
      {muracietModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && modalBag()}
        >
          <div className="card p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Müraciət et</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">📋 {muracietModal.title}</p>
              </div>
              <button onClick={modalBag} className="text-gray-400 hover:text-gray-600 text-xl leading-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">✕</button>
            </div>

            {muracietGonderilib ? (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">✅</div>
                <p className="font-semibold text-gray-800">Müraciətiniz göndərildi!</p>
                <p className="text-sm text-gray-500 mt-1">Elan sahibi sizinlə əlaqə saxlayacaq</p>
                <button onClick={modalBag} className="btn-primary mt-4 mx-auto">Bağla</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mesajınız *</label>
                  <textarea
                    className="input resize-none"
                    rows={4}
                    placeholder="Özünüz haqqında yazın, nə zaman başlaya bilərsiniz, əvvəlki təcrübəniz..."
                    value={muracietForm.message}
                    onChange={e => setMuracietForm(p => ({ ...p, message: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Qiymət təklifiniz (AZN)
                    <span className="text-gray-400 font-normal ml-1">— isteğe bağlı</span>
                  </label>
                  <div className="relative">
                    <input
                      className="input pr-14"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={muracietForm.price_offer}
                      onChange={e => setMuracietForm(p => ({ ...p, price_offer: e.target.value }))}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">AZN</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={muracietGonder}
                    disabled={!muracietForm.message.trim()}
                    className="btn-primary flex-1 justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    📨 Göndər
                  </button>
                  <button onClick={modalBag} className="btn-secondary flex-1 justify-center py-3">Ləğv et</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
