import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const KATEQORIYALAR = ['Santexnik','Elektrik','Təmizlik','Rəssam','Gözəllik','Kompüter','Avtomobil','Köçürmə','Digər']
const SEHIRLER = ['Bakı','Gəncə','Sumqayıt','Mingəçevir','Lənkəran','Şirvan','Digər']

export default function Qeydiyyat() {
  const [rol, setRol] = useState('musteri')
  const [form, setForm] = useState({ ad:'',soyad:'',email:'',telefon:'',seher:'Bakı',sifre:'',sifre2:'',kateqoriya:'Santexnik',tecrube:'1-3 il',bio:'',qiymet:'' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const qeydiyyat = async () => {
    if (form.sifre !== form.sifre2) { setError('Şifrələr uyğun gəlmir'); return }
    if (!form.ad || !form.email || !form.sifre) { setError('Bütün məcburi sahələri doldurun'); return }
    setLoading(true); setError('')
    const { data, error: authError } = await supabase.auth.signUp({ email: form.email, password: form.sifre })
    if (authError) { setError(authError.message); setLoading(false); return }
    const userId = data.user.id
    await supabase.from('hesablar').insert({ id: userId, full_name: `${form.ad} ${form.soyad}`.trim(), phone: form.telefon, city: form.seher, role: rol })
    if (rol === 'mutexessis') {
      await supabase.from('mutexessis_hesablari').insert({ user_id: userId, category: form.kateqoriya, experience_years: parseInt(form.tecrube), bio: form.bio, start_price: parseFloat(form.qiymet) || 0 })
    }
    navigate('/dashboard')
  }

  const googleIleQeydiyyat = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://www.axtar.xyz/dashboard' }
    })
  }

  return (
    <div className="form-wrap">
      <Link to="/" className="form-logo">Axtar<span style={{ color: '#E24B4A' }}>.</span>xyz</Link>
      <p className="form-subtitle">Yeni hesab yaradın</p>
      <div className="role-tabs">
        {[['musteri','👤','Müştəri','Xidmət axtarıram'],['mutexessis','🔧','Mütəxəssis','Xidmət göstərirəm']].map(([r,ikon,ad,desc]) => (
          <div key={r} onClick={() => setRol(r)} className={`role-tab ${rol === r ? 'active' : ''}`}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{ikon}</div>
            <div style={{ fontWeight: 500 }}>{ad}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{desc}</div>
          </div>
        ))}
      </div>
      <div className="form-card">
        {error && <div className="form-error">{error}</div>}

        {rol === 'musteri' && (
          <>
            <button onClick={googleIleQeydiyyat} style={{ width: '100%', background: '#fff', border: '1px solid #ddd', padding: '11px', borderRadius: 8, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'inherit', marginBottom: 16 }}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google ilə qeydiyyat
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: '#eee' }} />
              <span style={{ fontSize: 13, color: '#aaa' }}>və ya email ilə</span>
              <div style={{ flex: 1, height: 1, background: '#eee' }} />
            </div>
          </>
        )}

        <div className="form-row">
          <div className="form-group"><label className="form-label">Ad *</label><input className="form-input" placeholder="Adınız" value={form.ad} onChange={e => setForm({...form,ad:e.target.value})} /></div>
          <div className="form-group"><label className="form-label">Soyad</label><input className="form-input" placeholder="Soyadınız" value={form.soyad} onChange={e => setForm({...form,soyad:e.target.value})} /></div>
        </div>
        <div className="form-group"><label className="form-label">E-poçt *</label><input className="form-input" type="email" placeholder="email@mail.com" value={form.email} onChange={e => setForm({...form,email:e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" placeholder="+994 50 000 00 00" value={form.telefon} onChange={e => setForm({...form,telefon:e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Şəhər</label>
          <select className="form-input" value={form.seher} onChange={e => setForm({...form,seher:e.target.value})}>
            {SEHIRLER.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        {rol === 'mutexessis' && <>
          <hr style={{ border:'none',borderTop:'1px solid #eee',margin:'8px 0 16px' }} />
          <div className="form-group"><label className="form-label">Kateqoriya</label>
            <select className="form-input" value={form.kateqoriya} onChange={e => setForm({...form,kateqoriya:e.target.value})}>
              {KATEQORIYALAR.map(k => <option key={k}>{k}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Təcrübə</label>
            <select className="form-input" value={form.tecrube} onChange={e => setForm({...form,tecrube:e.target.value})}>
              {['1 ildən az','1-3 il','3-5 il','5-10 il','10 ildən çox'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Özünüz haqqında</label>
            <textarea className="form-input" style={{ minHeight:80,resize:'vertical' }} placeholder="Xidmətləriniz haqqında yazın..." value={form.bio} onChange={e => setForm({...form,bio:e.target.value})} />
          </div>
          <div className="form-group"><label className="form-label">Başlanğıc qiymət (AZN)</label>
            <input className="form-input" type="number" placeholder="məs: 15" value={form.qiymet} onChange={e => setForm({...form,qiymet:e.target.value})} />
          </div>
          <hr style={{ border:'none',borderTop:'1px solid #eee',margin:'8px 0 16px' }} />
        </>}
        <div className="form-group"><label className="form-label">Şifrə *</label><input className="form-input" type="password" placeholder="Minimum 8 simvol" value={form.sifre} onChange={e => setForm({...form,sifre:e.target.value})} /></div>
        <div className="form-group"><label className="form-label">Şifrəni təsdiqlə *</label><input className="form-input" type="password" placeholder="Şifrəni təkrar daxil edin" value={form.sifre2} onChange={e => setForm({...form,sifre2:e.target.value})} /></div>
        <button onClick={qeydiyyat} className="form-btn" disabled={loading}>{loading ? 'Gözləyin...' : 'Qeydiyyatdan keç'}</button>
      </div>
      <p className="form-switch">Artıq hesabınız var? <Link to="/giris">Daxil olun</Link></p>
    </div>
  )
}
