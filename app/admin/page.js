'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import StatCard from '../../components/admin/StatCard';
import Icon from '../../components/Icons';
import { Alert, ListSkeleton, PageHeader, Spinner } from '../../components/ui';
import { actionLabel, STATUS_BADGE } from '../../lib/admin';
import { errText, timeAgo } from '../../lib/format';

function Section({ title, children, id }) {
  return (
    <section aria-labelledby={id} className="mb-8">
      <h2 id={id} className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// Bütün rəqəmlər admin_dashboard_stats() RPC-sindən (real verilənlər bazası) gəlir.
export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [v6, setV6] = useState(null);
  const [period, setPeriod] = useState(7);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);
  const [noticeForm,setNoticeForm]=useState({title:'',body:'',link:''});const [noticeBusy,setNoticeBusy]=useState(false);const [noticeMsg,setNoticeMsg]=useState('');

  async function sendAnnouncement(e){e.preventDefault();setNoticeBusy(true);setNoticeMsg('');const {data,error}=await supabase.rpc('admin_send_announcement',{p_title:noticeForm.title.trim(),p_body:noticeForm.body.trim(),p_link:noticeForm.link.trim()||null});setNoticeBusy(false);if(error)setNoticeMsg(error.message);else{setNoticeMsg(`${data} istifadəçiyə bildiriş göndərildi.`);setNoticeForm({title:'',body:'',link:''});}}

  const load = useCallback(async () => {
    setBusy(true);
    setErr('');
    const to = new Date();
    const from = new Date(to.getTime() - period * 24 * 60 * 60 * 1000);
    const [{ data, error }, { data: extra }] = await Promise.all([supabase.rpc('admin_dashboard_stats'), supabase.rpc('admin_v6_analytics', { p_from: from.toISOString(), p_to: to.toISOString() })]);
    setBusy(false);
    if (error || !data) { setErr(errText(error, 'Statistika yüklənmədi. 07 SQL miqrasiyasının işləndiyini yoxlayın.')); return; }
    setStats(data);
    setV6(extra || null);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const u = stats?.users || {};
  const f = stats?.forum || {};
  const c = stats?.content || {};
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platformanın cari vəziyyəti (canlı verilənlər bazasından)."
        action={<button className="btn btn-secondary btn-sm" onClick={load} disabled={busy}>{busy ? <Spinner /> : <Icon name="rotate" className="h-4 w-4" />}Yenilə</button>} />
      {err && <Alert type="error" className="mb-4">{err}</Alert>}
      {!stats && busy && <ListSkeleton count={3} />}
      {stats && (
        <>
          <Section title="İstifadəçilər" id="d-users">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <StatCard label="Ümumi istifadəçi" value={u.total} href="/admin/users" />
              <StatCard label="Müəllim" value={u.teacher} href="/admin/users?type=teacher" />
              <StatCard label="Şagird" value={u.student} href="/admin/users?type=student" />
              <StatCard label="Tələbə" value={u.university_student} href="/admin/users?type=university_student" />
              <StatCard label="Tipi seçilməyib (köhnə hesablar)" value={u.unspecified} href="/admin/users?type=none" />
              <StatCard label="Son 7 gündə qeydiyyat" value={u.new_7d} />
              <StatCard label="Hazırda bloklanmış" value={u.blocked_now} href="/admin/users?state=blocked" tone="warn" />
              <StatCard label="Adminlər" value={u.admins} href="/admin/admins" />
            </div>
          </Section>

          <Section title="Forum" id="d-forum">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <StatCard label="Aktiv mövzu" value={f.topics_active} href="/admin/forum?status=active" />
              <StatCard label="Cavab (aktiv)" value={f.replies_active} />
              <StatCard label="Son 7 gündə mövzu" value={f.topics_7d} />
              <StatCard label="Açıq şikayət" value={f.open_reports} href="/admin/reports" tone="danger" />
              <StatCard label="Şikayət edilmiş mövzu" value={f.reported_topics} href="/admin/reports" tone="warn" />
              <StatCard label="Gizli mövzu" value={f.topics_hidden} href="/admin/forum?status=hidden" />
              <StatCard label="Silinmiş mövzu" value={f.topics_deleted} href="/admin/forum?status=deleted" />
              <StatCard label="Sabit / bağlı mövzu" value={f.topics_pinned === undefined ? null : `${f.topics_pinned} / ${f.topics_locked}`} />
            </div>
          </Section>

          <Section title="Məzmun" id="d-content">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Aktiv elan" value={c.books_active} href="/admin/content?tab=books" />
              <StatCard label="Aktiv PDF" value={c.pdfs_active} href="/admin/content?tab=pdfs" />
              <StatCard label="Sınaq" value={c.quizzes} href="/admin/content?tab=quizzes" />
            </div>
          </Section>

          {v6&&<Section title="TəhsilHub V6 analitikası" id="d-v6"><div className="mb-3 flex items-center gap-2"><span className="text-sm text-muted">Dövr:</span>{[7,30,90].map(n=><button key={n} onClick={()=>setPeriod(n)} className={`btn btn-sm ${period===n?'btn-primary':'btn-secondary'}`}>{n} gün</button>)}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard label="Feed paylaşımı" value={v6.feed_posts} href="/feed"/><StatCard label="Feed bəyənməsi" value={v6.feed_likes}/><StatCard label="Feed şərhi" value={v6.feed_comments}/><StatCard label="Müəllim rəyi" value={v6.teacher_reviews} href="/admin/reviews"/><StatCard label="Doğrulanmış hesab" value={v6.verified_users}/><StatCard label="Gözləyən doğrulama" value={v6.pending_verifications} href="/admin/verification" tone="warn"/><StatCard label="İzlənən baxış" value={v6.tracked_views}/><StatCard label="Son 7 gün baxış" value={v6.recent_views}/><StatCard label="Saxlanılan məzmun" value={v6.saved_items}/><StatCard label="Test cəhdləri" value={v6.quiz_attempts}/>
          </div><div className="card mt-4 p-4"><h3 className="mb-3 text-sm font-semibold">Gündəlik baxışlar</h3><div className="flex h-36 items-end gap-1" role="img" aria-label={`${period} günlük baxış statistikası`}>{(v6.views_by_day||[]).map((x,i)=>{const max=Math.max(1,...(v6.views_by_day||[]).map(y=>Number(y.views)||0));const value=Number(x.views)||0;return <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"><span className="text-[10px] text-muted">{value}</span><div title={`${new Date(x.day).toLocaleDateString('az-AZ')}: ${value} baxış`} className="w-full rounded-t bg-primary" style={{height:`${value?Math.max(5,value/max*78):1}%`}}/><span className="text-[9px] text-muted">{new Date(x.day).toLocaleDateString('az-AZ',{day:'2-digit',month:'2-digit'})}</span></div>;})}</div></div><div className="mt-3 flex gap-2"><Link className="btn btn-secondary btn-sm" href="/admin/verification">Doğrulama müraciətləri</Link><Link className="btn btn-secondary btn-sm" href="/admin/reviews">Rəylərin moderasiyası</Link></div></Section>}

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Son mövzular" id="d-topics">
              {(stats.recent_topics || []).length === 0 ? <p className="card px-4 py-6 text-center text-sm text-muted">Hələ mövzu yoxdur.</p> : (
                <ul className="card divide-y divide-line">
                  {stats.recent_topics.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <Link href={`/forum/${t.id}`} className="block break-words text-sm font-medium hover:text-primary hover:underline">{t.title}</Link>
                        <p className="mt-0.5 text-xs text-muted">{t.author_name || 'Silinmiş istifadəçi'} · {timeAgo(t.created_at)} · {t.reply_count} cavab</p>
                      </div>
                      {t.status !== 'active' && <span className="badge badge-muted shrink-0">{STATUS_BADGE[t.status] || t.status}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Vacib bildiriş göndər" id="d-announcement">
              <form onSubmit={sendAnnouncement} className="card space-y-3 p-4">
                <label className="label" htmlFor="announcement-title">Başlıq<input id="announcement-title" className="input" maxLength={120} minLength={3} required value={noticeForm.title} onChange={e=>setNoticeForm(v=>({...v,title:e.target.value}))}/></label>
                <label className="label" htmlFor="announcement-body">Mətn<textarea id="announcement-body" className="input" rows={3} maxLength={2000} required value={noticeForm.body} onChange={e=>setNoticeForm(v=>({...v,body:e.target.value}))}/></label>
                <label className="label" htmlFor="announcement-link">Daxili keçid (könüllü)<input id="announcement-link" className="input" maxLength={300} placeholder="/feed" value={noticeForm.link} onChange={e=>setNoticeForm(v=>({...v,link:e.target.value}))}/></label>
                {noticeMsg&&<p role="status" className="text-sm text-muted">{noticeMsg}</p>}<button className="btn btn-primary" disabled={noticeBusy}>{noticeBusy&&<Spinner/>}Bütün istifadəçilərə göndər</button>
              </form>
            </Section>

            <Section title="Son admin fəaliyyətləri" id="d-activity">
              {(stats.recent_activity || []).length === 0 ? <p className="card px-4 py-6 text-center text-sm text-muted">Hələ qeyd olunan əməliyyat yoxdur.</p> : (
                <ul className="card divide-y divide-line">
                  {stats.recent_activity.map((a) => (
                    <li key={a.id} className="px-4 py-3">
                      <p className="text-sm font-medium">{actionLabel(a.action)}</p>
                      <p className="mt-0.5 break-words text-xs text-muted">{a.actor_label || 'Sistem'}{a.target_label ? ` → ${a.target_label}` : ''} · {timeAgo(a.created_at)}</p>
                    </li>
                  ))}
                  <li className="px-4 py-2.5 text-right"><Link href="/admin/audit" className="text-sm font-semibold text-primary hover:underline">Bütün jurnal</Link></li>
                </ul>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
