import AdminGuard from '../../components/admin/AdminGuard';

export const metadata = {
  title: { absolute: 'Admin paneli | TəhsilHub' },
  description: 'TəhsilHub idarə paneli.',
  robots: { index: false, follow: false }
};

export default function AdminLayout({ children }) {
  return <AdminGuard>{children}</AdminGuard>;
}
