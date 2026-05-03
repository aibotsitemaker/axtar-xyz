import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const KATEQORIYALAR = [
  { ad: 'Santexnik', ikon: '🔧', reng: '#E6F1FB' },
  { ad: 'Elektrik', ikon: '⚡', reng: '#FAEEDA' },
  { ad: 'Təmizlik', ikon: '🧹', reng: '#EAF3DE' },
  { ad: 'Rəssam', ikon: '🎨', reng: '#FCEBEB' },
  { ad: 'Gözəllik', ikon: '💅', reng: '#FBEAF0' },
  { ad: 'Kompüter', ikon: '💻', reng: '#E1F5EE' },
  { ad: 'Avtomobil', ikon: '🚗', reng: '#EEEDFE' },
  { ad: 'Köçürmə', ikon: '📦', reng: '#FAEEDA' },
]

export default function Home() {
  const [axtaris, setAxtaris] = useState('')
  const [mutexessisler, setMutexessisler] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('mutexessis_hesablari')
      .select('*, hesablar(full_name, city, avatar_url)')
      .limit(6)
      .then(({ data }) => setMutexessisler(data || []))
  }, [])

  const axtar = () => {
    if (axtaris.trim()) navigate(`/mutexessisler?q=${axtaris}`)
  }

  return (
    <div>
      {/* Hero */}
      <div style={s.hero}>
        <span style={s.badge}>Azərbaycanda #1 xidmət platforması</span>
        <h1 style={s.h1}>Ehtiyacın olan <span style={{ color: '#185FA5' }}>mütəxəssisi tap</span>,<br />işini həll et</h1>
        <p style={s.heroP}>Santexnik, elektrik, təmizlik, gözəllik və daha yüzlərlə sahədə peşəkar mütəxəssislər sizi gözləyir.</p>
        <div style={s.searchBar}>
          <input value={axtaris} onChange={e => setAxtaris(e.target.value)} onKeyDown={e => e.key === 'Enter' && axtar()} placeholder="Hansı xidməti axtarırsınız? (məs: santexnik)" style={s.searchInput} />
          <button onClick={axtar} style={s.searchBtn}>Axtar</button>
        </div>
        <div style={s.tags}>
          {['Santexnik', 'Elektrik', 'Təmizlik', 'Rəssam', 'Kompüter'].map(t => (
            <span key={t} onClick={() => navigate(`/mutexessisler?q=${t}`)} style={s.tag}>{t}</span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={s.stats}>
        {[['1,240+', 'Qeydiyyatlı mütəxəssis'], ['8,500+', 'Tamamlanmış iş'], ['50+', 'Xidmət kateqoriyası']].map(([n, l]) => (
          <div key={l} style={s.stat}><div style={s.statNum}>{n}</div><div style={s.statLabel}>{l}</div></div>
        ))}
      </div>

      {/* Kateqoriyalar */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>Kateqoriyalar</h2>
          <Link to="/mutexessisler" style={s.seeAll}>Hamısına bax</Link>
        </div>
        <div style={s.catGrid}>
          {KATEQORIYALAR.map(k => (
            <div key={k.ad} onClick={() => navigate(`/mutexessisler?q=${k.ad}`)} style={s.catCard}>
              <div style={{ ...s.catIcon, background: k.reng }}>{k.ikon}</div>
              <div style={s.catName}>{k.ad}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tövsiyə olunan mütəxəssislər */}
      <div style={{ ...s.section, background: '#f8f9fa' }}>
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>Tövsiyə olunan mütəxəssislər</h2>
          <Link to="/mutexessisler" style={s.seeAll}>Hamısına bax</Link>
        </div>
        <div style={s.workerGrid}>
          {mutexessisler.length === 0 ? (
            <p style={{ color: '#888', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>Hələ mütəxəssis qeydiyyatdan keçməyib</p>
          ) : mutexessisler.map(m => (
            <div key={m.id} style={s.workerCard}>
              <div style={s.workerTop}>
                <div style={s.avatar}>{m.hesablar?.full_name?.[0] || '?'}</div>
                <div>
                  <div style={s.workerName}>{m.hesablar?.full_name}</div>
                  <div style={s.workerCity}>{m.category} · {m.hesablar?.city}</div>
                  <div>{'★'.repeat(Math.round(m.rating || 0))}<span style={s.ratingNum}>{m.rating?.toFixed(1)} ({m.review_count} rəy)</span></div>
                </div>
              </div>
              <div style={s.skillTags}>
                {(m.skills || []).slice(0, 3).map(sk => <span key={sk} style={s.skillTag}>{sk}</span>)}
              </div>
              <div style={s.workerFooter}>
                <span style={s.price}>Başlayan: <strong>{m.start_price} AZN</strong></span>
                <Link to={`/mutexessis/${m.id}`} style={s.contactBtn}>Ətraflı</Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Necə işləyir */}
      <div style={s.how}>
        <h2 style={{ ...s.sectionTitle, textAlign: 'center', marginBottom: 36 }}>Necə işləyir?</h2>
        <div style={s.steps}>
          {[
            ['1', 'Xidmət seç', 'Lazım olan xidməti kateqoriyadan seç və ya axtarışa yaz'],
            ['2', 'Mütəxəssisə bax', 'Profil, portfolio və rəylərə əsasən ən uyğun mütəxəssisi tap'],
            ['3', 'Əlaqə qur', 'Mütəxəssislə birbaşa platformadan yazış və razılığa gəl'],
            ['4', 'Rəy yaz', 'Xidmətdən sonra rəy yaz, digərlərinə kömək et'],
          ].map(([n, t, d]) => (
            <div key={n} style={s.step}>
              <div style={s.stepNum}>{n}</div>
              <h4 style={s.stepTitle}>{t}</h4>
              <p style={s.stepDesc}>{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={s.cta}>
        <div style={s.ctaInner}>
          <h2 style={s.ctaH2}>Sən də mütəxəssississən?</h2>
          <p style={s.ctaP}>Axtar.xyz-də profil aç, elan ver və hər gün yeni müştərilər qazan</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link to="/qeydiyyat" style={s.ctaBtnWhite}>Mütəxəssis kimi qeydiyyat</Link>
            <Link to="/nece-isleyir" style={s.ctaBtnOutline}>Daha çox öyrən</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  hero: { background: '#fff', padding: '64px 32px 48px', textAlign: 'center', borderBottom: '1px solid #eee' },
  badge: { display: 'inline-block', background: '#E6F1FB', color: '#185FA5', fontSize: 12, fontWeight: 500, padding: '4px 14px', borderRadius: 20, marginBottom: 20 },
  h1: { fontSize: 40, fontWeight: 700, lineHeight: 1.25, marginBottom: 16, maxWidth: 620, marginLeft: 'auto', marginRight: 'auto' },
  heroP: { fontSize: 16, color: '#666', maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.7 },
  searchBar: { display: 'flex', maxWidth: 560, margin: '0 auto 16px', border: '2px solid #378ADD', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 4px #E6F1FB' },
  searchInput: { flex: 1, border: 'none', outline: 'none', padding: '14px 18px', fontSize: 15 },
  searchBtn: { background: '#185FA5', color: '#fff', border: 'none', padding: '12px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  tags: { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  tag: { background: '#f5f5f5', border: '1px solid #eee', color: '#555', fontSize: 13, padding: '5px 12px', borderRadius: 20, cursor: 'pointer' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', background: '#fff', borderBottom: '1px solid #eee' },
  stat: { textAlign: 'center', padding: '24px', borderRight: '1px solid #eee' },
  statNum: { fontSize: 28, fontWeight: 700, color: '#185FA5' },
  statLabel: { fontSize: 13, color: '#888', marginTop: 4 },
  section: { padding: '48px 32px', background: '#fff' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  sectionTitle: { fontSize: 22, fontWeight: 600 },
  seeAll: { fontSize: 14, color: '#185FA5', textDecoration: 'none' },
  catGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 },
  catCard: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '20px 16px', textAlign: 'center', cursor: 'pointer' },
  catIcon: { width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 20 },
  catName: { fontSize: 14, fontWeight: 500 },
  workerGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 },
  workerCard: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 20 },
  workerTop: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 48, height: 48, borderRadius: '50%', background: '#E6F1FB', color: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 18 },
  workerName: { fontSize: 15, fontWeight: 500 },
  workerCity: { fontSize: 12, color: '#888', marginTop: 2 },
  ratingNum: { fontSize: 12, color: '#888', marginLeft: 4 },
  skillTags: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 },
  skillTag: { fontSize: 11, background: '#E6F1FB', color: '#185FA5', padding: '3px 9px', borderRadius: 20 },
  workerFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid #eee' },
  price: { fontSize: 13, color: '#888' },
  contactBtn: { background: '#185FA5', color: '#fff', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none' },
  how: { background: '#fff', borderTop: '1px solid #eee', padding: '48px 32px', textAlign: 'center' },
  steps: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24, maxWidth: 800, margin: '0 auto' },
  step: { textAlign: 'center' },
  stepNum: { width: 40, height: 40, background: '#185FA5', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16, margin: '0 auto 14px' },
  stepTitle: { fontSize: 14, fontWeight: 500, marginBottom: 6 },
  stepDesc: { fontSize: 13, color: '#888', lineHeight: 1.6 },
  cta: { padding: '48px 32px', background: '#f8f9fa' },
  ctaInner: { background: '#185FA5', borderRadius: 16, padding: '48px 32px', maxWidth: 700, margin: '0 auto', textAlign: 'center' },
  ctaH2: { fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 12 },
  ctaP: { color: '#B5D4F4', fontSize: 15, marginBottom: 28 },
  ctaBtnWhite: { background: '#fff', color: '#185FA5', padding: '12px 28px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none' },
  ctaBtnOutline: { background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.4)', padding: '12px 28px', borderRadius: 8, fontSize: 15, textDecoration: 'none' },
}
