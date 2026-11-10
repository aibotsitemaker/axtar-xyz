import { ADSENSE_CLIENT } from '../../lib/site';

export const dynamic = 'force-static';

// Real publisher ID təyin olunanda /ads.txt avtomatik yaranır, əks halda 404 qaytarır.
export function GET() {
  const pub = ADSENSE_CLIENT.replace(/^ca-/, '');
  if (!pub) return new Response('Not found', { status: 404 });
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
