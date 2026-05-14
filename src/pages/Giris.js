import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Giris() {
  const [form, setForm] = useState({ email: '', sifre: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const daxilOl = async () => {
    if (!form.email || !form.sifre) { setError('E-poçt və şifrəni daxil edin'); return }
    setLoading(true)
    setError('')

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.sifre
      })
      if (authError) {
        setError('E-poçt və ya şifrə yanlışdır')
        setLoading(false)
        return
      }
      if (data?.user) {
        window.location.href = '/dashboard'
      }
    } catch (e) {
      setError('Xəta baş verdi. Yenidən cəhd edin.')
      setLoading(false)
    }
  }

  const googleIleGiris = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://www.axtar.xyz/dashboard' }
      })
    } catch (e) {
      setError('Google ilə giriş xətası baş verdi')
    }
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
          <p className="text-gray-500 mt-2 text-sm">Hesabınıza daxil olun</p>
        </div>

        <div className="card p-6 shadow-sm">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm mb-4 flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="space-y-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-poçt</label>
              <input
                className="input"
                type="email"
                placeholder="email@mail.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Şifrə</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={form.sifre}
                onChange={e => setForm(p => ({ ...p, sifre: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && !loading && daxilOl()}
                disabled={loading}
              />
            </div>
          </div>

          <button
            onClick={daxilOl}
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Giriş edilir...
              </>
            ) : 'Daxil ol'}
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">və ya</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button
            onClick={googleIleGiris}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm font-medium text-gray-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google ilə daxil ol
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Hesabınız yoxdur?{' '}
          <Link to="/qeydiyyat" className="text-primary-600 font-medium hover:underline">Qeydiyyat</Link>
        </p>
      </div>
    </div>
  )
}
