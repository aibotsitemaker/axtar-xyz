import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const KATEQORIYALAR = ['Hamısı','Santexnik','Elektrik','Təmizlik','Rəssam','Gözəllik','Kompüter','Avtomobil','Köçürmə','Digər']

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-4 animate-pulse border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 bg-gray-100 rounded-full w-20" />
        <div className="h-4 bg-gray-100 rounded-full w-12" />
      </div>
      <div className="h-4 bg-gray-100 rounded-full w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 rounded-full w-full mb-1.5" />
      <div className="h-3 bg-gray-100 rounded-full w-4/5 mb-4" />
      <div className="flex justify-between pt-3 border-t border-gray-50">
        <div className="h-3 bg-gray-100 rounded-full w-1/3" />
        <div className="h-8 bg-gray-100 rounded-xl w-24" />
      </div>
    </div>
  )
}

function TrendingBanner({ elan }) {
  if (!elan) return null
  return (
    <div className="bg-gradient-to-r from-orange-400 to-pink-500 rounded-2xl p-4 text-white mb-4 shadow-md">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0">🔥</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-orange-100 uppercase tracking-wide mb-1">Bu günün trending elanı</div>
          <div className="font-bold text-sm leading-snug truncate">{elan.title}</div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-orange-100">
            <span>{elan.category}</span>
            <span>👁 {elan.views} baxış</span>
            {elan.budget && <span>💰 {elan.budget} AZN</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ViewBadge({ count }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-medium">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      {count || 0}
    </span>
  )
}

export default function Elanlar() {
  const { user } = useAuth()
  const [elanlar, setElanlar] = useState([])
  const [loading, setLoading] = useState(true)
  const [kateqoriya, setKateqoriya] = useState('Hamısı')
  const [trendingElan, setTrendingElan] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showMuraciet, setShowMuraciet] = useState(null)
  const [muracietForm, setMuracietForm] = useState({ message: '', price_offer: '' })
  const [muracietGonderilib, setMuracietGonderilib] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'Santexnik', city: 'Bakı', budget: '' })
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  const yukle = useCallback(async (kat) => {
    setLoading(true)
    let q = supabase.from('elanlar')
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
  }, [])

  const elanEkle = async () => {
    setFormError('')
    if (!form.title.trim()) { setFormError('Başlıq boş ola bilməz'); return }
    if (!user) { setFormError('Daxil olun'); return }
    setFormSaving(true)
    const { error } = await supabase.from('elanlar').insert({
      ...form, user_id: user.id,
      budget: parseFloat(form.budget) || null, views: 0
    })
    if (error) { setFormError('Xəta baş verdi'); setFormSaving(false); return }
    setShowForm(false)
    setForm({ title: '', description: '', category: 'Santexnik', city: 'Bakı', budget: '' })
    setFormSaving(false)
    yukle(kateqoriya)
    yukletrending()
  }

  const muracietGonder = async () => {
    if (!muracietForm.message.trim() || !showMuraciet) return
    await supabase.from('muracietler').insert({
      elan_id: showMuraciet.id, mutexessis_id: user.id,
      message: muracietForm.message,
      price_offer: parseFloat(muracietForm.price_offer) || null
    })
    await supabase.from('bildirisler').insert({
      user_id: showMuraciet.user_id, tip: 'muraciet',
      metn: `"${showMuraciet.title}" elanınıza yeni müraciət var`,
      link: '/dashboard'
    })
    setMuracietGonderilib(true)
  }

  const modalBag = () => {
    setShowMuraciet(null)
    setMuracietForm({ message: '', price_offer: '' })
    setMuracietGonderilib(false)
  }

  return (
    <div className="bg-[#F2F4F7] min-h-screen pb-28">

      {/* Header */}
      <div className="bg-[#185FA5] pt-12 pb-5 px-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-white font-bold text-xl">Elanlar</h1>
          {user ? (
            <button onClick={() => setShowForm(true)}
              className="bg-white text-[#185FA5] text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-transform shadow-md">
              + Elan ver
            </button>
          ) : (
            <Link to="/giris" className="bg-white text-[#185FA5] text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-transform shadow-md">
              Daxil ol
            </Link>
          )}
        </div>
        <p className="text-blue-200 text-xs">{elanlar.length} aktiv elan</p>
      </div>

      <div className="px-4 mt-4">

        {/* Trending */}
        <TrendingBanner elan={trendingElan} />

        {/* Kateqoriya chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {KATEQORIYALAR.map(k => (
            <button key={k}
              onClick={() => { setKateqoriya(k); yukle(k) }}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 shrink-0 ${kateqoriya === k ? 'bg-[#185FA5] text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {k}
            </button>
          ))}
        </div>

        {/* Elanlar */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : elanlar.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="font-bold text-gray-700 text-base mb-2">Hələ ki, elan yoxdur</h3>
            <p className="text-sm text-gray-400 mb-5">Bu kateqoriyada hələ elan yoxdur</p>
            {user && <button onClick={() => setShowForm(true)} className="bg-[#185FA5] text-white text-sm font-semibold px-5 py-2.5 rounded-2xl active:scale-95 transition-transform">+ Elan ver</button>}
          </div>
        ) : (
          <div className="space-y-3">
            {elanlar.map(e => (
              <div key={e.id} className={`bg-white rounded-2xl p-4 border shadow-sm relative ${e.is_vip ? 'border-yellow-300 border-2' : e.is_featured ? 'border-[#185FA5] border-2' : 'border-gray-100'}`}>
                {e.is_vip && <span className="absolute -top-2.5 right-3 bg-yellow-400 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow">⭐ VIP</span>}
                {e.is_featured && !e.is_vip && <span className="absolute -top-2.5 right-3 bg-[#185FA5] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow">🔝 Öndə</span>}

                <div className="flex items-center justify-between mb-2">
                  <span className="bg-blue-50 text-[#185FA5] text-xs font-semibold px-2.5 py-1 rounded-full">{e.category}</span>
                  <ViewBadge count={e.views} />
                </div>

                <h3 className="font-bold text-gray-800 text-sm mb-2 leading-snug">{e.title}</h3>
                {e.description && <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">{e.description}</p>}

                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>📍 {e.city || e.hesablar?.city}</span>
                    {e.budget && <span>💰 {e.budget} AZN</span>}
                  </div>
                  {user && e.user_id !== user.id ? (
                    <button onClick={() => setShowMuraciet(e)}
                      className="bg-[#185FA5] text-white text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-transform">
                      Müraciət et
                    </button>
                  ) : !user ? (
                    <Link to="/giris" className="bg-[#185FA5] text-white text-xs font-bold px-4 py-2 rounded-xl">
                      Müraciət et
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Elan əlavə et — Bottom Sheet */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-10 shadow-2xl max-h-[90vh] overflow-y-auto slide-up">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="font-bold text-gray-800 text-base mb-4">Yeni elan</h3>
            {formError && <div className="bg-red-50 text-red-500 text-xs px-3 py-2.5 rounded-xl mb-3">⚠️ {formError}</div>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Başlıq *</label>
                <input className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#185FA5]" placeholder="məs: Santexnik lazımdır" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Ətraflı məlumat</label>
                <textarea className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#185FA5] resize-none" rows={3} placeholder="İş haqqında ətraflı yazın..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Kateqoriya</label>
                  <select className="w-full border border-gray-200 rounded-2xl px-3 py-3 text-sm outline-none" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {KATEQORIYALAR.filter(k => k !== 'Hamısı').map(k => <option key={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Şəhər</label>
                  <select className="w-full border border-gray-200 rounded-2xl px-3 py-3 text-sm outline-none" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}>
                    {['Bakı','Gəncə','Sumqayıt','Mingəçevir','Digər'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Büdcə (AZN)</label>
                <input className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#185FA5]" type="number" min="0" placeholder="məs: 50" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={elanEkle} disabled={formSaving} className="flex-1 bg-[#185FA5] text-white text-sm font-bold py-3.5 rounded-2xl active:scale-95 transition-transform disabled:opacity-50">
                {formSaving ? '⏳ Gözləyin...' : '📢 Elan ver'}
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-600 text-sm font-semibold py-3.5 rounded-2xl active:scale-95 transition-transform">
                Ləğv et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Müraciət — Bottom Sheet */}
      {showMuraciet && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={e => e.target === e.currentTarget && modalBag()}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-10 shadow-2xl slide-up">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="font-bold text-gray-800 text-base mb-1">Müraciət et</h3>
            <p className="text-xs text-gray-400 mb-4 truncate">📋 {showMuraciet.title}</p>
            {muracietGonderilib ? (
              <div className="bg-green-50 text-green-600 text-sm text-center py-5 rounded-2xl font-semibold">
                ✅ Müraciətiniz göndərildi!
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Mesajınız *</label>
                  <textarea className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#185FA5] resize-none" rows={4} placeholder="Özünüz haqqında yazın, nə zaman başlaya bilərsiniz..." value={muracietForm.message} onChange={e => setMuracietForm(p => ({ ...p, message: e.target.value }))} autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Qiymət təklifiniz (AZN)</label>
                  <div className="relative">
                    <input className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#185FA5] pr-14" type="number" min="0" placeholder="0" value={muracietForm.price_offer} onChange={e => setMuracietForm(p => ({ ...p, price_offer: e.target.value }))} />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">AZN</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={muracietGonder} disabled={!muracietForm.message.trim()} className="flex-1 bg-[#185FA5] text-white text-sm font-bold py-3.5 rounded-2xl active:scale-95 transition-transform disabled:opacity-40">
                    📨 Göndər
                  </button>
                  <button onClick={modalBag} className="flex-1 bg-gray-100 text-gray-600 text-sm font-semibold py-3.5 rounded-2xl active:scale-95 transition-transform">
                    Ləğv et
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
