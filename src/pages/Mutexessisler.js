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

  useEffect(() => {
    const q = searchParams.get('q') || ''
    setAxtaris(q)
    yukle(q, kateqoriya)
  }, [searchParams])

  const yukle = async (q, kat) => {
    setLoading(true)
    let query = supabase.from('mutexessis_hesablari').select('*, hesablar(full_name, city, is_blocked)').order('rating', { ascending: false })
    if (kat && kat !== 'Hamısı') query = query.eq('category', kat)
    if (q) query = query.ilike('category', `%${q}%`)
    const { data } = await query
    setList((data || []).filter(m => !m.hesablar?.is_blocked))
    setLoading(false)
  }

  const axtar = () => { setSearchParams(axtaris ? { q: axtaris } : {}); yukle(axtaris, kateqoriya) }

  return (
    <div className="page-wrap">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Mütəxəssislər</h1>
        <div className="flex gap-2 max-w-lg">
          <input className="input flex-1" placeholder="Axtarın... (məs: santexnik)" value={axtaris} onChange={e => setAxtaris(e.target.value)} onKeyDown={e => e.key === 'Enter' && axtar()} />
          <button onClick={axtar} className="btn-primary shrink-0">Axtar</button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {KATEQORIYALAR.map(k => (
          <button key={k} onClick={() => { setKateqoriya(k); yukle(axtaris, k) }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${kateqoriya === k ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'}`}>
            {k}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Yüklənir...</div>
      ) : list.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-gray-500">Heç bir mütəxəssis tapılmadı</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(m => (
            <Link key={m.id} to={`/mutexessis/${m.id}`} className="card p-5 hover:shadow-md hover:border-primary-200 transition-all block">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-600 font-bold text-lg shrink-0">
                  {m.hesablar?.full_name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800 text-sm">{m.hesablar?.full_name}</span>
                    {m.is_verified && <span className="badge bg-green-50 text-green-600">✅</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{m.category} · {m.hesablar?.city}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-yellow-400 text-sm">{'★'.repeat(Math.round(m.rating || 0))}{'☆'.repeat(5 - Math.round(m.rating || 0))}</span>
                    <span className="text-xs text-gray-400">{m.rating?.toFixed(1)} ({m.review_count})</span>
                  </div>
                </div>
              </div>
              {m.bio && <p className="text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed">{m.bio}</p>}
              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div className="text-xs text-gray-500">Başlayan: <strong className="text-gray-700">{m.start_price} AZN</strong></div>
                <span className="text-xs font-medium text-primary-600">Ətraflı →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
