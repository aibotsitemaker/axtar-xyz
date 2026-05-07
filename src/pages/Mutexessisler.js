import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const KATEQORIYALAR = ['Hamısı','Santexnik','Elektrik','Təmizlik','Rəssam','Gözəllik','Kompüter','Avtomobil','Köçürmə','Digər']

export default function Mutexessisler() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [kateqoriya, setKateqoriya] = useState('Hamısı')
  const [axtaris, setAxtaris] = useState(searchParams.get('q') || '')

  useEffect(() => { yukle(searchParams.get('q')) }, [searchParams])

  const yukle = async (q) => {
    setLoading(true)
    let query = supabase.from('mutexessis_hesablari').select('*, hesablar(full_name, city)').order('rating', { ascending: false })
    if (kateqoriya !== 'Hamısı') query = query.eq('category', kateqoriya)
    if (q) query = query.ilike('category', `%${q}%`)
    const { data } = await query
    setList(data || [])
    setLoading(false)
  }

  const axtar = () => { setSearchParams(axtaris ? { q: axtaris } : {}); yukle(axtaris) }

  return (
    <div className="page-wrap">
      <h1 className="page-title">Mütəxəssislər</h1>
      <div className="search-bar" style={{ maxWidth: 500, marginBottom: 20 }}>
        <input placeholder="Axtarın..." value={axtaris} onChange={e => setAxtaris(e.target.value)} onKeyDown={e => e.key === 'Enter' && axtar()} />
        <button onClick={axtar}>Axtar</button>
      </div>
      <div className="filter-bar">
        {KATEQORIYALAR.map(k => (
          <span key={k} onClick={() => { setKateqoriya(k); yukle(k === 'Hamısı' ? null : k) }}
            className={`filter-tag ${kateqoriya === k ? 'active' : ''}`}>{k}</span>
        ))}
      </div>
      {loading ? <div style={{ textAlign:'center',padding:60,color:'#888' }}>Yüklənir...</div> :
        list.length === 0 ? <div style={{ textAlign:'center',padding:60,color:'#888' }}>Heç bir mütəxəssis tapılmadı</div> :
          <div className="cards-grid-3">
            {list.map(m => (
              <div key={m.id} className="card">
                <div className="worker-top">
                  <div className="avatar">{m.hesablar?.full_name?.[0] || '?'}</div>
                  <div>
                    <div className="worker-name">{m.hesablar?.full_name}</div>
                    <div className="worker-meta">{m.category} · {m.hesablar?.city}</div>
                    <div style={{ fontSize:13,color:'#EF9F27' }}>{'★'.repeat(Math.round(m.rating||0))}<span style={{ color:'#888',marginLeft:4 }}>{m.rating?.toFixed(1)} ({m.review_count} rəy)</span></div>
                  </div>
                </div>
                {m.bio && <p style={{ fontSize:13,color:'#666',lineHeight:1.6,marginBottom:14 }}>{m.bio?.slice(0,100)}{m.bio?.length>100?'...':''}</p>}
                <div className="worker-footer">
                  <span className="price">Başlayan: <strong>{m.start_price} AZN</strong></span>
                  <Link to={`/mutexessis/${m.id}`} className="btn-primary">Ətraflı</Link>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}
