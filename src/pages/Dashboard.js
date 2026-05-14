import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const { user, hesab, loading: authLoading } = useAuth()
  const [mutexessis, setMutexessis] = useState(null)
  const [elanlar, setElanlar] = useState([])
  const [mesajlar, setMesajlar] = useState([])
  const [muracietler, setMuracietler] = useState([])
  const [loading, setLoading] = useState(true)
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
        const { data: mur } = await supabase.from('muracietler').select('*, elanlar(title), hesablar(full_name)').eq('mutexessis_id', user.id).order('created_at', { ascending: false }).limit(10)
        setMuracietler(mur || [])
      }
    } else {
      const { data: e } = await supabase.from('elanlar').select('*, muracietler(id)').eq('user_id', user.id).order('created_at', { ascending: false })
      setElanlar(e || [])
    }
    const { data: msg } = await supabase.from('mesajlar')
      .select('*, sender:sender_id(full_name), receiver:receiver_id(full_name)')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false }).limit(10)
    setMesajlar(msg || [])
    setLoading(false)
  }

  const elanSil = async (id) => {
    if (!window.confirm('Elanı silmək istəyirsiniz?')) return
    await supabase.from('elanlar').delete().eq('id', id)
    setElanlar(p => p.filter(e => e.id !== id))
  }

  if (authLoading || loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="page-wrap">
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Salam, {hesab?.full_name?.split(' ')[0]}! 👋</h1>
          <p className="text-gray-500 text-sm mt-1">{hesab?.role === 'mutexessis' ? 'Mütəxəssis paneli' : 'Müştəri paneli'}</p>
        </div>
        <span className={`badge text-sm px-3 py-1.5 ${hesab?.role === 'mutexessis' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
          {hesab?.role === 'mutexessis' ? '🔧 Mütəxəssis' : '👤 Müştəri'}
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Mütəxəssis profil */}
          {hesab?.role === 'mutexessis' && mutexessis && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Profilim</h2>
              <div className="space-y-3">
                {[['Kateqoriya', mutexessis.category], ['Qiymət', `${mutexessis.start_price} AZN-dən`], ['Reytinq', `${'★'.repeat(Math.round(mutexessis.rating || 0))} ${mutexessis.rating?.toFixed(1) || '0.0'}`], ['Rəylər', `${mutexessis.review_count} rəy`], ['Status', mutexessis.is_verified ? '✅ Təsdiqlənib' : '⏳ Gözləyir']].map(([l, v]) => (
                  <div key={l} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-500">{l}</span>
                    <span className="text-sm font-medium text-gray-800">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4"><Link to={`/mutexessis/${mutexessis.id}`} className="btn-primary flex-1 justify-center">Profilə bax</Link><Link to="/profil/redakte" className="btn-secondary flex-1 justify-center">✎ Redaktə</Link></div>
            </div>
          )}

          {/* Müştəri elanları */}
          {hesab?.role !== 'mutexessis' && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800">Elanlarım ({elanlar.length})</h2>
                <Link to="/elanlar" className="btn-primary text-xs py-1.5 px-3">+ Yeni elan</Link>
              </div>
              {elanlar.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-400 text-sm mb-3">Hələ elan verməmisiniz</p>
                  <Link to="/elanlar" className="btn-primary text-sm">İlk elanı ver</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {elanlar.map(e => (
                    <div key={e.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{e.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="badge bg-primary-50 text-primary-600 text-xs">{e.category}</span>
                          <span className={`badge text-xs ${e.status === 'aktiv' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>{e.status}</span>
                          <span className="text-xs text-gray-400">{e.muracietler?.length || 0} müraciət</span>
                        </div>
                      </div>
                      <button onClick={() => elanSil(e.id)} className="text-red-400 hover:text-red-600 text-sm ml-2 shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Müraciətlər (mütəxəssis üçün) */}
          {hesab?.role === 'mutexessis' && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Müraciətlərim ({muracietler.length})</h2>
              {muracietler.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-400 text-sm mb-3">Hələ müraciət etməmisiniz</p>
                  <Link to="/elanlar" className="btn-primary text-sm">Elanlara bax</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {muracietler.map(m => (
                    <div key={m.id} className="p-3 bg-gray-50 rounded-xl">
                      <div className="text-sm font-medium text-gray-800">{m.elanlar?.title}</div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-1">{m.message}</div>
                      {m.price_offer && <div className="text-xs text-primary-600 mt-1 font-medium">Təklif: {m.price_offer} AZN</div>}
                      <span className={`badge text-xs mt-2 ${m.status === 'qebul' ? 'bg-green-50 text-green-600' : m.status === 'red' ? 'bg-red-50 text-red-500' : 'bg-yellow-50 text-yellow-600'}`}>
                        {m.status === 'qebul' ? '✅ Qəbul edildi' : m.status === 'red' ? '❌ Rədd edildi' : '⏳ Gözləyir'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hesab məlumatları */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4"><h2 className="font-semibold text-gray-800">Hesab məlumatları</h2><Link to="/profil/redakte" className="btn-secondary text-xs py-1.5 px-3">✎ Redaktə</Link></div>
            <div className="space-y-2">
              {[['Ad', hesab?.full_name], ['Telefon', hesab?.phone || '—'], ['Şəhər', hesab?.city || '—']].map(([l, v]) => (
                <div key={l} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-500">{l}</span>
                  <span className="text-sm font-medium text-gray-800">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mesajlar */}
        <div className="card p-5 h-fit">
          <h2 className="font-semibold text-gray-800 mb-4">Mesajlar ({mesajlar.length})</h2>
          {mesajlar.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Hələ mesaj yoxdur</div>
          ) : (
            <div className="space-y-3 divide-y divide-gray-50">
              {mesajlar.map(m => (
                <div key={m.id} className="pt-3 first:pt-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 font-semibold text-xs">
                        {m.sender?.full_name?.[0] || '?'}
                      </div>
                      <span className="text-sm font-medium text-gray-800">{m.sender?.full_name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(m.created_at).toLocaleDateString('az')}</span>
                  </div>
                  <p className="text-sm text-gray-600 ml-9 line-clamp-2">{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
