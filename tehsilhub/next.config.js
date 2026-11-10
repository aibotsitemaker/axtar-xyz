/** @type {import('next').NextConfig} */
const supa = 'https://*.supabase.co wss://*.supabase.co';
const google = 'https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.adtrafficquality.google https://fundingchoicesmessages.google.com https://*.gstatic.com';

// Report-Only: reklam skriptlərini pozmadan pozuntuları brauzer konsolunda göstərir.
// Konsolda xəta görmədikdən sonra açarı "Content-Security-Policy" etmək olar.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${google}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supa} ${google}`,
  `frame-src ${google}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'"
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Content-Security-Policy-Report-Only', value: csp }
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  }
};

module.exports = nextConfig;
