'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import { Alert, PageHeader } from '../../components/ui';

export default function AdminPage() {
  const { user, loading } = useAuth(); const router = useRouter();
  const [checking, setChecking] = useState(true); const [allowed, setAllowed] = useState(false); const [data, setData] = useState({}); const [error, setError] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const headers = { Authorization: `Bearer ${sessionData.session?.access_token || ''}` };
    const [auth, profiles, topics, replies, reports, categories, audit, totalUsers, teachers, students, universityStudents, totalTopics, books, pdfs, forumReplies] = await Promise.all([
      supabase.rpc('is_admin'),
      fetch(`/api/admin/users?q=${encodeURIComponent(userSearch)}`, { headers }).then((r) => r.json()),
      supabase.from('forum_topics').select('id,title,author_id,is_pinned,is_locked,deleted_at,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('forum_replies').select('id', { count: 'exact', head: true }),
      supabase.from('forum_reports').select('id,reporter_id,topic_id,reply_id,reason,status,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('forum_categories').select('id,name,is_active').order('name'),
      supabase.from('admin_audit_log').select('id,action,target_type,target_id,created_at').order('created_at', { ascending: false }).limit(30),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'teacher'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'student'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'university_student'),
      supabase.from('forum_topics').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('books').select('id,title,status,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('pdfs').select('id,title,status,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('forum_replies').select('id,topic_id,author_id,body,deleted_at,created_at').order('created_at', { ascending: false }).limit(100)
    ]);
    setChecking(false); setAllowed(auth.data === true);
    if (auth.data !== true) { setError('Admin səlahiyyəti təsdiqlənmədi.'); return; }
    if (profiles.error || topics.error || reports.error) setError('Bəzi məlumatlar yüklənmədi. Miqrasiyanı və server secret-i yoxlayın.');
    setData({ users: profiles.users || [], totalUsers: totalUsers.count || 0, teachers: teachers.count || 0, students: students.count || 0, universityStudents: universityStudents.count || 0, totalTopics: totalTopics.count || 0, topics: topics.data || [], replies: replies.count || 0, forumReplies: forumReplies.data || [], books: books.data || [], pdfs: pdfs.data || [], reports: reports.data || [], categories: categories.data || [], audit: audit.data || [] });
  }, [user, userSearch]);
  useEffect(() => { if (loading) return undefined; if (!user) { router.replace('/auth'); return undefined; } const timer = setTimeout(() => load(), 0); return () => clearTimeout(timer); }, [loading, user, load, router]);

  async function patchTopic(id, patch) { const { error: e } = await supabase.from('forum_topics').update(patch).eq('id', id); if (e) setError(e.message); else load(); }
  async function patchReply(id, patch) { const { error: e } = await supabase.from('forum_replies').update(patch).eq('id', id); if (e) setError(e.message); else load(); }
  async function reportStatus(id, status) { const { error: e } = await supabase.from('forum_reports').update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', id); if (e) setError(e.message); else load(); }
  async function categoryStatus(id, is_active) { const { error: e } = await supabase.from('forum_categories').update({ is_active }).eq('id', id); if (e) setError(e.message); else load(); }
  async function categoryAdd(e) {
    e.preventDefault();
    const slug = categoryName.toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { error: e2 } = await supabase.from('forum_categories').insert({ name: categoryName.trim(), slug });
    if (e2) setError(e2.message); else { setCategoryName(''); load(); }
  }
  async function categoryRename(c) { const name = window.prompt('Yeni kateqoriya adı', c.name); if (!name || name.trim() === c.name) return; const { error: e } = await supabase.from('forum_categories').update({ name: name.trim() }).eq('id', c.id); if (e) setError(e.message); else load(); }
  async function contentEdit(table, id, title) { const next = window.prompt('Yeni başlıq', title); if (!next || next.trim() === title) return; const { error: e } = await supabase.from(table).update({ title: next.trim() }).eq('id', id); if (e) setError(e.message); else load(); }
  async function contentStatus(table, id, status) { const { error: e } = await supabase.from(table).update({ status }).eq('id', id); if (e) setError(e.message); else load(); }
  async function userAction(id, action, user_type) {
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token || ''}` }, body: JSON.stringify({ id, action, user_type }) });
    const result = await response.json(); if (!response.ok) setError(result.error || 'Əməliyyat alınmadı.'); else { setError(''); load(); }
  }

  if (loading || checking) return <div className="skeleton h-64" aria-busy="true" />;
  if (!allowed) return <div className="mx-auto max-w-lg"><Alert type="error">{error || 'Bu səhifəyə giriş icazəniz yoxdur.'}</Alert></div>;
  const card = 'card p-4';
  return <div><PageHeader title="İdarəetmə paneli" subtitle="İstifadəçi profilləri, forum məzmunu, şikayətlər və audit qeydləri." />
    {error && <Alert type="error" className="mt-4">{error}</Alert>}
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[
      ['İstifadəçi sayı', data.totalUsers || 0], ['Müəllim', data.teachers || 0], ['Şagird', data.students || 0], ['Tələbə', data.universityStudents || 0], ['Mövzu / cavab', `${data.totalTopics || 0} / ${data.replies || 0}`]
    ].map(([name, value]) => <div className={card} key={name}><p className="text-xs text-muted">{name}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</div>
    <section className="mt-7"><h2 className="text-xl font-bold">İstifadəçilər</h2><input className="input mt-3 max-w-lg" aria-label="İstifadəçi axtarışı" placeholder="Ad və ya e-poçt üzrə axtar" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} /><div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-canvas text-xs text-muted"><tr><th className="p-3">Ad</th><th className="p-3">E-poçt</th><th className="p-3">Tip</th><th className="p-3">Qeydiyyat</th><th className="p-3">Hesab</th><th className="p-3">Əməliyyat</th></tr></thead><tbody>{data.users?.map((p) => <tr className="border-t border-line" key={p.id}><td className="p-3">{p.full_name || '—'}</td><td className="p-3">{p.email}</td><td className="p-3"><select className="input max-w-44" value={p.user_type} onChange={(e) => userAction(p.id, 'set_type', e.target.value)}><option value="teacher">Müəllim</option><option value="student">Şagird</option><option value="university_student">Tələbə</option></select></td><td className="p-3">{new Date(p.created_at).toLocaleDateString('az-AZ')}</td><td className="p-3">{p.banned_until ? 'Bloklanıb' : 'Aktiv'}{!p.email_confirmed && <div className="text-xs text-muted">E-poçt təsdiqsiz</div>}</td><td className="p-3"><div className="flex gap-2"><button className="btn btn-secondary btn-sm" onClick={() => userAction(p.id, p.banned_until ? 'unban' : 'ban')}>{p.banned_until ? 'Blokdan çıxar' : 'Blokla'}</button><button className="btn btn-danger btn-sm" onClick={() => window.confirm(`${p.email} hesabı və profili silinsin?`) && userAction(p.id, 'delete')}>Sil</button></div></td></tr>)}</tbody></table>{!data.users?.length && <p className="p-4 text-sm text-muted">İstifadəçi tapılmadı.</p>}</div><p className="mt-2 text-xs text-muted">İstifadəçi siyahısı ilk 100 Auth hesabı ilə məhdudlaşır; hesab şifrələri heç vaxt oxunmur.</p></section>
    <section className="mt-7"><h2 className="text-xl font-bold">Forum mövzuları</h2><div className="mt-3 space-y-2">{data.topics?.map((t) => <div className={`${card} flex flex-wrap items-center justify-between gap-3`} key={t.id}><span className="min-w-0 flex-1 truncate font-medium">{t.title}{t.deleted_at && <span className="ml-2 text-xs text-danger">Gizlədilib</span>}</span><div className="flex flex-wrap gap-2"><button className="btn btn-secondary btn-sm" onClick={() => patchTopic(t.id, { is_pinned: !t.is_pinned })}>{t.is_pinned ? 'Sabitdən çıxar' : 'Sabitlə'}</button><button className="btn btn-secondary btn-sm" onClick={() => patchTopic(t.id, { is_locked: !t.is_locked })}>{t.is_locked ? 'Aç' : 'Bağla'}</button><button className="btn btn-secondary btn-sm" onClick={() => patchTopic(t.id, { deleted_at: t.deleted_at ? null : new Date().toISOString() })}>{t.deleted_at ? 'Bərpa et' : 'Gizlət'}</button></div></div>)}</div></section>
    <section className="mt-7"><h2 className="text-xl font-bold">Forum cavabları <span className="text-sm font-normal text-muted">(son 100)</span></h2><div className="mt-3 space-y-2">{data.forumReplies?.map((r) => <div className={`${card} flex flex-wrap items-center justify-between gap-3`} key={r.id}><a className="min-w-0 flex-1 truncate text-sm hover:text-primary" href={`/forum/${r.topic_id}`}>{r.body}</a><button className="btn btn-secondary btn-sm" onClick={() => patchReply(r.id, { deleted_at: r.deleted_at ? null : new Date().toISOString() })}>{r.deleted_at ? 'Bərpa et' : 'Gizlət'}</button></div>)}</div></section>
    <section className="mt-7"><h2 className="text-xl font-bold">Şikayətlər</h2><div className="mt-3 space-y-2">{!data.reports?.length && <div className={card}>Şikayət yoxdur.</div>}{data.reports?.map((r) => <div className={card} key={r.id}><div className="flex flex-wrap justify-between gap-2"><span className="text-sm">{r.reason}</span><span className="text-xs text-muted">{r.status} · {new Date(r.created_at).toLocaleString('az-AZ')}</span></div><div className="mt-3 flex gap-2"><button className="btn btn-secondary btn-sm" onClick={() => reportStatus(r.id, 'reviewed')}>Baxıldı</button><button className="btn btn-secondary btn-sm" onClick={() => reportStatus(r.id, 'dismissed')}>Rədd et</button></div></div>)}</div></section>
    <section className="mt-7"><h2 className="text-xl font-bold">Kateqoriyalar</h2><form onSubmit={categoryAdd} className="mt-3 flex max-w-xl gap-2"><input className="input" required minLength={2} maxLength={80} placeholder="Yeni kateqoriya" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} /><button className="btn btn-primary shrink-0">Əlavə et</button></form><div className="mt-3 grid gap-2 sm:grid-cols-2">{data.categories?.map((c) => <div className={`${card} flex items-center justify-between gap-3`} key={c.id}><span>{c.name}</span><div className="flex gap-2"><button className="btn btn-secondary btn-sm" onClick={() => categoryRename(c)}>Adı dəyiş</button><button className="btn btn-secondary btn-sm" onClick={() => categoryStatus(c.id, !c.is_active)}>{c.is_active ? 'Deaktiv et' : 'Aktiv et'}</button></div></div>)}</div></section>
    <section className="mt-7"><h2 className="text-xl font-bold">Kitab elanları</h2><div className="mt-3 space-y-2">{data.books?.map((b) => <div className={`${card} flex flex-wrap items-center justify-between gap-3`} key={b.id}><span className="min-w-0 flex-1 truncate">{b.title}</span><button className="btn btn-secondary btn-sm" onClick={() => contentEdit('books', b.id, b.title)}>Başlığı dəyiş</button><select className="input max-w-36" value={b.status} onChange={(e) => contentStatus('books', b.id, e.target.value)}><option value="active">Aktiv</option><option value="sold">Satılıb</option><option value="hidden">Gizli</option></select></div>)}</div></section>
    <section className="mt-7"><h2 className="text-xl font-bold">PDF resursları</h2><div className="mt-3 space-y-2">{data.pdfs?.map((p) => <div className={`${card} flex flex-wrap items-center justify-between gap-3`} key={p.id}><span className="min-w-0 flex-1 truncate">{p.title}</span><button className="btn btn-secondary btn-sm" onClick={() => contentEdit('pdfs', p.id, p.title)}>Başlığı dəyiş</button><select className="input max-w-36" value={p.status} onChange={(e) => contentStatus('pdfs', p.id, e.target.value)}><option value="active">Aktiv</option><option value="hidden">Gizli</option></select></div>)}</div></section>
    <section className="mt-7"><h2 className="text-xl font-bold">Son audit qeydləri</h2><div className="mt-3 space-y-2">{!data.audit?.length && <div className={card}>Hələ audit qeydi yoxdur.</div>}{data.audit?.map((x) => <div className={`${card} flex justify-between gap-3 text-sm`} key={x.id}><span>{x.action} · {x.target_type} · {x.target_id}</span><time className="shrink-0 text-xs text-muted">{new Date(x.created_at).toLocaleString('az-AZ')}</time></div>)}</div></section>
  </div>;
}
