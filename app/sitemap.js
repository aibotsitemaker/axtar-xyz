import { SITE_URL } from '../lib/site';

export default function sitemap() {
  const now = new Date();
  const routes = ['', '/books', '/pdfs', '/quizzes', '/legal/privacy', '/legal/terms'];
  return routes.map((r) => ({
    url: `${SITE_URL}${r}`,
    lastModified: now,
    changeFrequency: r === '' || r === '/books' ? 'daily' : 'weekly',
    priority: r === '' ? 1 : r.startsWith('/legal') ? 0.3 : 0.8
  }));
}
