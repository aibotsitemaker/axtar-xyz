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
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.sifre })
    if (error) { setError('E-poçt və ya şifrə yanlışdır'); setLoading(false); return }
    navigate('/dashboard')
  }

  return (
    <div style={s.wrap}>
      <Link to="/" style={s.logo}>Axtar<span style={{ color: '#E24B4A' }}>.</span>xyz</Link>
      <p style={s.subtitle}>Hesabınıza daxil olun</p>
      <div style={s.roleTabs}>
        {[['musteri', '👤', 'Müştəri', 'Xidmət axtarıram'], ['mutexessis', '🔧', 'Mütəxəssis', 'Xidmət göstərirəm']].map(([r, ikon, ad, desc]) => (
          <div key={r} onClick={() => setRol(r)} style={{ ...s.roleTab, ...(rol === r ? s.roleTabActive : {}) }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{ikon}</div>
            <div style={{ fontWeight: 500 }}>{ad}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{desc}</div>
          </div>
        ))}
      </div>
      <div style={s.card}>
        {error && <div style={s.error}>{error}</div>}
        <div style={s.formGroup}>
          <label style={s.label}>E-poçt</label>
          <input style={s.input} type="email" placeholder="email@mail.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div style={s.formGroup}>
          <label style={s.label}>Şifrə</label>
          <input style={s.input} type="password" placeholder="••••••••" value={form.sifre} onChange={e => setForm({ ...form, sifre: e.target.value })} onKeyDown={e => e.key === 'Enter' && daxilOl()} />
        </div>
        <button onClick={daxilOl} style={s.btn} disabled={loading}>{loading ? 'Gözləyin...' : 'Daxil ol'}</button>
      </div>
      <p style={s.switchText}>Hesabınız yoxdur? <Link to="/qeydiyyat" style={s.switchLink}>Qeydiyyat</Link></p>
    </div>
  )
}

const s = {
  wrap: { maxWidth: 480, margin: '40px auto', padding: '0 16px' },
  logo: { display: 'block', textAlign: 'center', fontWeight: 700, fontSize: 24, color: '#185FA5', textDecoration: 'none', marginBottom: 8 },
  subtitle: { textAlign: 'center', color: '#888', fontSize: 14, marginBottom: 24 },
  roleTabs: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 },
  roleTab: { padding: 14, borderRadius: 12, border: '1.5px solid #eee', cursor: 'pointer', textAlign: 'center', background: '#fff' },
  roleTabActive: { borderColor: '#185FA5', background: '#E6F1FB' },
  card: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 24 },
  error: { background: '#FEE', color: '#C00', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 },
  formGroup: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, color: '#666', marginBottom: 6 },
  input: { width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  btn: { width: '100%', background: '#185FA5', color: '#fff', border: 'none', padding: 12, borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: 'pointer', marginTop: 8 },
  switchText: { textAlign: 'center', fontSize: 13, color: '#888', marginTop: 16 },
  switchLink: { color: '#185FA5', textDecoration: 'none' },
}
