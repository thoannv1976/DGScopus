import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import UploadForm from '@/components/UploadForm';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">DGScopus — Pre-submission peer review</h1>
        <p className="text-sm text-slate-500 mt-1">
          AI peer review cho bài báo trước khi nộp tạp chí Scopus. 7 tiêu chí
          chuẩn quốc tế, điểm + nhận xét bằng tiếng Anh, kèm cover letter và
          danh sách paper liên quan.
        </p>
      </div>
      <UploadForm />
    </div>
  );
}
