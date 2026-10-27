'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { safeUrl } from '../lib/safe';
import { useAuth } from './AuthProvider';
import Icon from './Icons';
import { EmptyState } from './ui';

function SectionHead({ title, href, label }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover">
        {label}<Icon name="arrowRight" className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default function HomeLive() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let stop = false;
    Promise.all([
      supabase.from('quizzes').select('id, title, category, duration_seconds, quiz_questions(count)').eq('is_published', true).order('created_at', { ascending: false }).limit(3),
      supabase.from('books').select('id, title, price, city, category, image_urls').eq('status', 'active').order('created_at', { ascending: false }).limit(4),
      supabase.from('pdfs').select('id, title, level, subject, year').eq('status', 'active').order('created_at', { ascending: false }).limit(4)
    ]).then(([q, b, p]) => {
      if (!stop) setData({ quizzes: q.data || [], books: b.data || [], pdfs: p.data || [] });
    }).catch(() => { if (!stop) setData({ quizzes: [], books: [], pdfs: [] }); });
    return () => { stop = true; };
  }, []);

  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Yüklənir">
        <div className="skeleton h-6 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-32" />)}</div>
      </div>
    );
  }

  const empty = !data.quizzes.length && !data.books.length && !data.pdfs.length;
  if (empty) {
    return (
      <EmptyState icon="book" title="Məzmun tezliklə əlavə olunacaq"
        text="İlk elanı və ya PDF resursu siz əlavə edə bilərsiniz."
        action={<div className="flex flex-wrap justify-center gap-2"><Link href="/books" className="btn btn-primary">Kitab elanlarına bax</Link><Link href="/pdfs" className="btn btn-secondary">PDF arxivinə bax</Link></div>} />
    );
  }

  return (
    <div className="space-y-10">
      {data.quizzes.length > 0 && (
        <section aria-labelledby="h-quizzes">
          <SectionHead title="Son sınaqlar" href="/quizzes" label="Hamısına bax" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.quizzes.map((z) => (
              <Link key={z.id} href="/quizzes" className="card flex flex-col p-5 transition-shadow hover:shadow-pop">
                <span className="badge self-start">{z.category}</span>
                <h3 className="mt-3 font-semibold">{z.title}</h3>
                <p className="mt-auto flex items-center gap-3 pt-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1"><Icon name="quiz" className="h-3.5 w-3.5" />{z.quiz_questions?.[0]?.count ?? 0} sual</span>
                  <span className="inline-flex items-center gap-1"><Icon name="clock" className="h-3.5 w-3.5" />{Math.round(z.duration_seconds / 60)} dəq</span>
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.books.length > 0 && (
        <section>
          <SectionHead title="Son kitab elanları" href="/books" label="Bütün elanlar" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {data.books.map((b) => {
              const img = safeUrl(b.image_urls?.[0]);
              return (
                <Link key={b.id} href="/books" className="card overflow-hidden transition-shadow hover:shadow-pop">
                  <div className="relative aspect-[4/3] bg-canvas">
                    {img ? <img src={img} alt={b.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
                      : <div className="grid h-full place-items-center text-muted/50"><Icon name="book" className="h-9 w-9" /></div>}
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="line-clamp-2 text-sm font-semibold sm:text-base">{b.title}</h3>
                    <p className="mt-1 text-xs text-muted">{b.city}</p>
                    <p className="mt-2 text-base font-bold text-primary">{Number(b.price).toFixed(2)} ₼</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {data.pdfs.length > 0 && (
        <section>
          <SectionHead title="Yeni PDF resurslar" href="/pdfs" label="Bütün resurslar" />
          <div className="grid gap-4 sm:grid-cols-2">
            {data.pdfs.map((p) => (
              <Link key={p.id} href="/pdfs" className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-pop">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><Icon name="file" className="h-6 w-6" /></div>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{p.title}</h3>
                  <p className="truncate text-xs text-muted">{p.level} · {p.subject}{p.year ? ` · ${p.year}` : ''}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function HomeCta() {
  const { user, loading } = useAuth();
  if (loading || user) return null;
  return (
    <section className="rounded-2xl border border-primary/15 bg-primary-soft px-6 py-10 text-center sm:px-10">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Pulsuz hesab yaradın</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-ink/75 sm:text-base">Nəticələrinizi saxlayın, elan yerləşdirin, PDF yükləyin və digər istifadəçilərlə mesajlaşın.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/auth?mode=register" className="btn btn-primary btn-lg">Qeydiyyatdan keç</Link>
        <Link href="/auth" className="btn btn-secondary btn-lg">Daxil ol</Link>
      </div>
    </section>
  );
}
