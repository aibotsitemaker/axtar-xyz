import Link from 'next/link';
import AdSlot from '../components/AdSlot';

const CARDS = [
  { href: '/books', icon: '📚', title: '2-ci əl kitab bazarı', text: 'DİM, Magistr, IELTS və universitet kitablarını al və sat.' },
  { href: '/pdfs', icon: '📄', title: 'PDF & Konspekt arxivi', text: 'Pillə, fənn və ilə görə filtrlə, yüklə, favorilərə əlavə et.' },
  { href: '/quizzes', icon: '🧠', title: 'Onlayn sınaqlar', text: 'Taymerli testlər, dərhal nəticə və ətraflı izah.' },
  { href: '/chat', icon: '💬', title: 'Canlı çat', text: 'Satıcı və tələbələrlə anında mesajlaş.' }
];

export default function Home() {
  return (
    <div>
      <section className="rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-12 text-white md:px-12 md:py-16">
        <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight md:text-5xl">
          Təhsil üçün lazım olan hər şey bir yerdə.
        </h1>
        <p className="mt-4 max-w-xl text-emerald-50 md:text-lg">
          Kitab al-sat, PDF resurslar tap, sınaqlarla hazırlaş və tələbələrlə canlı ünsiyyət qur.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/books" className="btn bg-white text-emerald-700 hover:bg-emerald-50">Kitablara bax</Link>
          <Link href="/auth" className="btn border border-white/40 text-white hover:bg-white/10">Pulsuz qeydiyyat</Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-xl">{c.icon}</div>
            <h3 className="font-semibold">{c.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{c.text}</p>
          </Link>
        ))}
      </section>

      <AdSlot />

      <section className="flex flex-wrap justify-center gap-5 pb-4 text-sm text-slate-500 md:hidden">
        <Link href="/legal/privacy">Məxfilik Siyasəti</Link>
        <Link href="/legal/terms">İstifadə Şərtləri</Link>
      </section>
    </div>
  );
}
