'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import Icon from './Icons';

export default function TeacherFollowButton({ teacherId }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    Promise.all([
      supabase.from('teacher_follows').select('follower_id', { count: 'exact', head: true }).eq('teacher_id', teacherId),
      user ? supabase.from('teacher_follows').select('teacher_id').eq('follower_id', user.id).eq('teacher_id', teacherId).maybeSingle() : Promise.resolve({ data: null })
    ]).then(([total, own]) => { if (live) { setCount(total.count || 0); setFollowing(Boolean(own.data)); } });
    return () => { live = false; };
  }, [teacherId, user]);
  async function toggle() {
    if (!user || busy) return;
    setBusy(true); setError('');
    const result = following
      ? await supabase.from('teacher_follows').delete().eq('follower_id', user.id).eq('teacher_id', teacherId)
      : await supabase.from('teacher_follows').insert({ follower_id: user.id, teacher_id: teacherId });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    setFollowing(!following); setCount((n) => Math.max(0, n + (following ? -1 : 1)));
  }
  if (user?.id === teacherId) return <span className="teacher-follow-count"><Icon name="users" className="h-4 w-4"/>{count} izləyici</span>;
  if (!user) return <Link href={`/auth?next=${encodeURIComponent(`/u/${teacherId}`)}`} className="btn btn-primary btn-sm"><Icon name="plus" className="h-4 w-4"/>İzlə</Link>;
  return <span className="inline-flex flex-col items-start"><button type="button" onClick={toggle} disabled={busy} aria-pressed={following} className={`btn btn-sm ${following?'btn-secondary':'btn-primary'}`}><Icon name={following?'check':'plus'} className="h-4 w-4"/>{busy?'Yüklənir…':following?'İzləyirsən':'İzlə'} <span className="ml-1 opacity-75">{count}</span></button>{error&&<span role="alert" className="mt-1 max-w-40 text-[11px] text-danger">{error}</span>}</span>;
}
