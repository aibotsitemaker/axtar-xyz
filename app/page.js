import Link from 'next/link';
import AdSlot from '../components/AdSlot';
import HomeLive, { HomeCta } from '../components/HomeLive';
import Icon from '../components/Icons';

const SERVICES = [
  { href: '/quizzes', icon: 'quiz', title: 'Onlayn sınaqlar', text: 'DİM, Magistr və IELTS üçün taymerli testlər, dərhal nəticə və izahlar.' },
  { href: '/books', icon: 'book', title: 'Kitab bazarı', text: 'İkinci əl dərslik və kitabları şəhər və kateqoriyaya görə tapın və ya satın.' },
  { href: '/pdfs', icon: 'file', title: 'PDF arxivi', text: 'Pillə, fənn və ilə görə konspekt və resursları axtarın, baxın, yükləyin.' },
  { href: '/chat', icon: 'chat', title: 'Canlı çat', text: 'Satıcılarla və digər istifadəçilərlə anında mesajlaşın.' }
];

export default function Home() {
  return (
    <div className="space-y-12 sm:space-y-14">
      <section className="overflow-hidden rounded-2xl border border-primary/15 bg-primary-soft">
        <div className="grid items-center gap-8 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <span className="badge bg-surface">Təhsil platforması</span>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Təhsil üçün lazım olan hər şey bir yerdə!
            </h1>
            <p className="mt-4 max-w-xl text-base text-ink/75 sm:text-lg">
              Sınaqlar, ikinci əl kitablar, PDF resurslar və tələbələr arasında canlı ünsiyyət.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/quizzes" className="btn btn-primary btn-lg">Sınaqlara keç<Icon name="arrowRight" className="h-4 w-4" /></Link>
              <Link href="/books" className="btn btn-secondary btn-lg">Elanlara bax</Link>
            </div>
          </div>
          <div className="hidden lg:block" aria-hidden="true">
            <div className="grid grid-cols-2 gap-4">
              {[['quiz', 'Sınaqlar'], ['book', 'Kitablar'], ['file', 'PDF arxivi'], ['chat', 'Çat']].map(([n, l], i) => (
                <div key={n} className={`flex aspect-[5/4] flex-col items-center justify-center gap-3 rounded-2xl border border-primary/15 bg-surface shadow-card ${i % 2 ? 'translate-y-4' : ''}`}>
                  <span className="grid h-14 w-14 place-items-center rounded-xl bg-primary-soft text-primary"><Icon name={n} className="h-7 w-7" /></span>
                  <span className="text-sm font-semibold text-ink">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Xidmətlər" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map((s) => (
          <Link key={s.href} href={s.href} className="card group p-5 transition-shadow hover:shadow-pop">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-white">
              <Icon name={s.icon} className="h-5 w-5" />
            </div>
            <h2 className="font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-muted">{s.text}</p>
          </Link>
        ))}
      </section>

      <HomeLive />
      <AdSlot className="!my-0" />
      <HomeCta />
    </div>
  );
}
