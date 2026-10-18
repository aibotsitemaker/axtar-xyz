import Link from 'next/link';

export const metadata = { title: 'Səhifə tapılmadı', robots: { index: false } };

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md p-10 text-center">
      <div className="text-5xl font-bold text-brand">404</div>
      <h1 className="mt-3 text-xl font-semibold">Səhifə tapılmadı</h1>
      <p className="mt-1 text-sm text-slate-500">Axtardığınız səhifə mövcud deyil və ya köçürülüb.</p>
      <Link href="/" className="btn btn-primary mt-6">Ana səhifəyə qayıt</Link>
    </div>
  );
}
