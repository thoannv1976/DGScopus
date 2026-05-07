import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { APP_NAME } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Chào {user.name ?? user.email}</h1>
        <p className="text-sm text-slate-500">
          Đây là trang chủ skeleton của <strong>{APP_NAME}</strong>. Khi build
          feature đầu tiên, thay nội dung dưới bằng dashboard / danh sách
          domain object.
        </p>
      </div>

      <div className="card text-slate-600 text-sm space-y-2">
        <p>
          <strong>Bước tiếp theo:</strong> đọc{' '}
          <code className="px-1 bg-slate-100 rounded">CLAUDE.md</code> trước
          khi yêu cầu Claude scaffold feature, đảm bảo đúng pattern UAE18.
        </p>
        <p>
          Reference: xem các app mẫu trong{' '}
          <code className="px-1 bg-slate-100 rounded">_reference/README.md</code>.
        </p>
      </div>
    </div>
  );
}
