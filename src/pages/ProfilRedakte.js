import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const KATEQORIYALAR = ['Santexnik','Elektrik','Təmizlik','Rəssam','Gözəllik','Kompüter','Avtomobil','Köçürmə','Digər']
const SEHIRLER = ['Bakı','Gəncə','Sumqayıt','Mingəçevir','Lənkəran','Şirvan','Digər']
const TECRUBE = ['1 ildən az','1-3 il','3-5 il','5-10 il','10 ildən çox']
const TABS = ['Şəxsi məlumatlar', 'Peşəkar məlumatlar', 'Şifrə', 'Hesab']

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${active ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
      {children}
    </button>
  )
}

function Alert({ type, msg, onClose }) {
  if (!msg) return null
  const s = type === 'success'
    ? 'bg-green-50 border-green-200 text-green-700'
    : 'bg-red-50 border-red-200 text-red-700'
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm mb-4 ${s}`}>
      <span>{type === 'success' ? '✅' : '⚠️'} {msg}</span>
      <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      {children}
    </div>
  )
}

export default function ProfilRedakte() {
  const { user, hesab, loading: authLoading, hesabYukle } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [mutexessis, setMutexessis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState({ type: '', msg: '' })
  const avatarRef = useRef()

  // Formlar
  const [sexsi, setSexsi] = useState({ full_name: '', phone: '', city: 'Bakı' })
  const [pese, setPese] = useState({ category: 'Santexnik', experience_years: '1-3 il', bio: '', start_price: '' })
  const [sifre, setSifre] = useState({ kohne: '', yeni: '', yeni2: '' })
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarYuklenir, setAvatarYuklenir] = useState(false)
  const [sifreGoster, setSifreGoster] = useState({ kohne: false, yeni: false, yeni2: false })

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/giris'); return }
    yukle()
  }, [user, authLoading])

  const yukle = async () => {
    setLoading(true)
    const { data: h } = await supabase.from('hesablar').select('*').eq('id', user.id).single()
    if (h) {
      setSexsi({ full_name: h.full_name || '', phone: h.phone || '', city: h.city || 'Bakı' })
      setAvatarUrl(h.avatar_url)
    }
    if (h?.role === 'mutexessis') {
      const { data: m } = await supabase.from('mutexessis_hesablari').select('*').eq('user_id', user.id).single()
      if (m) {
        setMutexessis(m)
        setPese({ category: m.category || 'Santexnik', experience_years: m.experience_years?.toString() || '1-3 il', bio: m.bio || '', start_price: m.start_price?.toString() || '' })
      }
    }
    setLoading(false)
  }

  const showAlert = (type, msg) => {
    setAlert({ type, msg })
    if (type === 'success') setTimeout(() => setAlert({ type: '', msg: '' }), 4000)
  }

  const sexsiSaxla = async () => {
    if (!sexsi.full_name.trim()) { showAlert('error', 'Ad boş ola bilməz'); return }
    setSaving(true)
    const { error } = await supabase.from('hesablar').update({ full_name: sexsi.full_name.trim(), phone: sexsi.phone.trim(), city: sexsi.city }).eq('id', user.id)
    if (error) showAlert('error', 'Xəta baş verdi: ' + error.message)
    else { showAlert('success', 'Şəxsi məlumatlar uğurla yeniləndi!'); await hesabYukle(user.id) }
    setSaving(false)
  }

  const peseSaxla = async () => {
    if (!pese.start_price || isNaN(pese.start_price)) { showAlert('error', 'Düzgün qiymət daxil edin'); return }
    setSaving(true)
    const data = { category: pese.category, bio: pese.bio.trim(), start_price: parseFloat(pese.start_price), experience_years: parseInt(pese.experience_years) || 1 }
    let error
    if (mutexessis) {
      ({ error } = await supabase.from('mutexessis_hesablari').update(data).eq('user_id', user.id))
    } else {
      ({ error } = await supabase.from('mutexessis_hesablari').insert({ ...data, user_id: user.id }))
    }
    if (error) showAlert('error', 'Xəta baş verdi: ' + error.message)
    else { showAlert('success', 'Peşəkar məlumatlar uğurla yeniləndi!'); yukle() }
    setSaving(false)
  }

  const sifreDeyis = async () => {
    if (!sifre.kohne) { showAlert('error', 'Köhnə şifrəni daxil edin'); return }
    if (sifre.yeni.length < 6) { showAlert('error', 'Yeni şifrə minimum 6 simvol olmalıdır'); return }
    if (sifre.yeni !== sifre.yeni2) { showAlert('error', 'Yeni şifrələr uyğun gəlmir'); return }
    setSaving(true)
    // Köhnə şifrəni yoxla
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: user.email, password: sifre.kohne })
    if (loginError) { showAlert('error', 'Köhnə şifrə yanlışdır'); setSaving(false); return }
    const { error } = await supabase.auth.updateUser({ password: sifre.yeni })
    if (error) showAlert('error', 'Xəta baş verdi: ' + error.message)
    else { showAlert('success', 'Şifrə uğurla dəyişdirildi!'); setSifre({ kohne: '', yeni: '', yeni2: '' }) }
    setSaving(false)
  }

  const avatarYukle = async (e) => {
    const fayl = e.target.files[0]
    if (!fayl) return
    if (fayl.size > 2 * 1024 * 1024) { showAlert('error', 'Şəkil 2MB-dan böyük ola bilməz'); return }
    setAvatarYuklenir(true)
    const faylAdi = `avatars/${user.id}_${Date.now()}.${fayl.name.split('.').pop()}`
    const { error: uploadError } = await supabase.storage.from('portfolio').upload(faylAdi, fayl, { upsert: true })
    if (uploadError) { showAlert('error', 'Şəkil yüklənmədi'); setAvatarYuklenir(false); return }
    const { data: urlData } = supabase.storage.from('portfolio').getPublicUrl(faylAdi)
    const { error } = await supabase.from('hesablar').update({ avatar_url: urlData.publicUrl }).eq('id', user.id)
    if (error) showAlert('error', 'Avatar yenilənmədi')
    else { setAvatarUrl(urlData.publicUrl); showAlert('success', 'Profil şəkli yeniləndi!') }
    setAvatarYuklenir(false)
  }

  const hesabSil = async () => {
    const confirm1 = window.confirm('Hesabınızı silmək istədiyinizə əminsiniz? Bu əməliyyat geri alına bilməz.')
    if (!confirm1) return
    const confirm2 = window.confirm('Bütün məlumatlarınız, elanlarınız və rəyləriniz silinəcək. Davam etmək istəyirsiniz?')
    if (!confirm2) return
    setSaving(true)
    await supabase.from('hesablar').delete().eq('id', user.id)
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const initials = hesab?.full_name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  if (authLoading || loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="page-wrap max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors text-lg">←</Link>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Profil redaktəsi</h1>
          <p className="text-sm text-gray-500">Məlumatlarınızı idarə edin</p>
        </div>
      </div>

      {/* Avatar + ad */}
      <div className="card p-5 mb-6 flex items-center gap-5">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-primary-50 flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-primary-600">{initials}</span>
            )}
          </div>
          <button onClick={() => avatarRef.current.click()} disabled={avatarYuklenir}
            className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center text-sm shadow-md transition-colors disabled:opacity-50">
            {avatarYuklenir ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '✎'}
          </button>
          <input ref={avatarRef} type="file" accept="image/*" onChange={avatarYukle} className="hidden" />
        </div>
        <div>
          <div className="font-bold text-gray-800 text-lg">{hesab?.full_name}</div>
          <div className="text-sm text-gray-500">{user?.email}</div>
          <span className={`badge mt-1 text-xs ${hesab?.role === 'mutexessis' ? 'bg-blue-50 text-blue-600' : hesab?.role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-green-50 text-green-600'}`}>
            {hesab?.role === 'mutexessis' ? '🔧 Mütəxəssis' : hesab?.role === 'admin' ? '⚙️ Admin' : '👤 Müştəri'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="card mb-5 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100 px-2">
          {TABS.map((t, i) => {
            if (i === 1 && hesab?.role !== 'mutexessis') return null
            return (
              <TabBtn key={t} active={tab === i} onClick={() => { setTab(i); setAlert({ type: '', msg: '' }) }}>
                {['👤', '🔧', '🔐', '⚠️'][i]} {t}
              </TabBtn>
            )
          })}
        </div>

        <div className="p-5">
          <Alert type={alert.type} msg={alert.msg} onClose={() => setAlert({ type: '', msg: '' })} />

          {/* Şəxsi məlumatlar */}
          {tab === 0 && (
            <div>
              <Field label="Ad və soyad" hint="Bu ad platformada göstəriləcək">
                <input className="input" value={sexsi.full_name} onChange={e => setSexsi(p => ({ ...p, full_name: e.target.value }))} placeholder="Ad Soyad" />
              </Field>
              <Field label="Telefon nömrəsi" hint="Müştərilər bu nömrəyə zəng edə bilər">
                <input className="input" value={sexsi.phone} onChange={e => setSexsi(p => ({ ...p, phone: e.target.value }))} placeholder="+994 50 000 00 00" />
              </Field>
              <Field label="Şəhər">
                <select className="input" value={sexsi.city} onChange={e => setSexsi(p => ({ ...p, city: e.target.value }))}>
                  {SEHIRLER.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <div className="pt-2 border-t border-gray-50">
                <Field label="E-poçt ünvanı" hint="E-poçt ünvanı dəyişdirilə bilməz">
                  <div className="input bg-gray-50 text-gray-500 cursor-not-allowed flex items-center gap-2">
                    <span>🔒</span> {user?.email}
                  </div>
                </Field>
              </div>
              <button onClick={sexsiSaxla} disabled={saving} className="btn-primary py-2.5 px-6 mt-2">
                {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saxlanır...</> : '💾 Yadda saxla'}
              </button>
            </div>
          )}

          {/* Peşəkar məlumatlar */}
          {tab === 1 && hesab?.role === 'mutexessis' && (
            <div>
              <Field label="Xidmət kateqoriyası">
                <select className="input" value={pese.category} onChange={e => setPese(p => ({ ...p, category: e.target.value }))}>
                  {KATEQORIYALAR.map(k => <option key={k}>{k}</option>)}
                </select>
              </Field>
              <Field label="Təcrübə müddəti">
                <select className="input" value={pese.experience_years} onChange={e => setPese(p => ({ ...p, experience_years: e.target.value }))}>
                  {TECRUBE.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Başlanğıc qiymət (AZN)" hint="Müştərilərə göstəriləcək minimum qiymət">
                <div className="relative">
                  <input className="input pr-14" type="number" min="0" value={pese.start_price} onChange={e => setPese(p => ({ ...p, start_price: e.target.value }))} placeholder="0" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">AZN</span>
                </div>
              </Field>
              <Field label="Haqqınızda" hint="Xidmətləriniz, təcrübəniz, ixtisasınız haqqında yazın">
                <textarea className="input resize-none" rows={5} value={pese.bio} onChange={e => setPese(p => ({ ...p, bio: e.target.value }))} placeholder="Məsələn: 10 ildən artıq santexnik sahəsində təcrübəm var. Boru sızması, kran dəyişimi, kanalizasiya işlərini yerinə yetirirəm..." />
                <div className="text-right text-xs text-gray-400 mt-1">{pese.bio.length}/500</div>
              </Field>
              <button onClick={peseSaxla} disabled={saving} className="btn-primary py-2.5 px-6 mt-2">
                {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saxlanır...</> : '💾 Yadda saxla'}
              </button>
            </div>
          )}

          {/* Şifrə */}
          {tab === 2 && (
            <div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm text-blue-700">
                💡 Güclü şifrə üçün: böyük hərflər, rəqəmlər və xüsusi simvollar istifadə edin
              </div>
              {[
                ['kohne', 'Köhnə şifrə', 'Cari şifrənizi daxil edin'],
                ['yeni', 'Yeni şifrə', 'Minimum 6 simvol'],
                ['yeni2', 'Yeni şifrəni təsdiqlə', 'Yeni şifrəni təkrar daxil edin'],
              ].map(([key, label, hint]) => (
                <Field key={key} label={label} hint={hint}>
                  <div className="relative">
                    <input
                      className="input pr-10"
                      type={sifreGoster[key] ? 'text' : 'password'}
                      value={sifre[key]}
                      onChange={e => setSifre(p => ({ ...p, [key]: e.target.value }))}
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setSifreGoster(p => ({ ...p, [key]: !p[key] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
                      {sifreGoster[key] ? '🙈' : '👁️'}
                    </button>
                  </div>
                </Field>
              ))}
              {/* Şifrə gücü göstəricisi */}
              {sifre.yeni && (
                <div className="mb-4">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4].map(i => {
                      const guc = sifre.yeni.length >= 6 ? (sifre.yeni.length >= 10 ? ((/[A-Z]/.test(sifre.yeni) && /[0-9]/.test(sifre.yeni)) ? 4 : 3) : 2) : 1
                      return <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= guc ? ['bg-red-400','bg-orange-400','bg-yellow-400','bg-green-400'][guc-1] : 'bg-gray-100'}`} />
                    })}
                  </div>
                  <p className="text-xs text-gray-400">{['','Zəif','Orta','Yaxşı','Güclü'][Math.min(4, sifre.yeni.length >= 6 ? (sifre.yeni.length >= 10 ? ((/[A-Z]/.test(sifre.yeni) && /[0-9]/.test(sifre.yeni)) ? 4 : 3) : 2) : 1)]}</p>
                </div>
              )}
              <button onClick={sifreDeyis} disabled={saving} className="btn-primary py-2.5 px-6">
                {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Dəyişdirilir...</> : '🔐 Şifrəni dəyiş'}
              </button>
            </div>
          )}

          {/* Hesab idarəetməsi */}
          {tab === 3 && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-700 mb-1">Hesab məlumatları</h3>
                <p className="text-sm text-gray-500">E-poçt: <strong>{user?.email}</strong></p>
                <p className="text-sm text-gray-500 mt-1">Qeydiyyat tarixi: <strong>{user?.created_at ? new Date(user.created_at).toLocaleDateString('az') : '—'}</strong></p>
              </div>

              <div className="border border-red-100 rounded-xl p-5">
                <h3 className="font-semibold text-red-600 mb-2">⚠️ Təhlükəli zona</h3>
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                  Hesabınızı silsəniz, bütün məlumatlarınız, elanlarınız, rəyləriniz və portfolio şəkilləriniz birdəfəlik silinəcək. Bu əməliyyat geri alına bilməz.
                </p>
                <button onClick={hesabSil} disabled={saving}
                  className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  🗑️ Hesabı sil
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
