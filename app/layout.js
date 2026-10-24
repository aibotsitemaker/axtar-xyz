import './globals.css';
import Script from 'next/script';
import { AuthProvider } from '../components/AuthProvider';
import Shell from '../components/Shell';
import { SITE_URL, SITE_NAME, ADSENSE_CLIENT } from '../lib/site';

const DESCRIPTION = 'İkinci əl kitab bazarı, PDF arxivi, onlayn sınaqlar və tələbələr üçün canlı çat platforması.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — Kitab, PDF, Sınaq və Canlı Çat`, template: `%s | ${SITE_NAME}` },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'az_AZ', siteName: SITE_NAME, title: `${SITE_NAME} — Kitab, PDF, Sınaq və Canlı Çat`, description: DESCRIPTION, url: SITE_URL },
  twitter: { card: 'summary', title: SITE_NAME, description: DESCRIPTION },
  ...(ADSENSE_CLIENT ? { other: { 'google-adsense-account': ADSENSE_CLIENT } } : {})
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#10B981' };

const jsonLd = { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: SITE_URL, inLanguage: 'az' };

export default function RootLayout({ children }) {
  const ad = ADSENSE_CLIENT;
  return (
    <html lang="az">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {ad ? (
          <Script async strategy="afterInteractive" crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ad}`} />
        ) : null}
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
