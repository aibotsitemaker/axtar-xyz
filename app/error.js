'use client';
import Icon from '../components/Icons';

export default function Error({ reset }) {
  return (
    <div className="card mx-auto my-8 max-w-md px-6 py-14 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-danger-soft text-danger"><Icon name="alert" className="h-7 w-7" /></div>
      <p className="text-sm font-semibold text-danger">500</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Gözlənilməz xəta baş verdi</h1>
      <p className="mt-2 text-sm text-muted">Zəhmət olmasa, bir azdan yenidən cəhd edin.</p>
      <button onClick={() => reset()} className="btn btn-primary mt-6"><Icon name="rotate" className="h-4 w-4" />Yenidən cəhd et</button>
    </div>
  );
}
