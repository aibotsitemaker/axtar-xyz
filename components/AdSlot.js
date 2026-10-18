'use client';
import { useEffect } from 'react';

export default function AdSlot({ slot, className = '' }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const adSlot = slot || process.env.NEXT_PUBLIC_ADSENSE_SLOT;

  useEffect(() => {
    if (client) {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    }
  }, [client]);

  return (
    <div className={`my-6 rounded-2xl border border-dashed border-slate-200 bg-white p-2 text-center ${className}`}>
      <span className="mb-1 block text-[10px] uppercase tracking-widest text-slate-400">Reklam</span>
      {client ? (
        <ins
          className="adsbygoogle"
          style={{ display: 'block', minHeight: 90 }}
          data-ad-client={client}
          data-ad-slot={adSlot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <div className="flex h-[90px] items-center justify-center text-sm text-slate-300">Reklam yeri (Google AdSense)</div>
      )}
    </div>
  );
}
