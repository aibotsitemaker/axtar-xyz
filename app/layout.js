import './globals.css';
import Script from 'next/script';
import { AuthProvider } from '../components/AuthProvider';
import Shell from '../components/Shell';

export const metadata = {
  title: 'TəhsilHub — Kitab, PDF, Sınaq və Canlı Çat',
  description: 'İkinci əl kitab bazarı, PDF arxivi, onlayn sınaqlar və tələbələr üçün canlı çat platforması.'
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#10B981' };

export default function RootLayout({ children }) {
  const ad = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  return (
    <html lang="az">
      <body>
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
