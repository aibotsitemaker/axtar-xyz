import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SifreYenile() {
  const [form, setForm] = useState({ yeni: '', yeni2: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPass, setShowPass] = useState({ yeni: false, yeni2: false })
  const navigate = useNavigate()

  useEffect(() => {
    // URL-dəki hash-i Supabase-ə ver
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      supabase.auth.setSession({
        access_token: new URLSearchParams(hash.slice(1)).get('access_token'),
        refresh_token: new URLSearchParams(hash.slice(1)).get('refresh_token')
      })
    }
  }, [])

  const sifreDeyis = async () => {
    setError('')
    if (!form.yeni) { setError('Yeni şifrəni daxil edin'); return }
    if (form.yeni.length < 6) { setError('Minimum 6 simvol olmalıdır'); return }
    if (form.yeni !== form.yeni2) { setError('Şifrələr uyğun gəlmir'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password: form.yeni })
    if (err) { setError('Xəta: ' + err.message); setLoading(false); return }
    setSuccess(true)
    setTimeout(() => navigate('/dashboard'), 3000)
  }

  const guc = () => {
    const p = form.yeni
    if (!p) return 0
    if (p.length < 6) return 1
    if (p.length < 10) return 2
    if (/[A-Z]/.test(p) && /[0-9]/.test(p)) return 4
    return 3
  }

  if (success) return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Şifrə dəyişdirildi!</h2>
        <p className="text-gray-500 text-sm mb-6">3 saniyə sonra profilinizə yönləndiriləcəksiniz...</p>
        <Link to="/dashboard" className="btn-primary py-3 px-8">Profilə keç</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-0.5 text-2xl font-bold">
            <span className="text-primary-600">Axtar</span>
            <span className="text-accent-500">.</span>
            <span className="text-primary-600">xyz</span>
          </Link>
          <p className="text-gray-500 mt-2 text-sm">Yeni şifrə təyin edin</p>
        </div>
        <div className="card p-6 shadow-sm">
          {error && <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm mb-4">⚠️ {error}</div>}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Yeni şifrə</label>
              <div className="relative">
                <input className="input pr-10" type={showPass.yeni ? 'text' : 'password'} placeholder="Minimum 6 simvol"
                  value={form.yeni} onChange={e => setForm(p => ({ ...p, yeni: e.target.value }))} autoFocus />
                <button type="button" onClick={() => setShowPass(p => ({ ...p, yeni: !p.yeni }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass.yeni ? '🙈' : '👁️'}
                </button>
              </div>
              {form.yeni && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${i <= guc() ? ['','bg-red-400','bg-orange-400','bg-yellow-400','bg-green-400'][guc()] : 'bg-gray-100'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{['','Zəif','Orta','Yaxşı','Güclü'][guc()]}</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Şifrəni təsdiqlə</label>
              <div className="relative">
                <input className="input pr-10" type={showPass.yeni2 ? 'text' : 'password'} placeholder="Şifrəni təkrar daxil edin"
                  value={form.yeni2} onChange={e => setForm(p => ({ ...p, yeni2: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && sifreDeyis()} />
                <button type="button" onClick={() => setShowPass(p => ({ ...p, yeni2: !p.yeni2 }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass.yeni2 ? '🙈' : '👁️'}
                </button>
              </div>
              {form.yeni2 && form.yeni !== form.yeni2 && <p className="text-xs text-red-500 mt-1">Şifrələr uyğun gəlmir</p>}
              {form.yeni2 && form.yeni === form.yeni2 && form.yeni.length >= 6 && <p className="text-xs text-green-500 mt-1">✓ Uyğundur</p>}
            </div>
          </div>
          <button onClick={sifreDeyis} disabled={loading || !form.yeni || !form.yeni2}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 mt-5">
            {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Dəyişdirilir...</> : '🔐 Şifrəni dəyiş'}
          </button>
        </div>
      </div>
    </div>
  )
}
