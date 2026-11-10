import { SITE_URL } from '../lib/site';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/chat', '/profile', '/auth', '/admin', '/notifications', '/forum/new'] }],
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
