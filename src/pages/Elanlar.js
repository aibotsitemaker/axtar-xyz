import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const KATEQORIYALAR = ['Hamısı','Santexnik','Elektrik','Təmizlik','Rəssam','Gözəllik','Kompüter','Avtomobil','Köçürmə','Digər']

export default function Elanlar() {
  const [elanlar, setElanlar] = useState([])
  const [loading, setLoading] = useState(true)
  const [kateqoriya, setKateqoriya] = useState('Hamısı')
  const [user, setUser] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title:'',description:'',category:'Santexnik',city:'Bakı',budget:'' })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    yukle()
  }, [])

  const yukle = async (kat) => {
    setLoading(true)
    let q = supabase.from('elanlar').select('*, hesablar(full_name, city)').eq('status','aktiv').order('created_at',{ ascending:false })
    if (kat && kat !== 'Hamısı') q = q.eq('category', kat)
    const { data } = await q
    setElanlar(data || [])
    setLoading(false)
  }

  const elanEkle = async () => {
    if (!form.title || !user) return
    await supabase.from('elanlar').insert({ ...form, user_id: user.id, budget: parseFloat(form.budget) || null })
    setShowForm(false)
    setForm({ title:'',description:'',category:'Santexnik',city:'Bakı',budget:'' })
    yukle()
  }

  return (
    <div className="page-wrap">
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12 }}>
        <h1 className="page-title" style={{ margin:0 }}>Elanlar</h1>
        {user ? (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ padding:'10px 20px',fontSize:14 }}>+ Elan ver</button>
        ) : (
          <Link to="/giris" className="btn-primary" style={{ padding:'10px 20px',fontSize:14 }}>Elan üçün daxil ol</Link>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom:24 }}>
          <h3 style={{ marginBottom:16,fontSize:16 }}>Yeni elan</h3>
          <div className="form-group"><label className="form-label">Başlıq *</label><input className="form-input" placeholder="məs: Santexnik lazımdır" value={form.title} onChange={e => setForm({...form,title:e.target.value})} /></div>
          <div className="form-group"><label className="form-label">Təsvir</label><textarea className="form-input" style={{ minHeight:80 }} placeholder="İş haqqında ətraflı yazın..." value={form.description} onChange={e => setForm({...form,description:e.target.value})} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Kateqoriya</label>
              <select className="form-input" value={form.category} onChange={e => setForm({...form,category:e.target.value})}>
                {KATEQORIYALAR.filter(k=>k!=='Hamısı').map(k=><option key={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Şəhər</label>
              <select className="form-input" value={form.city} onChange={e => setForm({...form,city:e.target.value})}>
                {['Bakı','Gəncə','Sumqayıt','Digər'].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Büdcə (AZN)</label><input className="form-input" type="number" placeholder="məs: 50" value={form.budget} onChange={e => setForm({...form,budget:e.target.value})} /></div>
          <div style={{ display:'flex',gap:10 }}>
            <button onClick={elanEkle} className="btn-primary" style={{ padding:'10px 24px' }}>Elan ver</button>
            <button onClick={() => setShowForm(false)} style={{ background:'#f5f5f5',color:'#555',border:'none',padding:'10px 24px',borderRadius:8,cursor:'pointer' }}>Ləğv et</button>
          </div>
        </div>
      )}

      <div className="filter-bar">
        {KATEQORIYALAR.map(k => (
          <span key={k} onClick={() => { setKateqoriya(k); yukle(k) }} className={`filter-tag ${kateqoriya===k?'active':''}`}>{k}</span>
        ))}
      </div>

      {loading ? <div style={{ textAlign:'center',padding:60,color:'#888' }}>Yüklənir...</div> :
        elanlar.length === 0 ? <div style={{ textAlign:'center',padding:60,color:'#888' }}>Elan tapılmadı</div> :
          <div className="cards-grid-3">
            {elanlar.map(e => (
              <div key={e.id} className="card">
                <span style={{ display:'inline-block',background:'#E6F1FB',color:'#185FA5',fontSize:12,padding:'3px 10px',borderRadius:20,marginBottom:10 }}>{e.category}</span>
                <h3 style={{ fontSize:15,fontWeight:600,marginBottom:8 }}>{e.title}</h3>
                {e.description && <p style={{ fontSize:13,color:'#666',lineHeight:1.6,marginBottom:14 }}>{e.description?.slice(0,120)}{e.description?.length>120?'...':''}</p>}
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:12,borderTop:'1px solid #eee' }}>
                  <div style={{ fontSize:13,color:'#888' }}>
                    📍 {e.city}{e.budget && <span style={{ marginLeft:12 }}>💰 {e.budget} AZN</span>}
                  </div>
                  {user && <button className="btn-primary" style={{ fontSize:13 }}>Müraciət</button>}
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}
