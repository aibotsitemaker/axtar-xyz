import LegalView from '../../../components/LegalView';

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ type: 'privacy' }, { type: 'terms' }];
}

const TITLES = { privacy: 'Məxfilik Siyasəti', terms: 'İstifadə Şərtləri' };

export async function generateMetadata({ params }) {
  const { type } = await params;
  return { title: TITLES[type], alternates: { canonical: `/legal/${type}` } };
}

export default async function LegalPage({ params }) {
  const { type } = await params;
  return <LegalView type={type} />;
}
