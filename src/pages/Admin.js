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
  }, [navigate])

  const yukle = async () => {
    setLoading(true)
    const [{ count: ist }, { count: elan }, { count: mut }, { count: murac }] = await Promise.all([
      supabase.from('hesablar').select('*', { count: 'exact', head: true }),
      supabase.from('elanlar').select('*', { count: 'exact', head: true }),
      supabase.from('mutexessis_hesablari').select('*', { count: 'exact', head: true }),
      supabase.from('muracietler').select('*', { count: 'exact', head: true }),
    ])
    setStats({ istifadeciler: ist, elanlar: elan, mutexessisler: mut, muracietler: murac })
    const { data: i } = await supabase.from('hesablar').select('*').order('created_at', { ascending: false })
    setIstifadeciler(i || [])
    const { data: e } = await supabase.from('elanlar').select('*, hesablar(full_name)').order('created_at', { ascending: false })
    setElanlar(e || [])
    const { data: m } = await supabase.from('mutexessis_hesablari').select('*, hesablar(full_name, city, is_blocked)').order('created_at', { ascending: false })
    setMutexessisler(m || [])
    setLoading(false)
  }

  const elanSil = async (id) => {
    if (!window.confirm('Elanı silmək istəyirsiniz?')) return
    await supabase.from('elanlar').delete().eq('id', id)
    yukle()
  }

  const elanStatusDeyis = async (id, field, value) => {
    await supabase.from('elanlar').update({ [field]: value }).eq('id', id)
    yukle()
  }

  const mutexessisTesdiq = async (id, value) => {
    await supabase.from('mutexessis_hesablari').update({ is_verified: value }).eq('id', id)
    yukle()
  }

  const istifadeciBloklа = async (id, value) => {
    await supabase.from('hesablar').update({ is_blocked: value }).eq('id', id)
    yukle()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: '#888' }}>Yüklənir...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      {/* Admin header */}
      <div style={{ background: '#1a1a2e', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>⚙️ Admin Panel — Axtar.xyz</div>
        <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>← Sayta qayıt</button>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '0 32px', display: 'flex', gap: 4 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '14px 20px', border: 'none', background: 'none', fontSize: 14, cursor: 'pointer', borderBottom: tab === t ? '2px solid #185FA5' : '2px solid transparent', color: tab === t ? '#185FA5' : '#555', fontWeight: tab === t ? 600 : 400 }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>

        {/* Statistika */}
        {tab === 'Statistika' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Ümumi statistika</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
              {[
                ['👥', 'İstifadəçilər', stats.istifadeciler, '#E6F1FB', '#185FA5'],
                ['📋', 'Elanlar', stats.elanlar, '#EAF3DE', '#2E7D32'],
                ['🔧', 'Mütəxəssislər', stats.mutexessisler, '#FAEEDA', '#E65100'],
                ['📨', 'Müraciətlər', stats.muracietler, '#FBEAF0', '#880E4F'],
              ].map(([ikon, label, val, bg, color]) => (
                <div key={label} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{ikon}</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color }}>{val || 0}</div>
                  <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Sürətli keçidlər</h3>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {TABS.filter(t => t !== 'Statistika').map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{ background: '#185FA5', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>{t}-ə keç</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* İstifadəçilər */}
        {tab === 'İstifadəçilər' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>İstifadəçilər ({istifadeciler.length})</h2>
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    {['Ad', 'Telefon', 'Şəhər', 'Rol', 'Tarix', 'Əməliyyat'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#555', textAlign: 'left', borderBottom: '1px solid #eee' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {istifadeciler.map(i => (
                    <tr key={i.id} style={{ borderBottom: '1px solid #f5f5f5', background: i.is_blocked ? '#FFF5F5' : '#fff' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>{i.full_name}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#888' }}>{i.phone || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#888' }}>{i.city}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: i.role === 'admin' ? '#1a1a2e' : i.role === 'mutexessis' ? '#E6F1FB' : '#EAF3DE', color: i.role === 'admin' ? '#fff' : i.role === 'mutexessis' ? '#185FA5' : '#2E7D32', fontSize: 11, padding: '3px 8px', borderRadius: 20 }}>{i.role}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#aaa' }}>{new Date(i.created_at).toLocaleDateString('az')}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {i.role !== 'admin' && (
                          <button onClick={() => istifadeciBloklа(i.id, !i.is_blocked)} style={{ background: i.is_blocked ? '#EAF3DE' : '#FEE', color: i.is_blocked ? '#2E7D32' : '#C00', border: 'none', padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
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
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Elanlar ({elanlar.length})</h2>
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    {['Başlıq', 'Kateqoriya', 'Sahibi', 'Status', 'VIP', 'Öndə', 'Əməliyyat'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#555', textAlign: 'left', borderBottom: '1px solid #eee' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {elanlar.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, maxWidth: 200 }}>{e.title}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ background: '#E6F1FB', color: '#185FA5', fontSize: 11, padding: '3px 8px', borderRadius: 20 }}>{e.category}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#888' }}>{e.hesablar?.full_name}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ background: e.status === 'aktiv' ? '#EAF3DE' : '#FEE', color: e.status === 'aktiv' ? '#2E7D32' : '#C00', fontSize: 11, padding: '3px 8px', borderRadius: 20 }}>{e.status}</span></td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => elanStatusDeyis(e.id, 'is_vip', !e.is_vip)} style={{ background: e.is_vip ? '#FAEEDA' : '#f5f5f5', color: e.is_vip ? '#E65100' : '#888', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                          {e.is_vip ? '⭐ VIP' : 'VIP et'}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => elanStatusDeyis(e.id, 'is_featured', !e.is_featured)} style={{ background: e.is_featured ? '#E6F1FB' : '#f5f5f5', color: e.is_featured ? '#185FA5' : '#888', border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                          {e.is_featured ? '🔝 Öndə' : 'Öndə çıxar'}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => elanSil(e.id)} style={{ background: '#FEE', color: '#C00', border: 'none', padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Sil</button>
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
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Mütəxəssislər ({mutexessisler.length})</h2>
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    {['Ad', 'Kateqoriya', 'Şəhər', 'Reytinq', 'Status', 'Əməliyyat'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#555', textAlign: 'left', borderBottom: '1px solid #eee' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mutexessisler.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f5f5f5', background: m.hesablar?.is_blocked ? '#FFF5F5' : '#fff' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>{m.hesablar?.full_name}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ background: '#E6F1FB', color: '#185FA5', fontSize: 11, padding: '3px 8px', borderRadius: 20 }}>{m.category}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#888' }}>{m.hesablar?.city}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>{'★'.repeat(Math.round(m.rating || 0))} {m.rating?.toFixed(1)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: m.is_verified ? '#EAF3DE' : '#FEE', color: m.is_verified ? '#2E7D32' : '#C00', fontSize: 11, padding: '3px 8px', borderRadius: 20 }}>
                          {m.is_verified ? '✅ Təsdiqlənib' : '⏳ Gözləyir'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', display: 'flex', gap: 6 }}>
                        <button onClick={() => mutexessisTesdiq(m.id, !m.is_verified)} style={{ background: m.is_verified ? '#FEE' : '#EAF3DE', color: m.is_verified ? '#C00' : '#2E7D32', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                          {m.is_verified ? 'Təsdiqi ləğv et' : 'Təsdiqlə'}
                        </button>
                        <button onClick={() => istifadeciBloklа(m.user_id, !m.hesablar?.is_blocked)} style={{ background: m.hesablar?.is_blocked ? '#EAF3DE' : '#FEE', color: m.hesablar?.is_blocked ? '#2E7D32' : '#C00', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                          {m.hesablar?.is_blocked ? 'Bloku aç' : 'Blokla'}
                        </button>
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
