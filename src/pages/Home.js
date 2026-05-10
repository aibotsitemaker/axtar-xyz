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
      .limit(6).then(({ data }) => setMutexessisler(data || []))
  }, [])

  const axtar = () => { if (axtaris.trim()) navigate(`/mutexessisler?q=${axtaris}`) }

  return (
    <div>
      <div className="hero">
        <span className="hero-badge">Azərbaycanda #1 xidmət platforması</span>
        <h1>Ehtiyacın olan <span>mütəxəssisi tap</span>,<br />işini həll et</h1>
        <p>Santexnik, elektrik, təmizlik, gözəllik və daha yüzlərlə sahədə peşəkar mütəxəssislər sizi gözləyir.</p>
        <div className="search-bar">
          <input value={axtaris} onChange={e => setAxtaris(e.target.value)} onKeyDown={e => e.key === 'Enter' && axtar()} placeholder="Hansı xidməti axtarırsınız?" />
          <button onClick={axtar}>Axtar</button>
        </div>
        <div className="popular-tags">
          {['Santexnik', 'Elektrik', 'Təmizlik', 'Rəssam', 'Kompüter'].map(t => (
            <span key={t} className="tag" onClick={() => navigate(`/mutexessisler?q=${t}`)}>{t}</span>
          ))}
        </div>
      </div>

      <div className="stats">
        {[['1,240+', 'Qeydiyyatlı mütəxəssis'], ['8,500+', 'Tamamlanmış iş'], ['50+', 'Xidmət kateqoriyası']].map(([n, l]) => (
          <div key={l} className="stat"><div className="stat-num">{n}</div><div className="stat-label">{l}</div></div>
        ))}
      </div>

      <div className="section" style={{ background: '#f8f9fa' }}>
        <div className="section-header">
          <h2 className="section-title">Kateqoriyalar</h2>
          <Link to="/mutexessisler" className="see-all">Hamısına bax</Link>
        </div>
        <div className="cat-grid">
          {KATEQORIYALAR.map(k => (
            <div key={k.ad} className="cat-card" onClick={() => navigate(`/mutexessisler?q=${k.ad}`)}>
              <div className="cat-icon" style={{ background: k.reng }}>{k.ikon}</div>
              <div className="cat-name">{k.ad}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Tövsiyə olunan mütəxəssislər</h2>
          <Link to="/mutexessisler" className="see-all">Hamısına bax</Link>
        </div>
        <div className="worker-grid">
          {mutexessisler.length === 0 ? (
            <p style={{ color: '#888', gridColumn: '1/-1', textAlign: 'center', padding: 40 }}>Hələ mütəxəssis qeydiyyatdan keçməyib</p>
          ) : mutexessisler.map(m => (
            <div key={m.id} className="worker-card">
              <div className="worker-top">
                <div className="avatar">{m.hesablar?.full_name?.[0] || '?'}</div>
                <div>
                  <div className="worker-name">{m.hesablar?.full_name}</div>
                  <div className="worker-meta">{m.category} · {m.hesablar?.city}</div>
                  <div style={{ fontSize: 13, color: '#EF9F27' }}>{'★'.repeat(Math.round(m.rating || 0))}<span style={{ color: '#888', marginLeft: 4 }}>{m.rating?.toFixed(1)}</span></div>
                </div>
              </div>
              <div className="skill-tags">
                {(m.skills || []).slice(0, 3).map(sk => <span key={sk} className="skill-tag">{sk}</span>)}
              </div>
              <div className="worker-footer">
                <span className="price">Başlayan: <strong>{m.start_price} AZN</strong></span>
                <Link to={`/mutexessis/${m.id}`} className="btn-primary">Ətraflı</Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="how">
        <h2 className="section-title" style={{ textAlign: 'center', marginBottom: 36 }}>Necə işləyir?</h2>
        <div className="steps">
          {[['1','Xidmət seç','Lazım olan xidməti kateqoriyadan seç'],['2','Mütəxəssisə bax','Profil və rəylərə əsasən seç'],['3','Əlaqə qur','Birbaşa yazış və razılığa gəl'],['4','Rəy yaz','Xidmətdən sonra rəy yaz']].map(([n,t,d]) => (
            <div key={n} className="step" style={{ textAlign: 'center' }}>
              <div className="step-num">{n}</div>
              <h4>{t}</h4>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="cta">
        <div className="cta-inner">
          <h2>Sən də mütəxəssississən?</h2>
          <p>Axtar.xyz-də profil aç, elan ver və hər gün yeni müştərilər qazan</p>
          <div className="cta-btns">
            <Link to="/qeydiyyat" className="cta-btn-white">Mütəxəssis kimi qeydiyyat</Link>
            <Link to="/mutexessisler" className="cta-btn-outline">Mütəxəssislərə bax</Link>
          </div>
        </div>
      </div>

      <footer className="footer">
        <div className="footer-logo">Axtar<span style={{ color: '#E24B4A' }}>.</span>xyz</div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/gizlilik" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>Gizlilik Siyasəti</Link>
          <Link to="/elaqe" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>Əlaqə</Link>
          <Link to="/mutexessisler" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>Mütəxəssislər</Link>
        </div>
        <p style={{ fontSize: 13, color: '#888' }}>© 2025 Axtar.xyz — Bütün hüquqlar qorunur</p>
      </footer>
    </div>
  )
}
