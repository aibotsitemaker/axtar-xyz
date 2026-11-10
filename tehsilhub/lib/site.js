export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.axtar.xyz').replace(/\/$/, '');
export const SITE_NAME = 'TəhsilHub';

// AdSense: yalnız düzgün formatlı real ID-lər qəbul olunur (məsələn ca-pub-1234567890123456 və 1234567890).
const rawClient = (process.env.NEXT_PUBLIC_ADSENSE_CLIENT || '').trim();
const rawSlot = (process.env.NEXT_PUBLIC_ADSENSE_SLOT || '').trim();
export const ADSENSE_CLIENT = /^ca-pub-\d{10,20}$/.test(rawClient) ? rawClient : '';
export const ADSENSE_SLOT = /^\d{6,20}$/.test(rawSlot) ? rawSlot : '';
