import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [hesab, setHesab] = useState(null)
  const [mutexessis, setMutexessis] = useState(null)
  const [elanlar, setElanlar] = useState([])
  const [mesajlar, setMesajlar] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const yukle = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/giris'); return }
      const { data: h } = await supabase.from('hesablar').select('*').eq('id', user.id).single()
      setHesab(h)
      if (h?.role === 'mutexessis') {
        const { data: m } = await supabase.from('mutexessis_hesablari').select('*').eq('user_id', user.id).single()
        setMutexessis(m)
      } else {
        const { data: e } = await supabase.from('elanlar').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        setElanlar(e || [])
      }
      const { data: msg } = await supabase.from('mesajlar').select('*, sender:sender_id(full_name), receiver:receiver_id(full_name)')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(10)
      setMesajlar(msg || [])
      setLoading(false)
    }
    yukle()
  }, [navigate])

  if (loading) return <div style={s.center}>Yüklənir...</div>

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Salam, {hesab?.full_name?.split(' ')[0]}! 👋</h1>
          <p style={s.subtitle}>{hesab?.role === 'mutexessis' ? 'Mütəxəssis paneli' : 'Müştəri paneli'}</p>
        </div>
        <div style={s.badge}>{hesab?.role === 'mutexessis' ? '🔧 Mütəxəssis' : '👤 Müştəri'}</div>
      </div>

      <div style={s.grid}>
        {/* Sol panel */}
        <div>
          {hesab?.role === 'mutexessis' && mutexessis && (
            <div style={s.card}>
              <h2 style={s.cardTitle}>Profilim</h2>
              <div style={s.infoRow}><span style={s.infoLabel}>Kateqoriya</span><span>{mutexessis.category}</span></div>
              <div style={s.infoRow}><span style={s.infoLabel}>Qiymət</span><span>{mutexessis.start_price} AZN-dən</span></div>
              <div style={s.infoRow}><span style={s.infoLabel}>Reytinq</span><span>{'★'.repeat(Math.round(mutexessis.rating || 0))} {mutexessis.rating?.toFixed(1)}</span></div>
              <div style={s.infoRow}><span style={s.infoLabel}>Rəylər</span><span>{mutexessis.review_count} rəy</span></div>
              <Link to={`/mutexessis/${mutexessis.id}`} style={s.btn}>Profilə bax</Link>
            </div>
          )}

          {hesab?.role === 'musteri' && (
            <div style={s.card}>
              <div style={s.cardTitleRow}>
                <h2 style={s.cardTitle}>Elanlarım ({elanlar.length})</h2>
                <Link to="/elanlar" style={s.smallBtn}>+ Yeni elan</Link>
              </div>
              {elanlar.length === 0 ? <p style={s.empty}>Hələ elan verməmisiniz</p> :
                elanlar.map(e => (
                  <div key={e.id} style={s.elanCard}>
                    <div style={s.elanTitle}>{e.title}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <span style={s.elanBadge}>{e.category}</span>
                      <span style={{ ...s.elanBadge, background: e.status === 'aktiv' ? '#EAF3DE' : '#FEE', color: e.status === 'aktiv' ? '#2E7D32' : '#C00' }}>{e.status}</span>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          <div style={s.card}>
            <h2 style={s.cardTitle}>Hesab məlumatları</h2>
            <div style={s.infoRow}><span style={s.infoLabel}>Ad</span><span>{hesab?.full_name}</span></div>
            <div style={s.infoRow}><span style={s.infoLabel}>Telefon</span><span>{hesab?.phone || '—'}</span></div>
            <div style={s.infoRow}><span style={s.infoLabel}>Şəhər</span><span>{hesab?.city}</span></div>
          </div>
        </div>

        {/* Mesajlar */}
        <div style={s.card}>
          <h2 style={s.cardTitle}>Mesajlar ({mesajlar.length})</h2>
          {mesajlar.length === 0 ? <p style={s.empty}>Hələ mesaj yoxdur</p> :
            mesajlar.map(m => (
              <div key={m.id} style={s.msgCard}>
                <div style={s.msgTop}>
                  <strong style={{ fontSize: 13 }}>{m.sender?.full_name}</strong>
                  <span style={{ fontSize: 11, color: '#aaa' }}>{new Date(m.created_at).toLocaleDateString('az')}</span>
                </div>
                <p style={s.msgText}>{m.content}</p>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

const s = {
  center: { textAlign: 'center', padding: 80, color: '#888' },
  wrap: { maxWidth: 1000, margin: '0 auto', padding: '32px 24px 60px' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888' },
  badge: { background: '#E6F1FB', color: '#185FA5', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' },
  card: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 600, marginBottom: 14 },
  cardTitleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  infoRow: { display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #f5f5f5' },
  infoLabel: { color: '#888' },
  btn: { display: 'block', background: '#185FA5', color: '#fff', padding: '9px 16px', borderRadius: 8, fontSize: 13, textDecoration: 'none', textAlign: 'center', marginTop: 14 },
  smallBtn: { background: '#185FA5', color: '#fff', padding: '5px 12px', borderRadius: 8, fontSize: 12, textDecoration: 'none' },
  empty: { fontSize: 13, color: '#aaa', textAlign: 'center', padding: '20px 0' },
  elanCard: { border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 10 },
  elanTitle: { fontSize: 14, fontWeight: 500 },
  elanBadge: { background: '#E6F1FB', color: '#185FA5', fontSize: 11, padding: '2px 8px', borderRadius: 20 },
  msgCard: { border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 10 },
  msgTop: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
  msgText: { fontSize: 13, color: '#555' },
}
