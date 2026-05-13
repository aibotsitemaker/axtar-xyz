import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const KATEQORIYALAR = ['Hamısı','Santexnik','Elektrik','Təmizlik','Rəssam','Gözəllik','Kompüter','Avtomobil','Köçürmə','Digər']

export default function Elanlar() {
  const { user } = useAuth()
  const [elanlar, setElanlar] = useState([])
  const [loading, setLoading] = useState(true)
  const [kateqoriya, setKateqoriya] = useState('Hamısı')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'', description:'', category:'Santexnik', city:'Bakı', budget:'' })
  const [muracietModal, setMuracietModal] = useState(null)
  const [muracietForm, setMuracietForm] = useState({ message:'', price_offer:'' })
  const [muracietGonderilib, setMuracietGonderilib] = useState(false)

  useEffect(() => { yukle() }, [])

  const yukle = async (kat) => {
    setLoading(true)
    let q = supabase.from('elanlar').select('*, hesablar(full_name, city)')
      .eq('status', 'aktiv')
      .order('is_featured', { ascending: false })
      .order('is_vip', { ascending: false })
      .order('created_at', { ascending: false })
    if (kat && kat !== 'Hamısı') q = q.eq('category', kat)
    const { data } = await q
    setElanlar(data || [])
    setLoading(false)
  }

  const elanEkle = async () => {
    if (!form.title.trim() || !user) return
    await supabase.from('elanlar').insert({ ...form, user_id: user.id, budget: parseFloat(form.budget) || null })
    setShowForm(false)
    setForm({ title:'', description:'', category:'Santexnik', city:'Bakı', budget:'' })
    yukle(kateqoriya)
  }

  const muracietGonder = async () => {
    if (!muracietForm.message.trim()) return
    await supabase.from('muracietler').insert({ elan_id: muracietModal.id, mutexessis_id: user.id, message: muracietForm.message, price_offer: parseFloat(muracietForm.price_offer) || null })
    await supabase.from('bildirisler').insert({ user_id: muracietModal.user_id, tip: 'muraciet', metn: `"${muracietModal.title}" elanınıza yeni müraciət var`, link: '/dashboard' })
    setMuracietGonderilib(true)
  }

  const modalBag = () => { setMuracietModal(null); setMuracietForm({ message:'', price_offer:'' }); setMuracietGonderilib(false) }

  return (
    <div className="page-wrap">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Elanlar</h1>
        {user ? (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">+ Elan ver</button>
        ) : (
          <Link to="/giris" className="btn-primary">Elan üçün daxil ol</Link>
        )}
      </div>

      {showForm && (
        <div className="card p-5 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">Yeni elan</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Başlıq *</label>
              <input className="input" placeholder="məs: Santexnik lazımdır" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Təsvir</label>
              <textarea className="input resize-none" rows={3} placeholder="İş haqqında ətraflı yazın..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Kateqoriya</label>
                <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {KATEQORIYALAR.filter(k => k !== 'Hamısı').map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Şəhər</label>
                <select className="input" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}>
                  {['Bakı','Gəncə','Sumqayıt','Mingəçevir','Digər'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Büdcə (AZN)</label>
              <input className="input" type="number" placeholder="məs: 50" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={elanEkle} className="btn-primary">Elan ver</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Ləğv et</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap mb-6">
        {KATEQORIYALAR.map(k => (
          <button key={k} onClick={() => { setKateqoriya(k); yukle(k) }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${kateqoriya === k ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'}`}>
            {k}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Yüklənir...</div>
      ) : elanlar.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-500">Elan tapılmadı</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {elanlar.map(e => (
            <div key={e.id} className={`card p-5 relative ${e.is_vip ? 'border-yellow-300 border-2' : e.is_featured ? 'border-primary-300 border-2' : ''}`}>
              {e.is_vip && <span className="absolute -top-2.5 right-3 badge bg-yellow-400 text-white text-xs font-bold shadow">⭐ VIP</span>}
              {e.is_featured && !e.is_vip && <span className="absolute -top-2.5 right-3 badge bg-primary-600 text-white text-xs font-bold shadow">🔝 Öndə</span>}
              <span className="badge bg-primary-50 text-primary-600 mb-3 block w-fit">{e.category}</span>
              <h3 className="font-semibold text-gray-800 text-sm mb-2">{e.title}</h3>
              {e.description && <p className="text-xs text-gray-500 leading-relaxed mb-4 line-clamp-2">{e.description}</p>}
              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div className="text-xs text-gray-500">
                  📍 {e.city || e.hesablar?.city}
                  {e.budget && <span className="ml-2">💰 {e.budget} AZN</span>}
                </div>
                {user && e.user_id !== user.id && (
                  <button onClick={() => setMuracietModal(e)} className="btn-primary text-xs py-1.5 px-3">Müraciət et</button>
                )}
                {!user && <Link to="/giris" className="btn-primary text-xs py-1.5 px-3">Müraciət et</Link>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Müraciət modal */}
      {muracietModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && modalBag()}>
          <div className="card p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-800">Müraciət et</h3>
                <p className="text-xs text-gray-500 mt-0.5">Elan: {muracietModal.title}</p>
              </div>
              <button onClick={modalBag} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            {muracietGonderilib ? (
              <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-4 text-sm text-center">
                ✅ Müraciətiniz göndərildi! Müştəri sizinlə əlaqə saxlayacaq.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mesajınız *</label>
                  <textarea className="input resize-none" rows={4} placeholder="Özünüz haqqında yazın, nə zaman başlaya bilərsiniz..." value={muracietForm.message} onChange={e => setMuracietForm(p => ({ ...p, message: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Təklif etdiyiniz qiymət (AZN)</label>
                  <input className="input" type="number" placeholder="məs: 40" value={muracietForm.price_offer} onChange={e => setMuracietForm(p => ({ ...p, price_offer: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={muracietGonder} className="btn-primary flex-1 justify-center py-3">Göndər</button>
                  <button onClick={modalBag} className="btn-secondary flex-1 justify-center py-3">Ləğv et</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
