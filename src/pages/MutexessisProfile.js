import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function MutexessisProfile() {
  const { id } = useParams()
  const { user, hesab } = useAuth()
  const [mutexessis, setMutexessis] = useState(null)
  const [reyler, setReyler] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [loading, setLoading] = useState(true)
  const [ozProfil, setOzProfil] = useState(false)
  const [mesaj, setMesaj] = useState('')
  const [mesajGonderilib, setMesajGonderilib] = useState(false)
  const [reyForm, setReyForm] = useState({ rating: 5, comment: '' })
  const [reyGonderilib, setReyGonderilib] = useState(false)
  const [reyError, setReyError] = useState('')
  const [hoveredStar, setHoveredStar] = useState(0)
  const [sekillYuklenir, setSekillYuklenir] = useState(false)
  const [caption, setCaption] = useState('')
  const fileRef = useRef()

  useEffect(() => {
    const yukle = async () => {
      const { data: m } = await supabase.from('mutexessis_hesablari').select('*, hesablar(id, full_name, city, phone)').eq('id', id).single()
      setMutexessis(m)
      const { data: r } = await supabase.from('reyler').select('*, hesablar(full_name)').eq('mutexessis_id', id).order('created_at', { ascending: false })
      setReyler(r || [])
      const { data: p } = await supabase.from('portfolio_sekiller').select('*').eq('mutexessis_id', id).order('created_at', { ascending: false })
      setPortfolio(p || [])
      setLoading(false)
    }
    yukle()
  }, [id])

  useEffect(() => {
    if (!user || !id) return
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
    if (!user) { setReyError('Rəy yazmaq üçün daxil olun'); return }
    if (ozProfil) { setReyError('Öz profilinizə rəy yaza bilməzsiniz'); return }
    if (!reyForm.comment.trim()) { setReyError('Rəy mətni yazın'); return }
    const { error } = await supabase.from('reyler').insert({ musteri_id: user.id, mutexessis_id: id, rating: reyForm.rating, comment: reyForm.comment })
    if (error) { setReyError('Xəta baş verdi. Yenidən cəhd edin.'); return }
    setReyGonderilib(true)
    const { data: r } = await supabase.from('reyler').select('*, hesablar(full_name)').eq('mutexessis_id', id).order('created_at', { ascending: false })
    setReyler(r || [])
    const { data: m } = await supabase.from('mutexessis_hesablari').select('*, hesablar(id, full_name, city, phone)').eq('id', id).single()
    setMutexessis(m)
  }

  const sekillYukle = async (e) => {
    const fayl = e.target.files[0]
    if (!fayl) return
    setSekillYuklenir(true)
    const faylAdi = `${user.id}/${Date.now()}_${fayl.name}`
    const { error } = await supabase.storage.from('portfolio').upload(faylAdi, fayl)
    if (error) { setSekillYuklenir(false); alert('Şəkil yüklənmədi: ' + error.message); return }
    const { data: urlData } = supabase.storage.from('portfolio').getPublicUrl(faylAdi)
    await supabase.from('portfolio_sekiller').insert({ user_id: user.id, mutexessis_id: id, image_url: urlData.publicUrl, caption })
    const { data: p } = await supabase.from('portfolio_sekiller').select('*').eq('mutexessis_id', id).order('created_at', { ascending: false })
    setPortfolio(p || [])
    setCaption('')
    setSekillYuklenir(false)
  }

  const sekillSil = async (sekil) => {
    if (!window.confirm('Şəkli silmək istəyirsiniz?')) return
    const yol = sekil.image_url.split('/portfolio/')[1]
    await supabase.storage.from('portfolio').remove([yol])
    await supabase.from('portfolio_sekiller').delete().eq('id', sekil.id)
    setPortfolio(portfolio.filter(p => p.id !== sekil.id))
  }

  if (loading) return <div className="flex items-center justify-center py-24 text-gray-400">Yüklənir...</div>
  if (!mutexessis) return <div className="flex items-center justify-center py-24 text-gray-400">Mütəxəssis tapılmadı</div>

  return (
    <div className="page-wrap">
      <Link to="/mutexessisler" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-6 transition-colors">
        ← Geri
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sol — əsas məlumat */}
        <div className="lg:col-span-2 space-y-4">
          {/* Profil kartı */}
          <div className="card p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-600 font-bold text-2xl shrink-0">
                {mutexessis.hesablar?.full_name?.[0] || '?'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-gray-800">{mutexessis.hesablar?.full_name}</h1>
                  {mutexessis.is_verified && <span className="badge bg-green-50 text-green-600">✅ Təsdiqlənib</span>}
                  {ozProfil && <span className="badge bg-gray-100 text-gray-600">Öz profiliniz</span>}
                </div>
                <p className="text-sm text-gray-500 mt-1">{mutexessis.category} · {mutexessis.hesablar?.city}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex">
                    {[1,2,3,4,5].map(s => <span key={s} className={`text-lg ${s <= Math.round(mutexessis.rating || 0) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>)}
                  </div>
                  <span className="text-lg font-bold text-primary-600">{mutexessis.rating?.toFixed(1) || '0.0'}</span>
                  <span className="text-sm text-gray-400">({mutexessis.review_count} rəy)</span>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <span className="badge bg-primary-50 text-primary-600">🕐 {mutexessis.experience_years} il təcrübə</span>
                  <span className="badge bg-primary-50 text-primary-600">💰 {mutexessis.start_price} AZN-dən</span>
                </div>
              </div>
            </div>
            {mutexessis.bio && <p className="text-sm text-gray-600 leading-relaxed mt-4 pt-4 border-t border-gray-50">{mutexessis.bio}</p>}
          </div>

          {/* Portfolio */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Portfolio ({portfolio.length})</h2>
              {ozProfil && (
                <div className="flex items-center gap-2">
                  <input className="input text-xs w-40" placeholder="Açıqlama (isteğe bağlı)" value={caption} onChange={e => setCaption(e.target.value)} />
                  <button onClick={() => fileRef.current.click()} disabled={sekillYuklenir} className="btn-primary text-xs py-2">
                    {sekillYuklenir ? '⏳' : '+ Şəkil'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={sekillYukle} className="hidden" />
                </div>
              )}
            </div>
            {portfolio.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">{ozProfil ? 'Şəkil yükləyin — müştərilər işlərinizi görsün' : 'Portfolio şəkli yoxdur'}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {portfolio.map(p => (
                  <div key={p.id} className="relative group rounded-xl overflow-hidden">
                    <img src={p.image_url} alt={p.caption || 'Portfolio'} className="w-full aspect-square object-cover" />
                    {p.caption && <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1.5 truncate">{p.caption}</div>}
                    {ozProfil && (
                      <button onClick={() => sekillSil(p)} className="absolute top-1 right-1 bg-red-500 text-white text-xs w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rəy yaz */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Rəy yaz</h2>
            {!user ? (
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 text-center">
                <Link to="/giris" className="text-primary-600 font-medium">Daxil olun</Link> — rəy yazmaq üçün
              </div>
            ) : ozProfil ? (
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500 text-center">Öz profilinizə rəy yaza bilməzsiniz</div>
            ) : reyGonderilib ? (
              <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-4 text-sm text-center">✅ Rəyiniz uğurla göndərildi!</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Qiymətləndirmə</label>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} onClick={() => setReyForm(p => ({ ...p, rating: s }))} onMouseEnter={() => setHoveredStar(s)} onMouseLeave={() => setHoveredStar(0)}
                        className={`text-3xl transition-colors ${s <= (hoveredStar || reyForm.rating) ? 'text-yellow-400' : 'text-gray-200'}`}>★</button>
                    ))}
                    <span className="text-sm text-gray-500 ml-2">{['','Pis','Orta','Yaxşı','Çox yaxşı','Əla'][hoveredStar || reyForm.rating]}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Rəyiniz</label>
                  <textarea className="input resize-none" rows={3} placeholder="Mütəxəssisin işi haqqında rəyinizi yazın..." value={reyForm.comment} onChange={e => setReyForm(p => ({ ...p, comment: e.target.value }))} />
                </div>
                {reyError && <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm">{reyError}</div>}
                <button onClick={reyGonder} className="btn-primary">Rəy göndər</button>
              </div>
            )}
          </div>

          {/* Rəylər siyahısı */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Rəylər ({reyler.length})</h2>
            {reyler.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Hələ rəy yoxdur — ilk rəyi siz yazın!</p>
            ) : (
              <div className="space-y-4 divide-y divide-gray-50">
                {reyler.map(r => (
                  <div key={r.id} className="pt-4 first:pt-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 font-semibold text-sm">
                          {r.hesablar?.full_name?.[0] || '?'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-800">{r.hesablar?.full_name}</div>
                          <div className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('az')}</div>
                        </div>
                      </div>
                      <div className="flex">
                        {[1,2,3,4,5].map(s => <span key={s} className={`text-sm ${s <= r.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>)}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sağ — yan panel */}
        <div className="space-y-4 lg:sticky lg:top-24 self-start">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Əlaqə</h3>
            {mutexessis.hesablar?.phone && (
              <a href={`tel:${mutexessis.hesablar.phone}`} className="btn-primary w-full justify-center mb-4 py-3">
                📞 {mutexessis.hesablar.phone}
              </a>
            )}
            {!ozProfil && (
              <>
                <div className="border-t border-gray-50 pt-4">
                  <p className="text-xs text-gray-500 mb-3">Platforma üzərindən mesaj göndər:</p>
                  {!user ? (
                    <Link to="/giris" className="btn-secondary w-full justify-center text-xs">Mesaj üçün daxil ol</Link>
                  ) : mesajGonderilib ? (
                    <div className="bg-green-50 text-green-700 rounded-xl p-3 text-sm text-center">✅ Mesajınız göndərildi!</div>
                  ) : (
                    <div className="space-y-2">
                      <textarea className="input resize-none text-sm" rows={3} placeholder="Mesajınızı yazın..." value={mesaj} onChange={e => setMesaj(e.target.value)} />
                      <button onClick={mesajGonder} className="btn-primary w-full justify-center text-sm">Mesaj göndər</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Reytinq xülasəsi */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Reytinq xülasəsi</h3>
            <div className="space-y-2">
              {[5,4,3,2,1].map(s => {
                const sayi = reyler.filter(r => r.rating === s).length
                const faiz = reyler.length > 0 ? (sayi / reyler.length) * 100 : 0
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-5">{s}★</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-yellow-400 h-full rounded-full transition-all" style={{ width: `${faiz}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-4">{sayi}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
