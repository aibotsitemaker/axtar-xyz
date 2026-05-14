import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [hesab, setHesab] = useState(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  const hesabYukle = async (userId) => {
    try {
      const { data } = await supabase.from('hesablar').select('*').eq('id', userId).single()
      setHesab(data)
      return data
    } catch (e) {
      setHesab(null)
      return null
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        hesabYukle(session.user.id).finally(() => {
          setLoading(false)
          initialized.current = true
        })
      } else {
        setLoading(false)
        initialized.current = true
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!initialized.current) return
      setUser(session?.user ?? null)
      if (session?.user) {
        await hesabYukle(session.user.id)
      } else {
        setHesab(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const cixis = async () => {
    setUser(null)
    setHesab(null)
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return { user, hesab, loading, cixis, hesabYukle }
}
