import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SifreSifirla() {
  const [email, setEmail] = useState('')
  const [gonderilib, setGonderilib] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const gonder = async () => {
    if (!email.trim()) { setError('E-poçt ünvanını daxil edin'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: 'https://www.axtar.xyz/sifre-yenile' }
    )
    if (err) {
      setError('Xəta baş verdi. E-poçtu yoxlayın.')
      setLoading(false)
      return
    }
    setGonderilib(true)
    setLoading(false)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-0.5 text-2xl font-bold">
            <span className="text-primary-600">Axtar</span>
            <span className="text-accent-500">.</span>
            <span className="text-primary-600">xyz</span>
          </Link>
          <p className="text-gray-500 mt-2 text-sm">Şifrəni sıfırla</p>
        </div>

        <div className="card p-6 shadow-sm">
          {gonderilib ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">📧</div>
              <h3 className="font-bold text-gray-800 mb-2">E-poçt göndərildi!</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                <strong>{email}</strong> ünvanına şifrə sıfırlama linki göndərildi.<br />
                Spam qovluğunu da yoxlayın.
              </p>
              <Link to="/giris" className="btn-primary justify-center w-full py-3">Girişə qayıt</Link>
            </div>
          ) : (
            <>
              <h3 className="font-bold text-gray-800 mb-1">Şifrəni unutdunuz?</h3>
              <p className="text-sm text-gray-500 mb-5">
                E-poçt ünvanınızı daxil edin, sıfırlama linki göndərəcəyik.
              </p>
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm mb-4">
                  ⚠️ {error}
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">E-poçt ünvanı</label>
                <input
                  className="input"
                  type="email"
                  placeholder="email@mail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !loading && gonder()}
                  autoFocus
                />
              </div>
              <button
                onClick={gonder}
                disabled={loading}
                className="w-full btn-primary justify-center py-3"
              >
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Göndərilir...</>
                  : '📧 Link göndər'}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Yadınıza düşdü?{' '}
          <Link to="/giris" className="text-primary-600 font-medium hover:underline">Daxil olun</Link>
        </p>
      </div>
    </div>
  )
}
