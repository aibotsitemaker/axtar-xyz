import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const KATEQORIYALAR = ['Hamısı','Santexnik','Elektrik','Təmizlik','Rəssam','Gözəllik','Kompüter','Avtomobil','Köçürmə','Digər']

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-4 animate-pulse border border-gray-100">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-gray-100 rounded-full w-3/4" />
          <div className="h-3 bg-gray-100 rounded-full w-1/2" />
          <div className="h-3 bg-gray-100 rounded-full w-1/3" />
        </div>
        <div className="text-right space-y-1">
          <div className="h-4 bg-gray-100 rounded-full w-10" />
          <div className="h-3 bg-gray-100 rounded-full w-8" />
        </div>
      </div>
      <div className="h-3 bg-gray-100 rounded-full w-full mb-1.5" />
      <div className="h-3 bg-gray-100 rounded-full w-4/5" />
    </div>
  )
}

function EmptyState({ kateqoriya, axtaris }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="text-6xl mb-4">🔍</div>
      <h3 className="font-bold text-gray-700 text-base mb-2">Mütəxəssis tapılmadı</h3>
      <p className="text-sm text-gray-400 leading-relaxed mb-6 max-w-xs">
        {axtaris ? `"${axtaris}" üçün mütəxəssis tapılmadı.` :
         kateqoriya !== 'Hamısı' ? `${kateqoriya} kateqoriyasında hələ mütəxəssis yoxdur.` :
         'Hələ mütəxəssis qeydiyyatdan keçməyib.'}
      </p>
      <div className="flex gap-2 flex-wrap justify-center">
        <Link to="/qeydiyyat" className="bg-[#185FA5] text-white text-sm font-semibold px-5 py-2.5 rounded-2xl active:scale-95 transition-transform">
          🔧 Mütəxəssis ol
        </Link>
        <Link to="/elanlar" className="bg-gray-100 text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-2xl active:scale-95 transition-transform">
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
  const [showFilter, setShowFilter] = useState(false)

  const yukle = useCallback(async (q, kat, sh, sort) => {
    setLoading(true)
    let query = supabase.from('mutexessis_hesablari')
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
    <div className="bg-[#F2F4F7] min-h-screen pb-28">

      {/* Header */}
      <div className="bg-[#185FA5] pt-12 pb-5 px-4">
        <h1 className="text-white font-bold text-xl mb-4">Mütəxəssislər</h1>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            className="w-full bg-white rounded-2xl pl-10 pr-12 py-3.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 shadow-lg"
            placeholder="Ad, kateqoriya axtar..."
            value={axtaris}
            onChange={e => setAxtaris(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && axtar()}
          />
          <button onClick={() => setShowFilter(!showFilter)}
            className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-colors ${showFilter ? 'bg-[#185FA5] text-white' : 'bg-gray-100 text-gray-500'}`}>
            ⚙️
          </button>
        </div>
      </div>

      <div className="px-4 mt-4">

        {/* Kateqoriya chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
          {KATEQORIYALAR.map(k => (
            <button key={k}
              onClick={() => filterDeyis(k, seher, sortBy)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 shrink-0 ${kateqoriya === k ? 'bg-[#185FA5] text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200'}`}>
              {k}
            </button>
          ))}
        </div>

        {/* Filter panel */}
        {showFilter && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Şəhər</label>
                <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                  value={seher} onChange={e => filterDeyis(kateqoriya, e.target.value, sortBy)}>
                  {['Hamısı','Bakı','Gəncə','Sumqayıt','Mingəçevir','Lənkəran'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Sıralama</label>
                <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                  value={sortBy} onChange={e => filterDeyis(kateqoriya, seher, e.target.value)}>
                  <option value="rating">⭐ Reytinq</option>
                  <option value="reviews">💬 Rəy sayı</option>
                  <option value="price_asc">💰 Ucuz əvvəl</option>
                  <option value="price_desc">💰 Baha əvvəl</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Nəticə sayı */}
        {!loading && (
          <p className="text-xs text-gray-400 mb-3 font-medium">
            {list.length} mütəxəssis tapıldı
          </p>
        )}

        {/* Siyahı */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100">
            <EmptyState kateqoriya={kateqoriya} axtaris={axtaris} />
          </div>
        ) : (
          <div className="space-y-3">
            {list.map(m => (
              <Link key={m.id} to={`/mutexessis/${m.id}`}
                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:scale-[0.98] transition-transform block">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#185FA5] font-bold text-lg shrink-0">
                    {m.hesablar?.full_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-gray-800 text-sm truncate">{m.hesablar?.full_name}</span>
                      {m.is_verified && <span className="text-green-500 text-xs shrink-0">✅</span>}
                    </div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">{m.category} · {m.hesablar?.city}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-yellow-400 text-xs">{'★'.repeat(Math.round(m.rating || 0))}{'☆'.repeat(5 - Math.round(m.rating || 0))}</span>
                      <span className="text-xs text-gray-400">({m.review_count})</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-[#185FA5]">{m.start_price}</div>
                    <div className="text-xs text-gray-400">AZN</div>
                    <div className="text-xs text-gray-300 mt-1">→</div>
                  </div>
                </div>
                {m.bio && <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mt-3 pt-3 border-t border-gray-50">{m.bio}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
