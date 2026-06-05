import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function MutexessisProfile() {
  const { id } = useParams()
  const { user, hesab } = useAuth()
  const navigate = useNavigate()
  const [mutexessis, setMutexessis] = useState(null)
  const [reyler, setReyler] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [loading, setLoading] = useState(true)
  const [ozProfil, setOzProfil] = useState(false)
  const [activeTab, setActiveTab] = useState('haqqinda')
  const [mesaj, setMesaj] = useState('')
  const [mesajGonderilib, setMesajGonderilib] = useState(false)
  const [showMesajModal, setShowMesajModal] = useState(false)
  const [reyForm, setReyForm] = useState({ rating: 5, comment: '' })
  const [reyGonderilib, setReyGonderilib] = useState(false)
  const [reyError, setReyError] = useState('')
  const [hoveredStar, setHoveredStar] = useState(0)
  const [showReyModal, setShowReyModal] = useState(false)
  const [sekillYuklenir, setSekillYuklenir] = useState(false)
  const [caption, setCaption] = useState('')
  const fileRef = useRef()

  useEffect(() => {
    const yukle = async () => {
      const { data: m } = await supabase.from('mutexessis_hesablari')
        .select('*, hesablar(id, full_name, city, phone)').eq('id', id).single()
      setMutexessis(m)
      const { data: r } = await supabase.from('reyler')
        .select('*, hesablar(full_name)').eq('mutexessis_id', id)
        .order('created_at', { ascending: false })
      setReyler(r || [])
      const { data: p } = await supabase.from('portfolio_sekiller')
        .select('*').eq('mutexessis_id', id).order('created_at', { ascending: false })
      setPortfolio(p || [])
      setLoading(false)
    }
    yukle()
  }, [id])

  useEffect(() => {
    if (!user) return
    supabase.from('mutexessis_hesablari').select('id').eq('id', id).eq('user_id', user.id).single()
      .then(({ data }) => setOzProfil(!!data))
    supabase.from('reyler').select('id').eq('musteri_id', user.id).eq('mutexessis_id', id).single()
      .then(({ data }) => { if (data) setReyGonderilib(true) })
  }, [user, id])

  const mesajGonder = async () => {
    if (!mesaj.trim() || !user) return
    await supabase.from('mesajlar').insert({ sender_id: user.id, receiver_id: mutexessis.hesablar.id, content: mesaj })
    await supabase.from('bildirisler').insert({ user_id: mutexessis.hesablar.id, tip: 'mesaj', metn: `${hesab?.full_name || 'Biri'} sizə mesaj göndərdi`, link: '/dashboard' })
    setMesajGonderilib(true)
    setMesaj('')
  }

  const reyGonder = async () => {
    setReyError('')
    if (!user) { setReyError('Daxil olun'); return }
    if (ozProfil) { setReyError('Öz profilinizə rəy yaza bilməzsiniz'); return }
    if (!reyForm.comment.trim()) { setReyError('Rəy yazın'); return }
    const { error } = await supabase.from('reyler').insert({ musteri_id: user.id, mutexessis_id: id, rating: reyForm.rating, comment: reyForm.comment })
    if (error) { setReyError('Xəta baş verdi'); return }
    setReyGonderilib(true)
    setShowReyModal(false)
    const { data: r } = await supabase.from('reyler').select('*, hesablar(full_name)').eq('mutexessis_id', id).order('created_at', { ascending: false })
    setReyler(r || [])
    const { data: m } = await supabase.from('mutexessis_hesablari').select('*, hesablar(id, full_name, city, phone)').eq('id', id).single()
    setMutexessis(m)
  }

  const sekillYukle = async (e) => {
    const fayl = e.target.files[0]
    if (!fayl) return
    if (fayl.size > 5 * 1024 * 1024) { alert('5MB-dan böyük ola bilməz'); return }
    setSekillYuklenir(true)
    const faylAdi = `${user.id}/${Date.now()}_${fayl.name}`
    const { error } = await supabase.storage.from('portfolio').upload(faylAdi, fayl)
    if (error) { alert('Yüklənmədi'); setSekillYuklenir(false); return }
    const { data: urlData } = supabase.storage.from('portfolio').getPublicUrl(faylAdi)
    await supabase.from('portfolio_sekiller').insert({ user_id: user.id, mutexessis_id: id, image_url: urlData.publicUrl, caption })
    const { data: p } = await supabase.from('portfolio_sekiller').select('*').eq('mutexessis_id', id).order('created_at', { ascending: false })
    setPortfolio(p || [])
    setCaption('')
    setSekillYuklenir(false)
  }

  const sekillSil = async (sekil) => {
    if (!window.confirm('Silmək istəyirsiniz?')) return
    const yol = sekil.image_url.split('/portfolio/')[1]
    await supabase.storage.from('portfolio').remove([yol])
    await supabase.from('portfolio_sekiller').delete().eq('id', sekil.id)
    setPortfolio(portfolio.filter(p => p.id !== sekil.id))
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#F2F4F7]">
      <div className="w-8 h-8 border-4 border-blue-100 border-t-[#185FA5] rounded-full animate-spin" />
    </div>
  )

  if (!mutexessis) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F2F4F7] px-6 text-center">
      <div className="text-5xl mb-4">😔</div>
      <h3 className="font-bold text-gray-700 mb-2">Tapılmadı</h3>
      <Link to="/mutexessisler" className="bg-[#185FA5] text-white text-sm font-semibold px-5 py-2.5 rounded-2xl mt-4">Geri qayıt</Link>
    </div>
  )

  const ratingAvg = mutexessis.rating?.toFixed(1) || '0.0'
  const TABS = [
    { id: 'haqqinda', label: 'Haqqında' },
    { id: 'portfolio', label: `Portfolio (${portfolio.length})` },
    { id: 'reyler', label: `Rəylər (${reyler.length})` },
  ]

  return (
    <div className="bg-[#F2F4F7] min-h-screen pb-32">
      <div className="bg-[#185FA5] pt-12 pb-20 px-4">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white mb-4 active:scale-95">←</button>
        <h1 className="text-white font-bold text-lg">Mütəxəssis profili</h1>
      </div>

      <div className="px-4 -mt-14">
        <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-[#185FA5] font-bold text-2xl shrink-0">
              {mutexessis.hesablar?.full_name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-gray-800 text-base">{mutexessis.hesablar?.full_name}</h2>
                {mutexessis.is_verified && <span className="bg-green-50 text-green-600 text-xs font-semibold px-2 py-0.5 rounded-full">✅ Təsdiqlənib</span>}
                {ozProfil && <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">Öz profiliniz</span>}
              </div>
              <p className="text-gray-400 text-xs mt-0.5">{mutexessis.category} · {mutexessis.hesablar?.city}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex">{[1,2,3,4,5].map(s=><span key={s} className={`text-sm ${s<=Math.round(mutexessis.rating||0)?'text-yellow-400':'text-gray-200'}`}>★</span>)}</div>
                <span className="text-sm font-bold text-[#185FA5]">{ratingAvg}</span>
                <span className="text-xs text-gray-400">({mutexessis.review_count} rəy)</span>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                <span className="bg-blue-50 text-[#185FA5] text-xs font-semibold px-2.5 py-1 rounded-xl">🕐 {mutexessis.experience_years} il</span>
                <span className="bg-blue-50 text-[#185FA5] text-xs font-semibold px-2.5 py-1 rounded-xl">💰 {mutexessis.start_price} AZN-dən</span>
              </div>
            </div>
          </div>
          {!ozProfil && (
            <div className="flex gap-2 mt-4">
              {mutexessis.hesablar?.phone && (
                <a href={`tel:${mutexessis.hesablar.phone}`} className="flex-1 bg-[#185FA5] text-white text-sm font-semibold py-3 rounded-2xl text-center active:scale-95 transition-transform">📞 Zəng et</a>
              )}
              <button onClick={() => user ? setShowMesajModal(true) : navigate('/giris')} className="flex-1 bg-gray-100 text-gray-700 text-sm font-semibold py-3 rounded-2xl active:scale-95 transition-transform">💬 Mesaj</button>
            </div>
          )}
          {ozProfil && (
            <Link to="/profil/redakte" className="mt-4 block w-full bg-gray-100 text-gray-700 text-sm font-semibold py-3 rounded-2xl text-center active:scale-95 transition-transform">✎ Profili redaktə et</Link>
          )}
        </div>
      </div>

      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl p-1 flex gap-1 border border-gray-100">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab===t.id?'bg-[#185FA5] text-white shadow-sm':'text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-3">
        {activeTab === 'haqqinda' && (
          <div className="space-y-3">
            {mutexessis.bio ? (
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <h3 className="font-bold text-gray-700 text-sm mb-2">Haqqında</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{mutexessis.bio}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center py-8 text-center px-4">
                <div className="text-4xl mb-2">📝</div>
                <p className="text-sm text-gray-400">Məlumat əlavə edilməyib</p>
              </div>
            )}
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <h3 className="font-bold text-gray-700 text-sm mb-3">Reytinq xülasəsi</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-center">
                  <div className="text-4xl font-black text-[#185FA5]">{ratingAvg}</div>
                  <div className="flex justify-center mt-1">{[1,2,3,4,5].map(s=><span key={s} className={`text-sm ${s<=Math.round(mutexessis.rating||0)?'text-yellow-400':'text-gray-200'}`}>★</span>)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{mutexessis.review_count} rəy</div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5,4,3,2,1].map(s => {
                    const sayi = reyler.filter(r=>r.rating===s).length
                    const faiz = reyler.length>0?(sayi/reyler.length)*100:0
                    return (
                      <div key={s} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4">{s}★</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-yellow-400 h-full rounded-full" style={{width:`${faiz}%`}} />
                        </div>
                        <span className="text-xs text-gray-400 w-4">{sayi}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {!ozProfil && !reyGonderilib && user && (
                <button onClick={() => setShowReyModal(true)} className="w-full bg-yellow-400 text-gray-800 text-sm font-bold py-3 rounded-2xl active:scale-95 transition-transform">⭐ Rəy yaz</button>
              )}
              {reyGonderilib && <div className="bg-green-50 text-green-600 text-sm text-center py-2.5 rounded-xl font-medium">✅ Rəyiniz göndərildi!</div>}
              {!user && <Link to="/giris" className="block w-full bg-gray-100 text-gray-600 text-sm font-semibold py-3 rounded-2xl text-center">Rəy yazmaq üçün daxil olun</Link>}
            </div>
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            {ozProfil && (
              <div className="mb-4 space-y-2">
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#185FA5]" placeholder="Şəkil açıqlaması" value={caption} onChange={e=>setCaption(e.target.value)} />
                <button onClick={() => fileRef.current.click()} disabled={sekillYuklenir} className="w-full bg-[#185FA5] text-white text-sm font-semibold py-3 rounded-2xl active:scale-95 disabled:opacity-50">
                  {sekillYuklenir ? '⏳ Yüklənir...' : '📸 Şəkil əlavə et'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={sekillYukle} className="hidden" />
              </div>
            )}
            {portfolio.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="text-4xl mb-3">🖼️</div>
                <p className="text-sm text-gray-400">{ozProfil ? 'İşlərinizin şəkillərini əlavə edin' : 'Portfolio şəkli yoxdur'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {portfolio.map(p => (
                  <div key={p.id} className="relative group rounded-xl overflow-hidden aspect-square">
                    <img src={p.image_url} alt={p.caption||''} className="w-full h-full object-cover" />
                    {ozProfil && <button onClick={()=>sekillSil(p)} className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100">✕</button>}
                    {p.caption && <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] p-1.5 truncate">{p.caption}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reyler' && (
          <div className="space-y-3">
            {reyler.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center py-10 text-center px-4">
                <div className="text-4xl mb-3">💬</div>
                <h3 className="font-semibold text-gray-600 text-sm mb-1">Hələ rəy yoxdur</h3>
                <p className="text-xs text-gray-400">İlk rəyi siz yazın!</p>
              </div>
            ) : reyler.map(r => (
              <div key={r.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#185FA5] font-bold text-sm">{r.hesablar?.full_name?.[0]||'?'}</div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{r.hesablar?.full_name}</div>
                      <div className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('az')}</div>
                    </div>
                  </div>
                  <div className="flex">{[1,2,3,4,5].map(s=><span key={s} className={`text-sm ${s<=r.rating?'text-yellow-400':'text-gray-200'}`}>★</span>)}</div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showMesajModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={e=>e.target===e.currentTarget&&setShowMesajModal(false)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-8 shadow-2xl slide-up">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="font-bold text-gray-800 text-base mb-1">Mesaj göndər</h3>
            <p className="text-xs text-gray-400 mb-4">{mutexessis.hesablar?.full_name}</p>
            {mesajGonderilib ? (
              <div className="bg-green-50 text-green-600 text-sm text-center py-4 rounded-2xl font-medium">✅ Mesajınız göndərildi!</div>
            ) : (
              <>
                <textarea className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#185FA5] resize-none min-h-[100px]" placeholder="Mesajınızı yazın..." value={mesaj} onChange={e=>setMesaj(e.target.value)} autoFocus />
                <div className="flex gap-2 mt-3">
                  <button onClick={mesajGonder} disabled={!mesaj.trim()} className="flex-1 bg-[#185FA5] text-white text-sm font-bold py-3.5 rounded-2xl active:scale-95 disabled:opacity-40">Göndər</button>
                  <button onClick={()=>setShowMesajModal(false)} className="flex-1 bg-gray-100 text-gray-600 text-sm font-semibold py-3.5 rounded-2xl active:scale-95">Ləğv et</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showReyModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={e=>e.target===e.currentTarget&&setShowReyModal(false)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-8 shadow-2xl slide-up">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="font-bold text-gray-800 text-base mb-4">Rəy yaz</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">Qiymətləndirmə</label>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(s=>(
                  <button key={s} onClick={()=>setReyForm(p=>({...p,rating:s}))} onMouseEnter={()=>setHoveredStar(s)} onMouseLeave={()=>setHoveredStar(0)}
                    className={`text-3xl transition-all active:scale-90 ${s<=(hoveredStar||reyForm.rating)?'text-yellow-400':'text-gray-200'}`}>★</button>
                ))}
                <span className="text-sm text-gray-400 ml-2">{['','Pis','Orta','Yaxşı','Çox yaxşı','Əla'][hoveredStar||reyForm.rating]}</span>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">Rəyiniz</label>
              <textarea className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#185FA5] resize-none min-h-[90px]" placeholder="Mütəxəssisin işi haqqında yazın..." value={reyForm.comment} onChange={e=>setReyForm(p=>({...p,comment:e.target.value}))} autoFocus />
            </div>
            {reyError && <div className="bg-red-50 text-red-500 text-xs px-3 py-2 rounded-xl mb-3">⚠️ {reyError}</div>}
            <div className="flex gap-2">
              <button onClick={reyGonder} disabled={!reyForm.comment.trim()} className="flex-1 bg-yellow-400 text-gray-800 text-sm font-bold py-3.5 rounded-2xl active:scale-95 disabled:opacity-40">⭐ Göndər</button>
              <button onClick={()=>setShowReyModal(false)} className="flex-1 bg-gray-100 text-gray-600 text-sm font-semibold py-3.5 rounded-2xl active:scale-95">Ləğv et</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
