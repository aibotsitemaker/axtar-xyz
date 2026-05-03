import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const KATEQORIYALAR = ['Hamısı', 'Santexnik', 'Elektrik', 'Təmizlik', 'Rəssam', 'Gözəllik', 'Kompüter', 'Avtomobil', 'Köçürmə', 'Digər']

export default function Elanlar() {
  const [elanlar, setElanlar] = useState([])
  const [loading, setLoading] = useState(true)
  const [kateqoriya, setKateqoriya] = useState('Hamısı')
  const [user, setUser] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', category: 'Santexnik', city: 'Bakı', budget: '' })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    yukle()
  }, [])

  const yukle = async (kat) => {
    setLoading(true)
    let q = supabase.from('elanlar').select('*, hesablar(full_name, city)').eq('status', 'aktiv').order('created_at', { ascending: false })
    if (kat && kat !== 'Hamısı') q = q.eq('category', kat)
    const { data } = await q
    setElanlar(data || [])
    setLoading(false)
  }

  const elanEkle = async () => {
    if (!form.title || !user) return
    const { data: hesab } = await supabase.from('hesablar').select('role').eq('id', user.id).single()
    if (hesab?.role !== 'musteri') { alert('Yalnız müştərilər elan verə bilər'); return }
    await supabase.from('elanlar').insert({ ...form, user_id: user.id, budget: parseFloat(form.budget) || null })
    setShowForm(false)
    setForm({ title: '', description: '', category: 'Santexnik', city: 'Bakı', budget: '' })
    yukle()
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h1 style={s.title}>Elanlar</h1>
        {user ? (
          <button onClick={() => setShowForm(!showForm)} style={s.addBtn}>+ Elan ver</button>
        ) : (
          <Link to="/giris" style={s.addBtn}>Elan vermək üçün daxil ol</Link>
        )}
      </div>

      {showForm && (
        <div style={s.formCard}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>Yeni elan</h3>
          <div style={s.formGroup}><label style={s.label}>Başlıq *</label><input style={s.input} placeholder="məs: Santexnik lazımdır" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div style={s.formGroup}><label style={s.label}>Təsvir</label><textarea style={{ ...s.input, minHeight: 80 }} placeholder="İş haqqında ətraflı yazın..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div style={s.row}>
            <div style={s.formGroup}><label style={s.label}>Kateqoriya</label>
              <select style={s.input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {KATEQORIYALAR.filter(k => k !== 'Hamısı').map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div style={s.formGroup}><label style={s.label}>Şəhər</label>
              <select style={s.input} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}>
                {['Bakı', 'Gəncə', 'Sumqayıt', 'Mingəçevir', 'Digər'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={s.formGroup}><label style={s.label}>Büdcə (AZN)</label><input style={s.input} type="number" placeholder="məs: 50" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={elanEkle} style={s.submitBtn}>Elan ver</button>
            <button onClick={() => setShowForm(false)} style={s.cancelBtn}>Ləğv et</button>
          </div>
        </div>
      )}

      <div style={s.cats}>
        {KATEQORIYALAR.map(k => (
          <span key={k} onClick={() => { setKateqoriya(k); yukle(k) }} style={{ ...s.cat, ...(kateqoriya === k ? s.catActive : {}) }}>{k}</span>
        ))}
      </div>

      {loading ? <div style={s.center}>Yüklənir...</div> :
        elanlar.length === 0 ? <div style={s.center}>Elan tapılmadı</div> :
          <div style={s.grid}>
            {elanlar.map(e => (
              <div key={e.id} style={s.card}>
                <div style={s.catBadge}>{e.category}</div>
                <h3 style={s.cardTitle}>{e.title}</h3>
                {e.description && <p style={s.desc}>{e.description?.slice(0, 120)}{e.description?.length > 120 ? '...' : ''}</p>}
                <div style={s.cardFooter}>
                  <div style={{ fontSize: 13, color: '#888' }}>
                    📍 {e.hesablar?.city || e.city}
                    {e.budget && <span style={{ marginLeft: 12 }}>💰 {e.budget} AZN</span>}
                  </div>
                  {user && <Link to={`/elan/${e.id}`} style={s.btn}>Müraciət et</Link>}
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

const s = {
  wrap: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 700 },
  addBtn: { background: '#185FA5', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', textDecoration: 'none' },
  formCard: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 24, marginBottom: 24 },
  formGroup: { marginBottom: 14 },
  label: { display: 'block', fontSize: 13, color: '#666', marginBottom: 6 },
  input: { width: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  submitBtn: { background: '#185FA5', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  cancelBtn: { background: '#f5f5f5', color: '#555', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  cats: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 },
  cat: { padding: '6px 14px', borderRadius: 20, border: '1px solid #eee', fontSize: 13, cursor: 'pointer', color: '#555', background: '#fff' },
  catActive: { background: '#185FA5', color: '#fff', borderColor: '#185FA5' },
  center: { textAlign: 'center', padding: 60, color: '#888' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 },
  card: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 20 },
  catBadge: { display: 'inline-block', background: '#E6F1FB', color: '#185FA5', fontSize: 12, padding: '3px 10px', borderRadius: 20, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: 600, marginBottom: 8 },
  desc: { fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 14 },
  cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #eee' },
  btn: { background: '#185FA5', color: '#fff', padding: '6px 14px', borderRadius: 8, fontSize: 13, textDecoration: 'none' },
}
