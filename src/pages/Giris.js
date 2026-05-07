import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Giris() {
  const [form, setForm] = useState({ email: '', sifre: '' })
  const [rol, setRol] = useState('musteri')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const daxilOl = async () => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.sifre })
    if (error) { setError('E-poçt və ya şifrə yanlışdır'); setLoading(false); return }
    navigate('/dashboard')
  }

  return (
    <div className="form-wrap">
      <Link to="/" className="form-logo">Axtar<span style={{ color: '#E24B4A' }}>.</span>xyz</Link>
      <p className="form-subtitle">Hesabınıza daxil olun</p>
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
        <div className="form-group">
          <label className="form-label">E-poçt</label>
          <input className="form-input" type="email" placeholder="email@mail.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Şifrə</label>
          <input className="form-input" type="password" placeholder="••••••••" value={form.sifre} onChange={e => setForm({ ...form, sifre: e.target.value })} onKeyDown={e => e.key === 'Enter' && daxilOl()} />
        </div>
        <button onClick={daxilOl} className="form-btn" disabled={loading}>{loading ? 'Gözləyin...' : 'Daxil ol'}</button>
      </div>
      <p className="form-switch">Hesabınız yoxdur? <Link to="/qeydiyyat">Qeydiyyat</Link></p>
    </div>
  )
}
