'use client';

export default function Error({ reset }) {
  return (
    <div className="card mx-auto max-w-md p-10 text-center">
      <div className="text-5xl font-bold text-red-500">500</div>
      <h1 className="mt-3 text-xl font-semibold">Gözlənilməz xəta baş verdi</h1>
      <p className="mt-1 text-sm text-slate-500">Zəhmət olmasa, bir azdan yenidən cəhd edin.</p>
      <button onClick={() => reset()} className="btn btn-primary mt-6">Yenidən cəhd et</button>
    </div>
  );
}
