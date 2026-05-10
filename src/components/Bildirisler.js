import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Bildirisler({ userId }) {
  const [bildirisler, setBildirisler] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const navigate = useNavigate()

  useEffect(() => {
    if (!userId) return
    yukle()
    // Real-time bildiriş
    const channel = supabase.channel('bildirisler')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bildirisler', filter: `user_id=eq.${userId}` },
        () => yukle()
      ).subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId])

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const yukle = async () => {
    const { data } = await supabase.from('bildirisler').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    setBildirisler(data || [])
  }

  const oxu = async (b) => {
    await supabase.from('bildirisler').update({ oxunub: true }).eq('id', b.id)
    yukle()
    if (b.link) { setOpen(false); navigate(b.link) }
  }

  const hamısınıOxu = async () => {
    await supabase.from('bildirisler').update({ oxunub: true }).eq('user_id', userId)
    yukle()
  }

  const oxunmamis = bildirisler.filter(b => !b.oxunub).length

  const tipIkon = (tip) => ({ mesaj: '💬', muraciet: '📋', rey: '⭐' }[tip] || '🔔')

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: '4px 8px', fontSize: 20 }}>
        🔔
        {oxunmamis > 0 && (
          <span style={{ position: 'absolute', top: 0, right: 0, background: '#E24B4A', color: '#fff', fontSize: 10, fontWeight: 700, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {oxunmamis > 9 ? '9+' : oxunmamis}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: '100%', width: 320, background: '#fff', border: '1px solid #eee', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #eee' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Bildirişlər</span>
            {oxunmamis > 0 && <button onClick={hamısınıOxu} style={{ fontSize: 12, color: '#185FA5', background: 'none', border: 'none', cursor: 'pointer' }}>Hamısını oxu</button>}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {bildirisler.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: '#888', fontSize: 14 }}>Bildiriş yoxdur</div>
            ) : bildirisler.map(b => (
              <div key={b.id} onClick={() => oxu(b)} style={{ display: 'flex', gap: 10, padding: '12px 16px', cursor: 'pointer', background: b.oxunub ? '#fff' : '#F0F7FF', borderBottom: '1px solid #f5f5f5' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{tipIkon(b.tip)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: '#333', margin: 0, lineHeight: 1.5 }}>{b.metn}</p>
                  <p style={{ fontSize: 11, color: '#aaa', margin: '4px 0 0' }}>{new Date(b.created_at).toLocaleDateString('az')}</p>
                </div>
                {!b.oxunub && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#185FA5', flexShrink: 0, marginTop: 4 }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
