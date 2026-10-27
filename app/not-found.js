import Link from 'next/link';
import Icon from '../components/Icons';

export const metadata = { title: 'Səhifə tapılmadı', robots: { index: false } };

export default function NotFound() {
  return (
    <div className="card mx-auto my-8 max-w-md px-6 py-14 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary"><Icon name="search" className="h-7 w-7" /></div>
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Səhifə tapılmadı</h1>
      <p className="mt-2 text-sm text-muted">Axtardığınız səhifə mövcud deyil və ya köçürülüb.</p>
      <Link href="/" className="btn btn-primary mt-6">Ana səhifəyə qayıt</Link>
    </div>
  );
}
