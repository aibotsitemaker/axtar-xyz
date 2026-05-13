import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const KATEQORIYALAR = ['Santexnik','Elektrik','Təmizlik','Rəssam','Gözəllik','Kompüter','Avtomobil','Köçürmə','Digər']
const SEHIRLER = ['Bakı','Gəncə','Sumqayıt','Mingəçevir','Lənkəran','Şirvan','Digər']

export default function Qeydiyyat() {
  const [rol, setRol] = useState('musteri')
  const [form, setForm] = useState({ ad:'',soyad:'',email:'',telefon:'',seher:'Bakı',sifre:'',sifre2:'',kateqoriya:'Santexnik',tecrube:'1-3 il',bio:'',qiymet:'' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const qeydiyyat = async () => {
    if (form.sifre !== form.sifre2) { setError('Şifrələr uyğun gəlmir'); return }
    if (!form.ad || !form.email || !form.sifre) { setError('Məcburi sahələri doldurun'); return }
    if (form.sifre.length < 6) { setError('Şifrə minimum 6 simvol olmalıdır'); return }
    setLoading(true); setError('')
    const { data, error: authError } = await supabase.auth.signUp({ email: form.email, password: form.sifre })
    if (authError) { setError(authError.message); setLoading(false); return }
    const userId = data.user.id
    await supabase.from('hesablar').insert({ id: userId, full_name: `${form.ad} ${form.soyad}`.trim(), phone: form.telefon, city: form.seher, role: rol })
    if (rol === 'mutexessis') {
      await supabase.from('mutexessis_hesablari').insert({ user_id: userId, category: form.kateqoriya, experience_years: parseInt(form.tecrube) || 1, bio: form.bio, start_price: parseFloat(form.qiymet) || 0 })
    }
    window.location.href = '/dashboard'
  }

  const googleIleQeydiyyat = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://www.axtar.xyz/dashboard' } })
  }

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-1 text-2xl font-bold">
            <span className="text-primary-600">Axtar</span><span className="text-accent-500">.</span><span className="text-primary-600">xyz</span>
          </Link>
          <p className="text-gray-500 mt-2 text-sm">Yeni hesab yaradın</p>
        </div>

        {/* Rol seçimi */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[['musteri','👤','Müştəri','Xidmət axtarıram'],['mutexessis','🔧','Mütəxəssis','Xidmət göstərirəm']].map(([r,ikon,ad,desc]) => (
            <button key={r} onClick={() => setRol(r)} className={`p-4 rounded-2xl border-2 text-center transition-all ${rol === r ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
              <div className="text-2xl mb-1.5">{ikon}</div>
              <div className="font-semibold text-sm text-gray-800">{ad}</div>
              <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
            </button>
          ))}
        </div>

        <div className="card p-6 shadow-sm">
          {error && <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}

          {rol === 'musteri' && (
            <>
              <button onClick={googleIleQeydiyyat} className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 mb-4">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google ilə qeydiyyat
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-100" /><span className="text-xs text-gray-400">və ya email ilə</span><div className="flex-1 h-px bg-gray-100" />
              </div>
            </>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Ad *</label><input className="input" placeholder="Adınız" value={form.ad} onChange={e => f('ad', e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Soyad</label><input className="input" placeholder="Soyadınız" value={form.soyad} onChange={e => f('soyad', e.target.value)} /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">E-poçt *</label><input className="input" type="email" placeholder="email@mail.com" value={form.email} onChange={e => f('email', e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Telefon</label><input className="input" placeholder="+994 50 000 00 00" value={form.telefon} onChange={e => f('telefon', e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Şəhər</label>
              <select className="input" value={form.seher} onChange={e => f('seher', e.target.value)}>
                {SEHIRLER.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            {rol === 'mutexessis' && (
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <p className="text-sm font-semibold text-gray-700">Peşəkar məlumatlar</p>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Kateqoriya</label>
                  <select className="input" value={form.kateqoriya} onChange={e => f('kateqoriya', e.target.value)}>
                    {KATEQORIYALAR.map(k => <option key={k}>{k}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Təcrübə</label>
                  <select className="input" value={form.tecrube} onChange={e => f('tecrube', e.target.value)}>
                    {['1 ildən az','1-3 il','3-5 il','5-10 il','10 ildən çox'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Özünüz haqqında</label>
                  <textarea className="input resize-none" rows={3} placeholder="Xidmətləriniz haqqında yazın..." value={form.bio} onChange={e => f('bio', e.target.value)} />
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Başlanğıc qiymət (AZN)</label>
                  <input className="input" type="number" placeholder="məs: 15" value={form.qiymet} onChange={e => f('qiymet', e.target.value)} />
                </div>
              </div>
            )}

            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Şifrə *</label><input className="input" type="password" placeholder="Minimum 6 simvol" value={form.sifre} onChange={e => f('sifre', e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Şifrəni təsdiqlə *</label><input className="input" type="password" placeholder="Şifrəni təkrar daxil edin" value={form.sifre2} onChange={e => f('sifre2', e.target.value)} /></div>
            </div>
          </div>

          <button onClick={qeydiyyat} disabled={loading} className="w-full btn-primary justify-center mt-5 py-3 text-sm font-semibold">
            {loading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Gözləyin...</span> : 'Qeydiyyatdan keç'}
          </button>
        </div>
        <p className="text-center text-sm text-gray-500 mt-4">Artıq hesabınız var? <Link to="/giris" className="text-primary-600 font-medium hover:underline">Daxil olun</Link></p>
      </div>
    </div>
  )
}
