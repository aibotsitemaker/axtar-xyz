import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function MutexessisProfile() {
  const { id } = useParams()
  const [mutexessis, setMutexessis] = useState(null)
  const [reyler, setReyler] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [mesaj, setMesaj] = useState('')
  const [gonderilib, setGonderilib] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    supabase.from('mutexessis_hesablari').select('*, hesablar(id, full_name, city, phone, avatar_url)').eq('id', id).single()
      .then(({ data }) => { setMutexessis(data); setLoading(false) })
    supabase.from('reyler').select('*, hesablar(full_name)').eq('mutexessis_id', id).order('created_at', { ascending: false })
      .then(({ data }) => setReyler(data || []))
  }, [id])

  const mesajGonder = async () => {
    if (!mesaj.trim() || !user) return
    await supabase.from('mesajlar').insert({ sender_id: user.id, receiver_id: mutexessis.hesablar.id, content: mesaj })
    setGonderilib(true)
    setMesaj('')
  }

  if (loading) return <div style={s.center}>Yüklənir...</div>
  if (!mutexessis) return <div style={s.center}>Mütəxəssis tapılmadı</div>

  return (
    <div style={s.wrap}>
      <Link to="/mutexessisler" style={s.back}>← Geri</Link>
      <div style={s.layout}>
        <div style={s.main}>
          {/* Profil başlığı */}
          <div style={s.profileCard}>
            <div style={s.avatarBig}>{mutexessis.hesablar?.full_name?.[0] || '?'}</div>
            <div style={s.profileInfo}>
              <h1 style={s.name}>{mutexessis.hesablar?.full_name}</h1>
              <p style={s.category}>{mutexessis.category} · {mutexessis.hesablar?.city}</p>
              <div style={{ fontSize: 16, color: '#EF9F27' }}>
                {'★'.repeat(Math.round(mutexessis.rating || 0))}
                <span style={{ color: '#888', fontSize: 13, marginLeft: 6 }}>{mutexessis.rating?.toFixed(1)} ({mutexessis.review_count} rəy)</span>
              </div>
              <div style={s.badges}>
                <span style={s.badge}>🕐 {mutexessis.experience_years} il təcrübə</span>
                <span style={s.badge}>💰 {mutexessis.start_price} AZN-dən</span>
                {mutexessis.is_verified && <span style={{ ...s.badge, background: '#EAF3DE', color: '#2E7D32' }}>✅ Təsdiqlənib</span>}
              </div>
            </div>
          </div>

          {/* Bio */}
          {mutexessis.bio && (
            <div style={s.section}>
              <h2 style={s.secTitle}>Haqqında</h2>
              <p style={s.bio}>{mutexessis.bio}</p>
            </div>
          )}

          {/* Bacarıqlar */}
          {mutexessis.skills?.length > 0 && (
            <div style={s.section}>
              <h2 style={s.secTitle}>Bacarıqlar</h2>
              <div style={s.skillTags}>
                {mutexessis.skills.map(sk => <span key={sk} style={s.skillTag}>{sk}</span>)}
              </div>
            </div>
          )}

          {/* Rəylər */}
          <div style={s.section}>
            <h2 style={s.secTitle}>Rəylər ({reyler.length})</h2>
            {reyler.length === 0 ? <p style={{ color: '#888', fontSize: 14 }}>Hələ rəy yoxdur</p> :
              reyler.map(r => (
                <div key={r.id} style={s.reyCard}>
                  <div style={s.reyTop}>
                    <strong style={{ fontSize: 14 }}>{r.hesablar?.full_name}</strong>
                    <span style={{ color: '#EF9F27' }}>{'★'.repeat(r.rating)}</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#555', marginTop: 6 }}>{r.comment}</p>
                </div>
              ))
            }
          </div>
        </div>

        {/* Yan panel */}
        <div style={s.sidebar}>
          <div style={s.contactCard}>
            <h3 style={s.contactTitle}>Əlaqə</h3>
            {mutexessis.hesablar?.phone && (
              <a href={`tel:${mutexessis.hesablar.phone}`} style={s.phoneBtn}>📞 {mutexessis.hesablar.phone}</a>
            )}
            <hr style={s.hr} />
            <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>Platforma üzərindən mesaj göndər:</p>
            {!user ? (
              <Link to="/giris" style={s.loginBtn}>Mesaj üçün daxil ol</Link>
            ) : gonderilib ? (
              <div style={s.success}>✅ Mesajınız göndərildi!</div>
            ) : (
              <>
                <textarea style={s.textarea} placeholder="Mesajınızı yazın..." value={mesaj} onChange={e => setMesaj(e.target.value)} />
                <button onClick={mesajGonder} style={s.sendBtn}>Mesaj göndər</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  center: { textAlign: 'center', padding: 80, color: '#888' },
  wrap: { maxWidth: 1000, margin: '0 auto', padding: '24px 24px 60px' },
  back: { color: '#185FA5', textDecoration: 'none', fontSize: 14, display: 'inline-block', marginBottom: 20 },
  layout: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' },
  main: {},
  profileCard: { display: 'flex', gap: 20, background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 24, marginBottom: 20, alignItems: 'flex-start' },
  avatarBig: { width: 80, height: 80, borderRadius: '50%', background: '#E6F1FB', color: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 32, flexShrink: 0 },
  profileInfo: { flex: 1 },
  name: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  category: { fontSize: 14, color: '#888', marginBottom: 8 },
  badges: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 },
  badge: { background: '#E6F1FB', color: '#185FA5', fontSize: 12, padding: '4px 10px', borderRadius: 20 },
  section: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 },
  secTitle: { fontSize: 16, fontWeight: 600, marginBottom: 12 },
  bio: { fontSize: 14, color: '#444', lineHeight: 1.7 },
  skillTags: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  skillTag: { background: '#E6F1FB', color: '#185FA5', fontSize: 13, padding: '5px 12px', borderRadius: 20 },
  reyCard: { border: '1px solid #eee', borderRadius: 8, padding: 14, marginBottom: 10 },
  reyTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sidebar: { position: 'sticky', top: 80 },
  contactCard: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 20 },
  contactTitle: { fontSize: 16, fontWeight: 600, marginBottom: 14 },
  phoneBtn: { display: 'block', background: '#185FA5', color: '#fff', padding: '10px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 14, textAlign: 'center', marginBottom: 14 },
  hr: { border: 'none', borderTop: '1px solid #eee', margin: '14px 0' },
  loginBtn: { display: 'block', background: '#f5f5f5', color: '#185FA5', padding: '10px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 14, textAlign: 'center' },
  success: { background: '#EAF3DE', color: '#2E7D32', padding: '10px 14px', borderRadius: 8, fontSize: 13, textAlign: 'center' },
  textarea: { width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '10px 12px', fontSize: 13, minHeight: 90, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' },
  sendBtn: { width: '100%', background: '#185FA5', color: '#fff', border: 'none', padding: '10px', borderRadius: 8, fontSize: 14, cursor: 'pointer', marginTop: 10 },
}
