import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { GridSkeleton, CardSkeleton } from '../components/Skeleton'

const KATEQORIYALAR = ['Hamısı','Santexnik','Elektrik','Təmizlik','Rəssam','Gözəllik','Kompüter','Avtomobil','Köçürmə','Digər']

function EmptyState({ kateqoriya, axtaris }) {
  return (
    <div className="col-span-full text-center py-16">
      <div className="text-6xl mb-4">🔍</div>
      <h3 className="font-bold text-gray-700 text-lg mb-2">Mütəxəssis tapılmadı</h3>
      <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
        {axtaris
          ? `"${axtaris}" üçün mütəxəssis tapılmadı.`
          : kateqoriya !== 'Hamısı'
          ? `${kateqoriya} kateqoriyasında hələ mütəxəssis yoxdur.`
          : 'Hələ mütəxəssis qeydiyyatdan keçməyib.'}
      </p>
      <div className="flex gap-3 justify-center flex-wrap">
        <Link to="/qeydiyyat" className="btn-primary text-sm py-2.5 px-6">
          🔧 Mütəxəssis kimi qeydiyyat
        </Link>
        <Link to="/elanlar" className="btn-secondary text-sm py-2.5 px-6">
          📋 Elan ver
        </Link>
      </div>
    </div>
  )
}

export default function Mutexessisler() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [kateqoriya, setKateqoriya] = useState('Hamısı')
  const [axtaris, setAxtaris] = useState(searchParams.get('q') || '')
  const [seher, setSeher] = useState('Hamısı')
  const [sortBy, setSortBy] = useState('rating')

  const yukle = useCallback(async (q, kat, sh, sort) => {
    setLoading(true)
    let query = supabase
      .from('mutexessis_hesablari')
      .select('*, hesablar(full_name, city, is_blocked)')

    if (sort === 'rating') query = query.order('rating', { ascending: false })
    else if (sort === 'price_asc') query = query.order('start_price', { ascending: true })
    else if (sort === 'price_desc') query = query.order('start_price', { ascending: false })
    else if (sort === 'reviews') query = query.order('review_count', { ascending: false })

    if (kat && kat !== 'Hamısı') query = query.eq('category', kat)

    const { data } = await query
    let filtered = (data || []).filter(m => !m.hesablar?.is_blocked)
    if (q) filtered = filtered.filter(m =>
      m.category?.toLowerCase().includes(q.toLowerCase()) ||
      m.hesablar?.full_name?.toLowerCase().includes(q.toLowerCase()) ||
      m.bio?.toLowerCase().includes(q.toLowerCase())
    )
    if (sh && sh !== 'Hamısı') filtered = filtered.filter(m => m.hesablar?.city === sh)
    setList(filtered)
    setLoading(false)
  }, [])

  useEffect(() => {
    const q = searchParams.get('q') || ''
    setAxtaris(q)
    yukle(q, kateqoriya, seher, sortBy)
  }, [searchParams])

  const axtar = () => {
    setSearchParams(axtaris ? { q: axtaris } : {})
    yukle(axtaris, kateqoriya, seher, sortBy)
  }

  const filterDeyis = (kat, sh, sort) => {
    setKateqoriya(kat)
    setSeher(sh)
    setSortBy(sort)
    yukle(axtaris, kat, sh, sort)
  }

  return (
    <div className="page-wrap">
      {/* Başlıq */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Mütəxəssislər</h1>
        <p className="text-sm text-gray-500">{loading ? '...' : `${list.length} mütəxəssis tapıldı`}</p>
      </div>

      {/* Axtarış */}
      <div className="flex gap-2 mb-5 max-w-xl">
        <input
          className="input flex-1"
          placeholder="Ad, kateqoriya və ya açar söz..."
          value={axtaris}
          onChange={e => setAxtaris(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && axtar()}
        />
        <button onClick={axtar} className="btn-primary shrink-0">Axtar</button>
      </div>

      {/* Filterlər */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Kateqoriya */}
        <div className="flex gap-2 flex-wrap">
          {KATEQORIYALAR.map(k => (
            <button key={k}
              onClick={() => filterDeyis(k, seher, sortBy)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${kateqoriya === k ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'}`}>
              {k}
            </button>
          ))}
        </div>

        {/* Şəhər + Sort */}
        <div className="flex gap-2 shrink-0 ml-auto">
          <select className="input text-sm py-1.5 w-auto" value={seher} onChange={e => filterDeyis(kateqoriya, e.target.value, sortBy)}>
            {['Hamısı','Bakı','Gəncə','Sumqayıt','Mingəçevir','Lənkəran'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="input text-sm py-1.5 w-auto" value={sortBy} onChange={e => filterDeyis(kateqoriya, seher, e.target.value)}>
            <option value="rating">⭐ Reytinq</option>
            <option value="reviews">💬 Rəy sayı</option>
            <option value="price_asc">💰 Ucuz əvvəl</option>
            <option value="price_desc">💰 Baha əvvəl</option>
          </select>
        </div>
      </div>

      {/* Siyahı */}
      {loading ? (
        <GridSkeleton count={6} Component={CardSkeleton} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.length === 0
            ? <EmptyState kateqoriya={kateqoriya} axtaris={axtaris} />
            : list.map(m => (
              <Link key={m.id} to={`/mutexessis/${m.id}`} className="card p-5 hover:shadow-md hover:border-primary-200 transition-all block group">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-600 font-bold text-lg shrink-0 group-hover:bg-primary-100 transition-colors">
                    {m.hesablar?.full_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm truncate">{m.hesablar?.full_name}</span>
                      {m.is_verified && <span className="text-green-500 text-xs shrink-0">✅</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{m.category} · {m.hesablar?.city}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex">
                        {[1,2,3,4,5].map(s => (
                          <span key={s} className={`text-sm ${s <= Math.round(m.rating || 0) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                        ))}
                      </div>
                      <span className="text-xs text-gray-400 ml-1">({m.review_count})</span>
                    </div>
                  </div>
                </div>
                {m.bio && <p className="text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed">{m.bio}</p>}
                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-500">Başlayan: <strong className="text-gray-700">{m.start_price} AZN</strong></span>
                  <span className="text-xs font-medium text-primary-600 group-hover:translate-x-0.5 transition-transform">Ətraflı →</span>
                </div>
              </Link>
            ))
          }
        </div>
      )}
    </div>
  )
}
