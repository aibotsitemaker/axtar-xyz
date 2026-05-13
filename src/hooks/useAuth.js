import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [hesab, setHesab] = useState(null)
  const [loading, setLoading] = useState(true)

  const hesabYukle = async (userId) => {
    const { data } = await supabase.from('hesablar').select('*').eq('id', userId).single()
    setHesab(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) hesabYukle(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return { user, hesab, loading, cixis, hesabYukle }
}
