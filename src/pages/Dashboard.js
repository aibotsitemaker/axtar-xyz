import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [hesab, setHesab] = useState(null)
  const [mutexessis, setMutexessis] = useState(null)
  const [elanlar, setElanlar] = useState([])
  const [mesajlar, setMesajlar] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const yukle = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/giris'); return }
      const { data: h } = await supabase.from('hesablar').select('*').eq('id', user.id).single()
      setHesab(h)
      if (h?.role === 'mutexessis') {
        const { data: m } = await supabase.from('mutexessis_hesablari').select('*').eq('user_id', user.id).single()
        setMutexessis(m)
      } else {
        const { data: e } = await supabase.from('elanlar').select('*').eq('user_id', user.id).order('created_at',{ ascending:false })
        setElanlar(e || [])
      }
      const { data: msg } = await supabase.from('mesajlar')
        .select('*, sender:sender_id(full_name)')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at',{ ascending:false }).limit(10)
      setMesajlar(msg || [])
      setLoading(false)
    }
    yukle()
  }, [navigate])

  if (loading) return <div style={{ textAlign:'center',padding:80,color:'#888' }}>Yüklənir...</div>

  return (
    <div className="page-wrap">
      <div className="dash-header">
        <div>
          <h1 style={{ fontSize:24,fontWeight:700,marginBottom:4 }}>Salam, {hesab?.full_name?.split(' ')[0]}! 👋</h1>
          <p style={{ fontSize:14,color:'#888' }}>{hesab?.role==='mutexessis'?'Mütəxəssis paneli':'Müştəri paneli'}</p>
        </div>
        <span style={{ background:'#E6F1FB',color:'#185FA5',padding:'6px 14px',borderRadius:20,fontSize:13,fontWeight:500 }}>
          {hesab?.role==='mutexessis'?'🔧 Mütəxəssis':'👤 Müştəri'}
        </span>
      </div>

      <div className="dashboard-grid">
        <div>
          {hesab?.role==='mutexessis' && mutexessis && (
            <div className="card" style={{ marginBottom:16 }}>
              <h2 style={{ fontSize:16,fontWeight:600,marginBottom:14 }}>Profilim</h2>
              {[['Kateqoriya',mutexessis.category],['Qiymət',`${mutexessis.start_price} AZN-dən`],['Reytinq',`${'★'.repeat(Math.round(mutexessis.rating||0))} ${mutexessis.rating?.toFixed(1)}`],['Rəylər',`${mutexessis.review_count} rəy`]].map(([l,v]) => (
                <div key={l} style={{ display:'flex',justifyContent:'space-between',fontSize:14,paddingBottom:10,marginBottom:10,borderBottom:'1px solid #f5f5f5' }}>
                  <span style={{ color:'#888' }}>{l}</span><span>{v}</span>
                </div>
              ))}
              <Link to={`/mutexessis/${mutexessis.id}`} className="btn-primary" style={{ display:'block',textAlign:'center',padding:'9px 16px',marginTop:14 }}>Profilə bax</Link>
            </div>
          )}

          {hesab?.role==='musteri' && (
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
                <h2 style={{ fontSize:16,fontWeight:600 }}>Elanlarım ({elanlar.length})</h2>
                <Link to="/elanlar" className="btn-primary" style={{ fontSize:12,padding:'5px 12px' }}>+ Yeni</Link>
              </div>
              {elanlar.length===0 ? <p style={{ fontSize:13,color:'#aaa',textAlign:'center',padding:'20px 0' }}>Hələ elan verməmisiniz</p> :
                elanlar.map(e => (
                  <div key={e.id} style={{ border:'1px solid #eee',borderRadius:8,padding:12,marginBottom:10 }}>
                    <div style={{ fontSize:14,fontWeight:500 }}>{e.title}</div>
                    <div style={{ display:'flex',gap:8,marginTop:6 }}>
                      <span style={{ background:'#E6F1FB',color:'#185FA5',fontSize:11,padding:'2px 8px',borderRadius:20 }}>{e.category}</span>
                      <span style={{ background: e.status==='aktiv'?'#EAF3DE':'#FEE',color:e.status==='aktiv'?'#2E7D32':'#C00',fontSize:11,padding:'2px 8px',borderRadius:20 }}>{e.status}</span>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          <div className="card">
            <h2 style={{ fontSize:16,fontWeight:600,marginBottom:14 }}>Hesab məlumatları</h2>
            {[['Ad',hesab?.full_name],['Telefon',hesab?.phone||'—'],['Şəhər',hesab?.city]].map(([l,v]) => (
              <div key={l} style={{ display:'flex',justifyContent:'space-between',fontSize:14,paddingBottom:10,marginBottom:10,borderBottom:'1px solid #f5f5f5' }}>
                <span style={{ color:'#888' }}>{l}</span><span>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize:16,fontWeight:600,marginBottom:14 }}>Mesajlar ({mesajlar.length})</h2>
          {mesajlar.length===0 ? <p style={{ fontSize:13,color:'#aaa',textAlign:'center',padding:'20px 0' }}>Hələ mesaj yoxdur</p> :
            mesajlar.map(m => (
              <div key={m.id} style={{ border:'1px solid #eee',borderRadius:8,padding:12,marginBottom:10 }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                  <strong style={{ fontSize:13 }}>{m.sender?.full_name}</strong>
                  <span style={{ fontSize:11,color:'#aaa' }}>{new Date(m.created_at).toLocaleDateString('az')}</span>
                </div>
                <p style={{ fontSize:13,color:'#555' }}>{m.content}</p>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
