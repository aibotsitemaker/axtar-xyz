import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TABS = ['Statistika', 'İstifadəçilər', 'Elanlar', 'Mütəxəssislər']

export default function Admin() {
  const [tab, setTab] = useState('Statistika')
  const [stats, setStats] = useState({})
  const [istifadeciler, setIstifadeciler] = useState([])
  const [elanlar, setElanlar] = useState([])
  const [mutexessisler, setMutexessisler] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const yoxla = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/giris'); return }
      const { data: h } = await supabase.from('hesablar').select('role').eq('id', user.id).single()
      if (h?.role !== 'admin') { navigate('/'); return }
      yukle()
    }
    yoxla()
  }, [])

  const yukle = async () => {
    setLoading(true)
    const [{ count: ist }, { count: elan }, { count: mut }, { count: murac }] = await Promise.all([
      supabase.from('hesablar').select('*', { count: 'exact', head: true }),
      supabase.from('elanlar').select('*', { count: 'exact', head: true }),
      supabase.from('mutexessis_hesablari').select('*', { count: 'exact', head: true }),
      supabase.from('muracietler').select('*', { count: 'exact', head: true }),
    ])
    setStats({ ist, elan, mut, murac })
    const { data: i } = await supabase.from('hesablar').select('*').order('created_at', { ascending: false })
    setIstifadeciler(i || [])
    const { data: e } = await supabase.from('elanlar').select('*, hesablar(full_name)').order('created_at', { ascending: false })
    setElanlar(e || [])
    const { data: m } = await supabase.from('mutexessis_hesablari').select('*, hesablar(full_name, city, is_blocked)').order('created_at', { ascending: false })
    setMutexessisler(m || [])
    setLoading(false)
  }

  const elanSil = async (id) => {
    if (!window.confirm('Silmək istəyirsiniz?')) return
    await supabase.from('elanlar').delete().eq('id', id)
    setElanlar(p => p.filter(e => e.id !== id))
  }

  const elanUpdate = async (id, data) => {
    await supabase.from('elanlar').update(data).eq('id', id)
    setElanlar(p => p.map(e => e.id === id ? { ...e, ...data } : e))
  }

  const mutexessisTesdiq = async (id, val) => {
    await supabase.from('mutexessis_hesablari').update({ is_verified: val }).eq('id', id)
    setMutexessisler(p => p.map(m => m.id === id ? { ...m, is_verified: val } : m))
  }

  const bloklа = async (id, val) => {
    await supabase.from('hesablar').update({ is_blocked: val }).eq('id', id)
    setIstifadeciler(p => p.map(i => i.id === id ? { ...i, is_blocked: val } : i))
    setMutexessisler(p => p.map(m => m.user_id === id ? { ...m, hesablar: { ...m.hesablar, is_blocked: val } } : m))
  }

  if (loading) return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" /></div>

  const thClass = "px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
  const tdClass = "px-4 py-3 text-sm text-gray-700"

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <span className="text-white font-bold text-lg">⚙️ Admin Panel — Axtar.xyz</span>
        <button onClick={() => navigate('/')} className="text-sm text-gray-300 hover:text-white transition-colors">← Sayta qayıt</button>
      </div>

      <div className="bg-gray-800 border-b border-gray-700 px-6 flex gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${tab === t ? 'text-white border-blue-400' : 'text-gray-400 border-transparent hover:text-gray-200'}`}>{t}</button>
        ))}
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Statistika */}
        {tab === 'Statistika' && (
          <div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[['👥', 'İstifadəçilər', stats.ist, 'text-blue-400'], ['📋', 'Elanlar', stats.elan, 'text-green-400'], ['🔧', 'Mütəxəssislər', stats.mut, 'text-yellow-400'], ['📨', 'Müraciətlər', stats.murac, 'text-purple-400']].map(([ikon, label, val, color]) => (
                <div key={label} className="bg-gray-800 rounded-2xl p-5 border border-gray-700 text-center">
                  <div className="text-3xl mb-2">{ikon}</div>
                  <div className={`text-3xl font-bold ${color}`}>{val || 0}</div>
                  <div className="text-sm text-gray-400 mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
              <h3 className="text-white font-semibold mb-3">Sürətli keçidlər</h3>
              <div className="flex gap-3 flex-wrap">
                {TABS.filter(t => t !== 'Statistika').map(t => (
                  <button key={t} onClick={() => setTab(t)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">{t}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* İstifadəçilər */}
        {tab === 'İstifadəçilər' && (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-700">
              <h2 className="text-white font-semibold">İstifadəçilər ({istifadeciler.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-750 border-b border-gray-700">
                  <tr>{['Ad', 'Telefon', 'Şəhər', 'Rol', 'Tarix', 'Əməliyyat'].map(h => <th key={h} className={thClass}>{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {istifadeciler.map(i => (
                    <tr key={i.id} className={`hover:bg-gray-750 ${i.is_blocked ? 'bg-red-900/20' : ''}`}>
                      <td className={tdClass + ' text-white font-medium'}>{i.full_name}</td>
                      <td className={tdClass + ' text-gray-400'}>{i.phone || '—'}</td>
                      <td className={tdClass + ' text-gray-400'}>{i.city}</td>
                      <td className={tdClass}>
                        <span className={`badge text-xs ${i.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : i.role === 'mutexessis' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>{i.role}</span>
                      </td>
                      <td className={tdClass + ' text-gray-500 text-xs'}>{new Date(i.created_at).toLocaleDateString('az')}</td>
                      <td className={tdClass}>
                        {i.role !== 'admin' && (
                          <button onClick={() => bloklа(i.id, !i.is_blocked)} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${i.is_blocked ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}>
                            {i.is_blocked ? 'Bloku aç' : 'Blokla'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Elanlar */}
        {tab === 'Elanlar' && (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-700">
              <h2 className="text-white font-semibold">Elanlar ({elanlar.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-700">
                  <tr>{['Başlıq', 'Kateqoriya', 'Sahibi', 'VIP', 'Öndə', 'Sil'].map(h => <th key={h} className={thClass}>{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {elanlar.map(e => (
                    <tr key={e.id} className="hover:bg-gray-750">
                      <td className={tdClass + ' text-white max-w-xs truncate'}>{e.title}</td>
                      <td className={tdClass}><span className="badge bg-blue-500/20 text-blue-400 text-xs">{e.category}</span></td>
                      <td className={tdClass + ' text-gray-400'}>{e.hesablar?.full_name}</td>
                      <td className={tdClass}>
                        <button onClick={() => elanUpdate(e.id, { is_vip: !e.is_vip })} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${e.is_vip ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                          {e.is_vip ? '⭐ VIP' : 'VIP et'}
                        </button>
                      </td>
                      <td className={tdClass}>
                        <button onClick={() => elanUpdate(e.id, { is_featured: !e.is_featured })} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${e.is_featured ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                          {e.is_featured ? '🔝 Öndə' : 'Öndə çıxar'}
                        </button>
                      </td>
                      <td className={tdClass}>
                        <button onClick={() => elanSil(e.id)} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">Sil</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mütəxəssislər */}
        {tab === 'Mütəxəssislər' && (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-700">
              <h2 className="text-white font-semibold">Mütəxəssislər ({mutexessisler.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-700">
                  <tr>{['Ad', 'Kateqoriya', 'Şəhər', 'Reytinq', 'Status', 'Əməliyyat'].map(h => <th key={h} className={thClass}>{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {mutexessisler.map(m => (
                    <tr key={m.id} className={`hover:bg-gray-750 ${m.hesablar?.is_blocked ? 'bg-red-900/20' : ''}`}>
                      <td className={tdClass + ' text-white font-medium'}>{m.hesablar?.full_name}</td>
                      <td className={tdClass}><span className="badge bg-blue-500/20 text-blue-400 text-xs">{m.category}</span></td>
                      <td className={tdClass + ' text-gray-400'}>{m.hesablar?.city}</td>
                      <td className={tdClass + ' text-yellow-400'}>{'★'.repeat(Math.round(m.rating || 0))} {m.rating?.toFixed(1)}</td>
                      <td className={tdClass}>
                        <span className={`badge text-xs ${m.is_verified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {m.is_verified ? '✅ Təsdiqlənib' : '⏳ Gözləyir'}
                        </span>
                      </td>
                      <td className={tdClass}>
                        <div className="flex gap-2">
                          <button onClick={() => mutexessisTesdiq(m.id, !m.is_verified)} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${m.is_verified ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}>
                            {m.is_verified ? 'Ləğv et' : 'Təsdiqlə'}
                          </button>
                          <button onClick={() => bloklа(m.user_id, !m.hesablar?.is_blocked)} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${m.hesablar?.is_blocked ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {m.hesablar?.is_blocked ? 'Bloku aç' : 'Blokla'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
