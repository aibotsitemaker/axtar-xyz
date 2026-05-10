import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function MutexessisProfile() {
  const { id } = useParams()
  const [mutexessis, setMutexessis] = useState(null)
  const [reyler, setReyler] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [hesab, setHesab] = useState(null)
  const [ozProfil, setOzProfil] = useState(false)
  const [mesaj, setMesaj] = useState('')
  const [gonderilib, setGonderilib] = useState(false)
  const [reyForm, setReyForm] = useState({ rating: 5, comment: '' })
  const [reyGonderilib, setReyGonderilib] = useState(false)
  const [reyError, setReyError] = useState('')
  const [hoveredStar, setHoveredStar] = useState(0)
  const [sekillYuklenir, setSekillYuklenir] = useState(false)
  const [caption, setCaption] = useState('')
  const fileRef = useRef()

  useEffect(() => {
    const yukle = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data: h } = await supabase.from('hesablar').select('*').eq('id', user.id).single()
        setHesab(h)
        const { data: movcudRey } = await supabase.from('reyler').select('id').eq('musteri_id', user.id).eq('mutexessis_id', id).single()
        if (movcudRey) setReyGonderilib(true)
        // Öz profili mi?
        const { data: oz } = await supabase.from('mutexessis_hesablari').select('id').eq('id', id).eq('user_id', user.id).single()
        if (oz) setOzProfil(true)
      }
      const { data: m } = await supabase.from('mutexessis_hesablari').select('*, hesablar(id, full_name, city, phone, avatar_url)').eq('id', id).single()
      setMutexessis(m)
      const { data: r } = await supabase.from('reyler').select('*, hesablar(full_name)').eq('mutexessis_id', id).order('created_at', { ascending: false })
      setReyler(r || [])
      const { data: p } = await supabase.from('portfolio_sekiller').select('*').eq('mutexessis_id', id).order('created_at', { ascending: false })
      setPortfolio(p || [])
      setLoading(false)
    }
    yukle()
  }, [id])

  const mesajGonder = async () => {
    if (!mesaj.trim() || !user) return
    await supabase.from('mesajlar').insert({ sender_id: user.id, receiver_id: mutexessis.hesablar.id, content: mesaj })
    setGonderilib(true)
    setMesaj('')
  }

  const reyGonder = async () => {
    setReyError('')
    if (!user) { setReyError('Rəy yazmaq üçün daxil olun'); return }
    if (ozProfil) { setReyError('Öz profilinizə rəy yaza bilməzsiniz'); return }
    if (!reyForm.comment.trim()) { setReyError('Rəy mətni yazın'); return }
    const { error } = await supabase.from('reyler').insert({ musteri_id: user.id, mutexessis_id: id, rating: reyForm.rating, comment: reyForm.comment })
    if (error) { setReyError('Xəta baş verdi'); return }
    setReyGonderilib(true)
    const { data: r } = await supabase.from('reyler').select('*, hesablar(full_name)').eq('mutexessis_id', id).order('created_at', { ascending: false })
    setReyler(r || [])
    const { data: m } = await supabase.from('mutexessis_hesablari').select('*, hesablar(id, full_name, city, phone, avatar_url)').eq('id', id).single()
    setMutexessis(m)
  }

  const sekillYukle = async (e) => {
    const fayl = e.target.files[0]
    if (!fayl) return
    setSekillYuklenir(true)
    const faylAdi = `${user.id}/${Date.now()}_${fayl.name}`
    const { error: uploadError } = await supabase.storage.from('portfolio').upload(faylAdi, fayl)
    if (uploadError) { setSekillYuklenir(false); alert('Şəkil yüklənmədi'); return }
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={s.name}>{mutexessis.hesablar?.full_name}</h1>
                {mutexessis.is_verified && <span style={s.verifiedBadge}>✅ Təsdiqlənib</span>}
                {ozProfil && <span style={{ background: '#1a1a2e', color: '#fff', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>Öz profiliniz</span>}
              </div>
              <p style={s.category}>{mutexessis.category} · {mutexessis.hesablar?.city}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1,2,3,4,5].map(star => (
                    <span key={star} style={{ fontSize: 20, color: star <= Math.round(mutexessis.rating || 0) ? '#EF9F27' : '#ddd' }}>★</span>
                  ))}
                </div>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#185FA5' }}>{mutexessis.rating?.toFixed(1) || '0.0'}</span>
                <span style={{ fontSize: 13, color: '#888' }}>({mutexessis.review_count} rəy)</span>
              </div>
              <div style={s.badges}>
                <span style={s.badge}>🕐 {mutexessis.experience_years} il təcrübə</span>
                <span style={s.badge}>💰 {mutexessis.start_price} AZN-dən</span>
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

          {/* Portfolio */}
          <div style={s.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={s.secTitle}>Portfolio ({portfolio.length})</h2>
              {ozProfil && (
                <button onClick={() => fileRef.current.click()} style={s.addBtn} disabled={sekillYuklenir}>
                  {sekillYuklenir ? 'Yüklənir...' : '+ Şəkil əlavə et'}
                </button>
              )}
            </div>

            {ozProfil && (
              <div style={{ marginBottom: 16 }}>
                <input ref={fileRef} type="file" accept="image/*" onChange={sekillYukle} style={{ display: 'none' }} />
                <input style={s.captionInput} placeholder="Şəkil üçün açıqlama (isteğe bağlı)" value={caption} onChange={e => setCaption(e.target.value)} />
              </div>
            )}

            {portfolio.length === 0 ? (
              <p style={{ color: '#888', fontSize: 14 }}>{ozProfil ? 'Hələ şəkil yükləməmisiniz. "+ Şəkil əlavə et" düyməsinə basın.' : 'Portfolio şəkli yoxdur'}</p>
            ) : (
              <div style={s.portfolioGrid}>
                {portfolio.map(p => (
                  <div key={p.id} style={s.portfolioItem}>
                    <img src={p.image_url} alt={p.caption || 'Portfolio'} style={s.portfolioImg} />
                    {p.caption && <p style={s.portfolioCaption}>{p.caption}</p>}
                    {ozProfil && (
                      <button onClick={() => sekillSil(p)} style={s.deleteBtn}>🗑️ Sil</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rəy yazma */}
          <div style={s.section}>
            <h2 style={s.secTitle}>Rəy yaz</h2>
            {!user ? (
              <div style={s.infoBox}><Link to="/giris" style={{ color: '#185FA5' }}>Daxil olun</Link> — rəy yazmaq üçün</div>
            ) : ozProfil ? (
              <div style={s.infoBox}>Öz profilinizə rəy yaza bilməzsiniz</div>
            ) : reyGonderilib ? (
              <div style={s.successBox}>✅ Rəyiniz uğurla göndərildi!</div>
            ) : (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <label style={s.formLabel}>Qiymətləndirmə</label>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                    {[1,2,3,4,5].map(star => (
                      <span key={star} onClick={() => setReyForm({ ...reyForm, rating: star })} onMouseEnter={() => setHoveredStar(star)} onMouseLeave={() => setHoveredStar(0)}
                        style={{ fontSize: 32, cursor: 'pointer', color: star <= (hoveredStar || reyForm.rating) ? '#EF9F27' : '#ddd' }}>★</span>
                    ))}
                    <span style={{ fontSize: 14, color: '#888', marginLeft: 8 }}>{['','Pis','Orta','Yaxşı','Çox yaxşı','Əla'][hoveredStar || reyForm.rating]}</span>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={s.formLabel}>Rəyiniz</label>
                  <textarea style={s.textarea} placeholder="Mütəxəssisin işi haqqında rəyinizi yazın..." value={reyForm.comment} onChange={e => setReyForm({ ...reyForm, comment: e.target.value })} />
                </div>
                {reyError && <div style={s.errorBox}>{reyError}</div>}
                <button onClick={reyGonder} style={s.reyBtn}>Rəy göndər</button>
              </div>
            )}
          </div>

          {/* Rəylər siyahısı */}
          <div style={s.section}>
            <h2 style={s.secTitle}>Rəylər ({reyler.length})</h2>
            {reyler.length === 0 ? <p style={{ color: '#888', fontSize: 14 }}>Hələ rəy yoxdur</p> :
              reyler.map(r => (
                <div key={r.id} style={s.reyCard}>
                  <div style={s.reyTop}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={s.reyAvatar}>{r.hesablar?.full_name?.[0] || '?'}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{r.hesablar?.full_name}</div>
                        <div style={{ fontSize: 11, color: '#aaa' }}>{new Date(r.created_at).toLocaleDateString('az')}</div>
                      </div>
                    </div>
                    <div>{[1,2,3,4,5].map(star => <span key={star} style={{ color: star <= r.rating ? '#EF9F27' : '#ddd', fontSize: 16 }}>★</span>)}</div>
                  </div>
                  <p style={{ fontSize: 14, color: '#444', marginTop: 10, lineHeight: 1.6 }}>{r.comment}</p>
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
            {!ozProfil && <>
              <hr style={s.hr} />
              <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>Mesaj göndər:</p>
              {!user ? (
                <Link to="/giris" style={s.loginBtn}>Mesaj üçün daxil ol</Link>
              ) : gonderilib ? (
                <div style={s.successBox}>✅ Mesajınız göndərildi!</div>
              ) : (
                <>
                  <textarea style={s.textarea} placeholder="Mesajınızı yazın..." value={mesaj} onChange={e => setMesaj(e.target.value)} />
                  <button onClick={mesajGonder} style={s.sendBtn}>Mesaj göndər</button>
                </>
              )}
            </>}
            <hr style={s.hr} />
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Reytinq xülasəsi</h4>
            {[5,4,3,2,1].map(star => {
              const sayi = reyler.filter(r => r.rating === star).length
              const faiz = reyler.length > 0 ? (sayi / reyler.length) * 100 : 0
              return (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#888', width: 20 }}>{star}★</span>
                  <div style={{ flex: 1, height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${faiz}%`, height: '100%', background: '#EF9F27', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#888', width: 20 }}>{sayi}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  center: { textAlign: 'center', padding: 80, color: '#888' },
  wrap: { maxWidth: 1000, margin: '0 auto', padding: '24px 24px 80px' },
  back: { color: '#185FA5', textDecoration: 'none', fontSize: 14, display: 'inline-block', marginBottom: 20 },
  layout: { display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' },
  main: {},
  profileCard: { display: 'flex', gap: 20, background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 24, marginBottom: 16, alignItems: 'flex-start', flexWrap: 'wrap' },
  avatarBig: { width: 80, height: 80, borderRadius: '50%', background: '#E6F1FB', color: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 32, flexShrink: 0 },
  profileInfo: { flex: 1, minWidth: 200 },
  name: { fontSize: 22, fontWeight: 700 },
  verifiedBadge: { background: '#EAF3DE', color: '#2E7D32', fontSize: 12, padding: '3px 10px', borderRadius: 20 },
  category: { fontSize: 14, color: '#888', marginTop: 4 },
  badges: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 },
  badge: { background: '#E6F1FB', color: '#185FA5', fontSize: 12, padding: '4px 10px', borderRadius: 20 },
  section: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 20, marginBottom: 16 },
  secTitle: { fontSize: 16, fontWeight: 600, margin: 0 },
  bio: { fontSize: 14, color: '#444', lineHeight: 1.7 },
  skillTags: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  skillTag: { background: '#E6F1FB', color: '#185FA5', fontSize: 13, padding: '5px 12px', borderRadius: 20 },
  addBtn: { background: '#185FA5', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  captionInput: { width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  portfolioGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 },
  portfolioItem: { position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #eee' },
  portfolioImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' },
  portfolioCaption: { fontSize: 12, color: '#555', padding: '6px 8px', background: '#f8f9fa' },
  deleteBtn: { width: '100%', background: '#FEE', color: '#C00', border: 'none', padding: '6px', fontSize: 12, cursor: 'pointer' },
  infoBox: { background: '#f5f5f5', padding: '12px 16px', borderRadius: 8, fontSize: 14, color: '#555' },
  successBox: { background: '#EAF3DE', color: '#2E7D32', padding: '12px 16px', borderRadius: 8, fontSize: 14 },
  errorBox: { background: '#FEE', color: '#C00', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12 },
  formLabel: { fontSize: 13, color: '#666', fontWeight: 500 },
  textarea: { width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '10px 12px', fontSize: 13, minHeight: 90, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' },
  reyBtn: { background: '#185FA5', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontWeight: 500 },
  reyCard: { border: '1px solid #eee', borderRadius: 10, padding: 16, marginBottom: 12 },
  reyTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  reyAvatar: { width: 36, height: 36, borderRadius: '50%', background: '#E6F1FB', color: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14 },
  sidebar: { position: 'sticky', top: 80 },
  contactCard: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 20 },
  contactTitle: { fontSize: 16, fontWeight: 600, marginBottom: 14 },
  phoneBtn: { display: 'block', background: '#185FA5', color: '#fff', padding: '10px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 14, textAlign: 'center', marginBottom: 14 },
  hr: { border: 'none', borderTop: '1px solid #eee', margin: '14px 0' },
  loginBtn: { display: 'block', background: '#f5f5f5', color: '#185FA5', padding: '10px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 14, textAlign: 'center' },
  sendBtn: { width: '100%', background: '#185FA5', color: '#fff', border: 'none', padding: '10px', borderRadius: 8, fontSize: 14, cursor: 'pointer', marginTop: 10 },
}
