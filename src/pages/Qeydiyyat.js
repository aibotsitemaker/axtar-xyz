import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const KATEQORIYALAR = ['Santexnik', 'Elektrik', 'Təmizlik', 'Rəssam', 'Gözəllik', 'Kompüter', 'Avtomobil', 'Köçürmə', 'Digər']
const SEHIRLER = ['Bakı', 'Gəncə', 'Sumqayıt', 'Mingəçevir', 'Lənkəran', 'Şirvan', 'Digər']

export default function Qeydiyyat() {
  const [rol, setRol] = useState('musteri')
  const [form, setForm] = useState({ ad: '', soyad: '', email: '', telefon: '', seher: 'Bakı', sifre: '', sifre2: '', kateqoriya: 'Santexnik', tecrube: '1-3 il', bio: '', qiymet: '' })
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

  return (
    <div style={s.wrap}>
      <Link to="/" style={s.logo}>Axtar<span style={{ color: '#E24B4A' }}>.</span>xyz</Link>
      <p style={s.subtitle}>Yeni hesab yaradın</p>
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
        <div style={s.row}>
          <div style={s.formGroup}><label style={s.label}>Ad *</label><input style={s.input} placeholder="Adınız" value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} /></div>
          <div style={s.formGroup}><label style={s.label}>Soyad</label><input style={s.input} placeholder="Soyadınız" value={form.soyad} onChange={e => setForm({ ...form, soyad: e.target.value })} /></div>
        </div>
        <div style={s.formGroup}><label style={s.label}>E-poçt *</label><input style={s.input} type="email" placeholder="email@mail.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div style={s.formGroup}><label style={s.label}>Telefon</label><input style={s.input} placeholder="+994 50 000 00 00" value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} /></div>
        <div style={s.formGroup}><label style={s.label}>Şəhər</label>
          <select style={s.input} value={form.seher} onChange={e => setForm({ ...form, seher: e.target.value })}>
            {SEHIRLER.map(sh => <option key={sh}>{sh}</option>)}
          </select>
        </div>
        {rol === 'mutexessis' && <>
          <hr style={s.hr} />
          <div style={s.formGroup}><label style={s.label}>Kateqoriya</label>
            <select style={s.input} value={form.kateqoriya} onChange={e => setForm({ ...form, kateqoriya: e.target.value })}>
              {KATEQORIYALAR.map(k => <option key={k}>{k}</option>)}
            </select>
          </div>
          <div style={s.formGroup}><label style={s.label}>Təcrübə</label>
            <select style={s.input} value={form.tecrube} onChange={e => setForm({ ...form, tecrube: e.target.value })}>
              {['1 ildən az', '1-3 il', '3-5 il', '5-10 il', '10 ildən çox'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={s.formGroup}><label style={s.label}>Özünüz haqqında</label>
            <textarea style={{ ...s.input, minHeight: 80, resize: 'vertical' }} placeholder="Xidmətləriniz, təcrübəniz haqqında yazın..." value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
          </div>
          <div style={s.formGroup}><label style={s.label}>Başlanğıc qiymət (AZN)</label>
            <input style={s.input} type="number" placeholder="məs: 15" value={form.qiymet} onChange={e => setForm({ ...form, qiymet: e.target.value })} />
          </div>
          <hr style={s.hr} />
        </>}
        <div style={s.formGroup}><label style={s.label}>Şifrə *</label><input style={s.input} type="password" placeholder="Minimum 8 simvol" value={form.sifre} onChange={e => setForm({ ...form, sifre: e.target.value })} /></div>
        <div style={s.formGroup}><label style={s.label}>Şifrəni təsdiqlə *</label><input style={s.input} type="password" placeholder="Şifrəni təkrar daxil edin" value={form.sifre2} onChange={e => setForm({ ...form, sifre2: e.target.value })} /></div>
        <button onClick={qeydiyyat} style={s.btn} disabled={loading}>{loading ? 'Gözləyin...' : 'Qeydiyyatdan keç'}</button>
      </div>
      <p style={s.switchText}>Artıq hesabınız var? <Link to="/giris" style={s.switchLink}>Daxil olun</Link></p>
    </div>
  )
}

const s = {
  wrap: { maxWidth: 520, margin: '40px auto', padding: '0 16px 60px' },
  logo: { display: 'block', textAlign: 'center', fontWeight: 700, fontSize: 24, color: '#185FA5', textDecoration: 'none', marginBottom: 8 },
  subtitle: { textAlign: 'center', color: '#888', fontSize: 14, marginBottom: 24 },
  roleTabs: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 },
  roleTab: { padding: 14, borderRadius: 12, border: '1.5px solid #eee', cursor: 'pointer', textAlign: 'center', background: '#fff' },
  roleTabActive: { borderColor: '#185FA5', background: '#E6F1FB' },
  card: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 24 },
  error: { background: '#FEE', color: '#C00', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  formGroup: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, color: '#666', marginBottom: 6 },
  input: { width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  hr: { border: 'none', borderTop: '1px solid #eee', margin: '8px 0 16px' },
  btn: { width: '100%', background: '#185FA5', color: '#fff', border: 'none', padding: 12, borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: 'pointer', marginTop: 8 },
  switchText: { textAlign: 'center', fontSize: 13, color: '#888', marginTop: 16 },
  switchLink: { color: '#185FA5', textDecoration: 'none' },
}
