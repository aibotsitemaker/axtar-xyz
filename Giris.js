import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const KATEQORIYALAR = ['Hamısı', 'Santexnik', 'Elektrik', 'Təmizlik', 'Rəssam', 'Gözəllik', 'Kompüter', 'Avtomobil', 'Köçürmə', 'Digər']

export default function Mutexessisler() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [kateqoriya, setKateqoriya] = useState('Hamısı')
  const [axtaris, setAxtaris] = useState(searchParams.get('q') || '')

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setAxtaris(q)
    yukle(q)
  }, [searchParams])

  const yukle = async (q) => {
    setLoading(true)
    let query = supabase.from('mutexessis_hesablari')
      .select('*, hesablar(full_name, city, avatar_url)')
      .order('rating', { ascending: false })
    if (kateqoriya !== 'Hamısı') query = query.eq('category', kateqoriya)
    if (q) query = query.ilike('category', `%${q}%`)
    const { data } = await query
    setList(data || [])
    setLoading(false)
  }

  const axtar = () => {
    setSearchParams(axtaris ? { q: axtaris } : {})
    yukle(axtaris)
  }

  return (
    <div style={s.wrap}>
      <h1 style={s.title}>Mütəxəssislər</h1>
      <div style={s.searchBar}>
        <input style={s.searchInput} placeholder="Axtarın... (məs: santexnik)" value={axtaris} onChange={e => setAxtaris(e.target.value)} onKeyDown={e => e.key === 'Enter' && axtar()} />
        <button style={s.searchBtn} onClick={axtar}>Axtar</button>
      </div>
      <div style={s.cats}>
        {KATEQORIYALAR.map(k => (
          <span key={k} onClick={() => { setKateqoriya(k); yukle(k === 'Hamısı' ? null : k) }}
            style={{ ...s.cat, ...(kateqoriya === k ? s.catActive : {}) }}>{k}</span>
        ))}
      </div>
      {loading ? <div style={s.center}>Yüklənir...</div> :
        list.length === 0 ? <div style={s.center}>Heç bir mütəxəssis tapılmadı</div> :
          <div style={s.grid}>
            {list.map(m => (
              <div key={m.id} style={s.card}>
                <div style={s.cardTop}>
                  <div style={s.avatar}>{m.hesablar?.full_name?.[0] || '?'}</div>
                  <div>
                    <div style={s.name}>{m.hesablar?.full_name}</div>
                    <div style={s.meta}>{m.category} · {m.hesablar?.city}</div>
                    <div style={{ fontSize: 13, color: '#EF9F27' }}>{'★'.repeat(Math.round(m.rating || 0))}<span style={{ color: '#888', marginLeft: 4 }}>{m.rating?.toFixed(1)} ({m.review_count} rəy)</span></div>
                  </div>
                </div>
                {m.bio && <p style={s.bio}>{m.bio?.slice(0, 100)}{m.bio?.length > 100 ? '...' : ''}</p>}
                <div style={s.footer}>
                  <span style={s.price}>Başlayan: <strong>{m.start_price} AZN</strong></span>
                  <Link to={`/mutexessis/${m.id}`} style={s.btn}>Ətraflı bax</Link>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

const s = {
  wrap: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  title: { fontSize: 26, fontWeight: 700, marginBottom: 20 },
  searchBar: { display: 'flex', border: '2px solid #378ADD', borderRadius: 10, overflow: 'hidden', marginBottom: 20, maxWidth: 500 },
  searchInput: { flex: 1, border: 'none', outline: 'none', padding: '10px 14px', fontSize: 14 },
  searchBtn: { background: '#185FA5', color: '#fff', border: 'none', padding: '10px 20px', fontSize: 14, cursor: 'pointer' },
  cats: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 },
  cat: { padding: '6px 14px', borderRadius: 20, border: '1px solid #eee', fontSize: 13, cursor: 'pointer', color: '#555', background: '#fff' },
  catActive: { background: '#185FA5', color: '#fff', borderColor: '#185FA5' },
  center: { textAlign: 'center', padding: 60, color: '#888' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 },
  card: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 20 },
  cardTop: { display: 'flex', gap: 12, marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: '50%', background: '#E6F1FB', color: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 18, flexShrink: 0 },
  name: { fontSize: 15, fontWeight: 500 },
  meta: { fontSize: 12, color: '#888', marginTop: 2 },
  bio: { fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 14 },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #eee' },
  price: { fontSize: 13, color: '#888' },
  btn: { background: '#185FA5', color: '#fff', padding: '7px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none' },
}
