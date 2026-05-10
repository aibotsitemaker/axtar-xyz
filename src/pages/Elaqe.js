import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Elaqe() {
  const [form, setForm] = useState({ ad: '', email: '', mesaj: '' })
  const [gonderildi, setGonderildi] = useState(false)

  const gonder = () => {
    if (!form.ad || !form.email || !form.mesaj) return
    setGonderildi(true)
  }

  return (
    <div className="page-wrap" style={{ maxWidth: 800 }}>
      <Link to="/" style={{ color: '#185FA5', textDecoration: 'none', fontSize: 14 }}>← Ana səhifə</Link>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: '20px 0 8px' }}>Əlaqə</h1>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 32 }}>Suallarınız üçün bizimlə əlaqə saxlayın</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* Sol - məlumatlar */}
        <div>
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Əlaqə məlumatları</h3>
            {[
              ['📧', 'E-poçt', 'elielizade17@gmail.com'],
              ['🌐', 'Sayt', 'axtar.xyz'],
              ['📍', 'Ölkə', 'Azərbaycan, Bakı'],
            ].map(([ikon, label, val]) => (
              <div key={label} style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20 }}>{ikon}</span>
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{val}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: '#E6F1FB', border: '1px solid #B5D4F4', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#185FA5', marginBottom: 8 }}>İş saatları</h3>
            <p style={{ fontSize: 13, color: '#444', lineHeight: 1.7 }}>
              Bazar ertəsi – Cümə: 09:00 – 18:00<br />
              Şənbə: 10:00 – 15:00<br />
              Bazar: İstirahət
            </p>
          </div>
        </div>

        {/* Sağ - form */}
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Mesaj göndər</h3>
          {gonderildi ? (
            <div style={{ background: '#EAF3DE', color: '#2E7D32', padding: '16px', borderRadius: 8, textAlign: 'center' }}>
              ✅ Mesajınız göndərildi! Tezliklə cavab verəcəyik.
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Adınız *</label>
                <input className="form-input" placeholder="Adınız" value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">E-poçt *</label>
                <input className="form-input" type="email" placeholder="email@mail.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Mesaj *</label>
                <textarea className="form-input" style={{ minHeight: 120, resize: 'vertical' }} placeholder="Mesajınızı yazın..." value={form.mesaj} onChange={e => setForm({ ...form, mesaj: e.target.value })} />
              </div>
              <button onClick={gonder} className="form-btn">Göndər</button>
            </>
          )}
        </div>
      </div>

      {/* SSS */}
      <div style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Tez-tez verilən suallar</h2>
        {[
          ['Axtar.xyz-də qeydiyyat pulsuzdurmu?', 'Bəli, müştəri qeydiyyatı tamamilə pulsuzdur. Mütəxəssislər üçün də başlanğıc qeydiyyat pulsuzdur.'],
          ['Mütəxəssis kimi necə qeydiyyatdan keçə bilərəm?', 'Saytda "Qeydiyyat" düyməsinə basın, "Mütəxəssis" seçin və lazımi məlumatları daxil edin.'],
          ['Müştərilərlə əlaqə necə qurulur?', 'Müştərilər mütəxəssis profilinə baxıb birbaşa mesaj göndərə və ya telefon nömrəsi ilə əlaqə saxlaya bilər.'],
          ['Saytda elan vermək pulsuzdurmu?', 'Hazırda bütün elanlar pulsuzdur. Gələcəkdə premium elan seçimləri əlavə ediləcək.'],
        ].map(([s, c]) => (
          <div key={s} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: 18, marginBottom: 10 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#185FA5' }}>❓ {s}</h4>
            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7 }}>{c}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
