import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function EmptyState({ ikon, baslig, metn, btnMetn, btnLink }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="text-5xl mb-3">{ikon}</div>
      <h3 className="font-semibold text-gray-600 text-sm mb-1">{baslig}</h3>
      <p className="text-xs text-gray-400 leading-relaxed mb-4 max-w-xs">{metn}</p>
      {btnLink && <Link to={btnLink} className="bg-[#185FA5] text-white text-sm font-semibold px-5 py-2.5 rounded-2xl active:scale-95 transition-transform">{btnMetn}</Link>}
    </div>
  )
}

export default function Dashboard() {
  const { user, hesab, loading: authLoading, cixis } = useAuth()
  const [mutexessis, setMutexessis] = useState(null)
  const [elanlar, setElanlar] = useState([])
  const [mesajlar, setMesajlar] = useState([])
  const [muracietler, setMuracietler] = useState([])
  const [bildirisler, setBildirisler] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('esas')
  const navigate = useNavigate()

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/giris'); return }
    yukle()
  }, [user, authLoading])

  const yukle = async () => {
    if (!user) return
    setLoading(true)
    if (hesab?.role === 'mutexessis') {
      const { data: m } = await supabase.from('mutexessis_hesablari').select('*').eq('user_id', user.id).single()
      setMutexessis(m)
      if (m) {
        const { data: mur } = await supabase.from('muracietler')
          .select('*, elanlar(title), hesablar(full_name)')
          .eq('mutexessis_id', user.id)
          .order('created_at', { ascending: false }).limit(10)
        setMuracietler(mur || [])
      }
    } else {
      const { data: e } = await supabase.from('elanlar')
        .select('*, muracietler(id)').eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setElanlar(e || [])
    }
    const { data: msg } = await supabase.from('mesajlar')
      .select('*, sender:sender_id(full_name)')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false }).limit(20)
    setMesajlar(msg || [])
    const { data: bil } = await supabase.from('bildirisler')
      .select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(20)
    setBildirisler(bil || [])
    setLoading(false)
  }

  const bildirisOxu = async (b) => {
    await supabase.from('bildirisler').update({ oxunub: true }).eq('id', b.id)
    setBildirisler(prev => prev.map(x => x.id === b.id ? { ...x, oxunub: true } : x))
    if (b.link) navigate(b.link)
  }

  const hamısınıOxu = async () => {
    await supabase.from('bildirisler').update({ oxunub: true }).eq('user_id', user.id)
    setBildirisler(prev => prev.map(x => ({ ...x, oxunub: true })))
  }

  const elanSil = async (id) => {
    if (!window.confirm('Elanı silmək istəyirsiniz?')) return
    await supabase.from('elanlar').delete().eq('id', id)
    setElanlar(prev => prev.filter(e => e.id !== id))
  }

  if (authLoading || loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#F2F4F7]">
      <div className="w-8 h-8 border-4 border-blue-100 border-t-[#185FA5] rounded-full animate-spin" />
    </div>
  )

  const oxunmamis = bildirisler.filter(b => !b.oxunub).length
  const TABS = [
    { id: 'esas', label: '🏠 Əsas' },
    { id: 'mesajlar', label: `💬${mesajlar.length > 0 ? ` (${mesajlar.length})` : ''}` },
    { id: 'bildirisler', label: `🔔${oxunmamis > 0 ? ` (${oxunmamis})` : ''}` },
  ]

  return (
    <div className="bg-[#F2F4F7] min-h-screen pb-28">
      <div className="bg-[#185FA5] pt-12 pb-6 px-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-xs">Xoş gəlmisiniz 👋</p>
            <h1 className="text-white font-bold text-xl mt-0.5">{hesab?.full_name?.split(' ')[0]}</h1>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-xl ${hesab?.role === 'mutexessis' ? 'bg-blue-400/30 text-blue-100' : hesab?.role === 'admin' ? 'bg-purple-400/30 text-purple-100' : 'bg-green-400/30 text-green-100'}`}>
            {hesab?.role === 'mutexessis' ? '🔧 Mütəxəssis' : hesab?.role === 'admin' ? '⚙️ Admin' : '👤 Müştəri'}
          </span>
        </div>
      </div>

      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl p-1 flex gap-1 border border-gray-100 mb-4">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${activeTab === t.id ? 'bg-[#185FA5] text-white shadow-sm' : 'text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'esas' && (
          <div className="space-y-3">
            {hesab?.role === 'mutexessis' && mutexessis && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-800 text-sm mb-3">Profilim</h2>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[['⭐','Reytinq',mutexessis.rating?.toFixed(1)||'0.0'],['💬','Rəylər',mutexessis.review_count||0],['💰','Qiymət',`${mutexessis.start_price} AZN`],['✅','Status',mutexessis.is_verified?'Təsdiqlənib':'Gözləyir']].map(([ikon,label,val])=>(
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <div className="text-lg mb-1">{ikon}</div>
                      <div className="text-xs text-gray-400">{label}</div>
                      <div className="text-sm font-bold text-gray-800 mt-0.5">{val}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Link to={`/mutexessis/${mutexessis.id}`} className="flex-1 bg-[#185FA5] text-white text-sm font-semibold py-2.5 rounded-xl text-center active:scale-95 transition-transform">Profilə bax</Link>
                  <Link to="/profil/redakte" className="flex-1 bg-gray-100 text-gray-700 text-sm font-semibold py-2.5 rounded-xl text-center active:scale-95 transition-transform">✎ Redaktə</Link>
                </div>
              </div>
            )}

            {hesab?.role !== 'mutexessis' && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-800 text-sm">Elanlarım ({elanlar.length})</h2>
                  <Link to="/elanlar" className="bg-[#185FA5] text-white text-xs font-semibold px-3 py-1.5 rounded-xl">+ Yeni</Link>
                </div>
                {elanlar.length === 0 ? (
                  <EmptyState ikon="📋" baslig="Hələ ki, elan yoxdur" metn="İlk elanınızı verin" btnMetn="Elan ver" btnLink="/elanlar" />
                ) : (
                  <div className="space-y-2">
                    {elanlar.map(e => (
                      <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800 truncate">{e.title}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs bg-blue-50 text-[#185FA5] px-2 py-0.5 rounded-full font-medium">{e.category}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.status === 'aktiv' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>{e.status}</span>
                            {e.muracietler?.length > 0 && <span className="text-xs text-gray-400">{e.muracietler.length} müraciət</span>}
                          </div>
                        </div>
                        <button onClick={() => elanSil(e.id)} className="text-red-400 text-lg ml-2 w-8 h-8 flex items-center justify-center rounded-xl active:scale-90">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {hesab?.role === 'mutexessis' && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-gray-800 text-sm">Müraciətlərim ({muracietler.length})</h2>
                  <Link to="/elanlar" className="text-xs text-[#185FA5] font-semibold">Elanlara bax →</Link>
                </div>
                {muracietler.length === 0 ? (
                  <EmptyState ikon="📨" baslig="Hələ ki, müraciət yoxdur" metn="Elanlara baxıb müraciət edin" btnMetn="Elanlara bax" btnLink="/elanlar" />
                ) : (
                  <div className="space-y-2">
                    {muracietler.map(m => (
                      <div key={m.id} className="p-3 bg-gray-50 rounded-xl">
                        <div className="text-sm font-semibold text-gray-800 mb-1 truncate">{m.elanlar?.title}</div>
                        <div className="text-xs text-gray-500 line-clamp-1">{m.message}</div>
                        {m.price_offer && <div className="text-xs text-[#185FA5] font-semibold mt-1">💰 {m.price_offer} AZN</div>}
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1.5 ${m.status === 'qebul' ? 'bg-green-50 text-green-600' : m.status === 'red' ? 'bg-red-50 text-red-500' : 'bg-yellow-50 text-yellow-600'}`}>
                          {m.status === 'qebul' ? '✅ Qəbul' : m.status === 'red' ? '❌ Rədd' : '⏳ Gözləyir'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-800 text-sm mb-3">Hesab məlumatları</h2>
              <div className="space-y-2">
                {[['👤','Ad',hesab?.full_name],['📍','Şəhər',hesab?.city||'—'],['📞','Telefon',hesab?.phone||'—']].map(([ikon,label,val])=>(
                  <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-400 flex items-center gap-2"><span>{ikon}</span>{label}</span>
                    <span className="text-sm font-semibold text-gray-800">{val}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Link to="/profil/redakte" className="flex-1 bg-gray-100 text-gray-700 text-sm font-semibold py-2.5 rounded-xl text-center active:scale-95 transition-transform">✎ Redaktə et</Link>
                <button onClick={cixis} className="flex-1 bg-red-50 text-red-500 text-sm font-semibold py-2.5 rounded-xl active:scale-95 transition-transform">Çıxış</button>
              </div>
            </div>

            {hesab?.role === 'admin' && (
              <Link to="/admin" className="block bg-gradient-to-r from-purple-500 to-violet-600 rounded-2xl p-4 text-white active:scale-95 transition-transform">
                <div className="text-2xl mb-1">⚙️</div>
                <div className="font-bold text-sm">Admin Panel</div>
                <div className="text-purple-200 text-xs mt-0.5">Platformanı idarə et</div>
              </Link>
            )}
          </div>
        )}

        {activeTab === 'mesajlar' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {mesajlar.length === 0 ? (
              <EmptyState ikon="💬" baslig="Hələ ki, mesaj yoxdur" metn="Mütəxəssis profilinə girib mesaj göndərin" btnMetn="Mütəxəssis tap" btnLink="/mutexessisler" />
            ) : (
              <div className="divide-y divide-gray-50">
                {mesajlar.map(m => (
                  <div key={m.id} className="flex items-start gap-3 p-4">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-[#185FA5] font-bold text-sm shrink-0">
                      {m.sender?.full_name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800">{m.sender?.full_name}</span>
                        <span className="text-xs text-gray-400">{new Date(m.created_at).toLocaleDateString('az')}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{m.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'bildirisler' && (
          <div>
            {oxunmamis > 0 && (
              <button onClick={hamısınıOxu} className="w-full bg-white rounded-2xl p-3 border border-gray-100 text-sm text-[#185FA5] font-semibold mb-3 active:scale-95 transition-transform">
                ✓ Hamısını oxunmuş et ({oxunmamis})
              </button>
            )}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {bildirisler.length === 0 ? (
                <EmptyState ikon="🔔" baslig="Hələ ki, bildiriş yoxdur" metn="Yeni mesaj və ya müraciət olduqda burada görünəcək" />
              ) : (
                <div className="divide-y divide-gray-50">
                  {bildirisler.map(b => (
                    <button key={b.id} onClick={() => bildirisOxu(b)}
                      className={`w-full flex items-start gap-3 p-4 text-left active:bg-gray-50 ${!b.oxunub ? 'bg-blue-50/50' : ''}`}>
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-lg shrink-0">
                        {b.tip === 'mesaj' ? '💬' : b.tip === 'muraciet' ? '📋' : '🔔'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 leading-snug">{b.metn}</p>
                        <span className="text-xs text-gray-400 mt-0.5 block">{new Date(b.created_at).toLocaleDateString('az')}</span>
                      </div>
                      {!b.oxunub && <div className="w-2 h-2 rounded-full bg-[#185FA5] shrink-0 mt-1.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
