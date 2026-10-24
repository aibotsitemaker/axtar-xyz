'use client';
import { useEffect } from 'react';
import { ADSENSE_CLIENT, ADSENSE_SLOT } from '../lib/site';

// Real NEXT_PUBLIC_ADSENSE_CLIENT və NEXT_PUBLIC_ADSENSE_SLOT təyin olunana qədər:
//  - production-da heç nə göstərmir (ziyarətçi boş "reklam yeri" yazısı görmür),
//  - inkişaf rejimində yalnız yer tutucu göstərir.
// Ayrı yerləşdirmələr üçün: <AdSlot slot="1234567890" />
export default function AdSlot({ slot, className = '' }) {
  const adSlot = /^\d{6,20}$/.test(slot || '') ? slot : ADSENSE_SLOT;
  const live = Boolean(ADSENSE_CLIENT && adSlot);

  useEffect(() => {
    if (!live) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* reklam bloklanıb */ }
  }, [live]);

  if (!live) {
    if (process.env.NODE_ENV === 'production') return null;
    return (
      <div className={`my-6 rounded-2xl border border-dashed border-slate-200 bg-white p-2 text-center ${className}`}>
        <div className="flex h-[90px] items-center justify-center text-sm text-slate-300">Reklam yeri (yalnız inkişaf rejimində görünür)</div>
      </div>
    );
  }

  return (
    <div className={`my-6 rounded-2xl border border-slate-100 bg-white p-2 text-center ${className}`}>
      <span className="mb-1 block text-[10px] uppercase tracking-widest text-slate-400">Reklam</span>
      <ins className="adsbygoogle" style={{ display: 'block', minHeight: 90 }}
        data-ad-client={ADSENSE_CLIENT} data-ad-slot={adSlot}
        data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  );
}
