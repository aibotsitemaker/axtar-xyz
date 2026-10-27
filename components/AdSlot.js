'use client';
import { useEffect } from 'react';
import { ADSENSE_CLIENT, ADSENSE_SLOT } from '../lib/site';

// Real NEXT_PUBLIC_ADSENSE_CLIENT və NEXT_PUBLIC_ADSENSE_SLOT təyin olunana qədər:
//  - production-da heç nə göstərmir,
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
      <div className={`my-8 rounded-xl border border-dashed border-line bg-surface p-2 text-center ${className}`}>
        <div className="flex h-[90px] items-center justify-center text-sm text-muted">Reklam yeri (yalnız inkişaf rejimində görünür)</div>
      </div>
    );
  }

  return (
    <div className={`my-8 overflow-hidden rounded-xl border border-line bg-surface p-2 text-center ${className}`}>
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted">Reklam</span>
      <ins className="adsbygoogle" style={{ display: 'block', minHeight: 90 }}
        data-ad-client={ADSENSE_CLIENT} data-ad-slot={adSlot}
        data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  );
}
