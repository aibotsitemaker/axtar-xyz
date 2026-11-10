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
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    setErr('');
    const { data, error } = await supabase.rpc('admin_dashboard_stats');
    setBusy(false);
    if (error || !data) { setErr(errText(error, 'Statistika yüklənmədi. 07 SQL miqrasiyasının işləndiyini yoxlayın.')); return; }
    setStats(data);
  }, []);

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
