'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { CreateForm } from '../../../components/admin/content/QuizzesPanel';
import { Alert, EmptyState, PageHeader, Spinner } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';

export default function TeacherQuizzesPage() {
  const { user, loading, me } = useAuth();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    const { data, error: e } = await supabase.from('quizzes').select('id,title,category,duration_seconds,is_published,approval_status,created_at,quiz_questions(count)').eq('created_by', user.id).order('created_at', { ascending: false });
    if (e) setError(e.message); else setItems(data || []);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  async function publish(item) {
    setBusy(item.id); setError(''); setNotice('');
    const { error: e } = await supabase.rpc('teacher_publish_quiz', { p_quiz_id: item.id, p_published: !item.is_published });
    setBusy('');
    if (e) setError(e.message); else { setNotice(item.is_published ? 'Sınaq dərcdən çıxarıldı.' : 'Sınaq admin təsdiqinə göndərildi.'); await load(); }
  }

  if (loading || !me.loaded) return <div className="mx-auto max-w-3xl p-6"><Spinner /></div>;
  if (!user) return <div className="card p-6">Sınaqları idarə etmək üçün hesabınıza daxil olun.</div>;
  if (me.accountType !== 'teacher' && !me.isAdmin) return <div className="card p-6">Bu bölmə müəllim hesabları üçündür.</div>;
  return <div>
    <PageHeader title="Müəllim sınaqları" subtitle="Sınaq yaradın və yayımlanması üçün admin təsdiqinə göndərin." />
    {notice && <Alert type="success" className="mb-4">{notice}</Alert>}{error && <Alert type="error" className="mb-4">{error}</Alert>}
    {!showForm && <button className="btn btn-primary mb-5" onClick={() => setShowForm(true)}>Yeni sınaq yarat</button>}
    {showForm && <CreateForm onClose={() => setShowForm(false)} onCreated={async (m) => { setShowForm(false); setNotice(m); await load(); }} />}
    {items.length === 0 ? <EmptyState icon="quiz" title="Sınağınız yoxdur" text="İlk sınağınızı yaradın. Admin təsdiqləyənədək onu yalnız siz görəcəksiniz." /> :
      <div className="grid gap-3">{items.map((item) => <article key={item.id} className="card flex flex-wrap items-center justify-between gap-4 p-4">
        <div><h2 className="font-semibold">{item.title}</h2><p className="mt-1 text-sm text-muted">{item.category} · {item.quiz_questions?.[0]?.count || 0} sual · {Math.round(item.duration_seconds / 60)} dəq. · {({pending:'Təsdiq gözləyir',published:'Dərc olunub',rejected:'Rədd edilib',draft:'Qaralama'})[item.approval_status]||'Təsdiq gözləyir'}</p></div>
        <button className={item.is_published ? 'btn btn-secondary' : 'btn btn-primary'} disabled={busy === item.id || item.approval_status==='pending'} onClick={() => publish(item)}>{busy === item.id && <Spinner />}{item.is_published ? 'Dərcdən çıxar' : item.approval_status==='pending'?'Təsdiq gözləyir':'Təsdiqə göndər'}</button>
      </article>)}</div>}
  </div>;
}
