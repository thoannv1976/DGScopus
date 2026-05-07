import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getEvaluation, getPaper } from '@/lib/repo';
import { exportEvaluationDocx } from '@/lib/exporters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    const evaluation = await getEvaluation(user.uid, id);
    if (!evaluation) {
      return NextResponse.json({ error: 'Không tìm thấy báo cáo.' }, { status: 404 });
    }
    const paper = await getPaper(user.uid, evaluation.paperId);
    if (!paper) {
      return NextResponse.json({ error: 'Không tìm thấy bài báo gốc.' }, { status: 404 });
    }

    const buf = await exportEvaluationDocx(paper, evaluation);
    const safeTitle = paper.title.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
    // Buffer → Uint8Array để khớp BodyInit của NextResponse (TS strict).
    const body = new Uint8Array(buf);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="DGScopus_${safeTitle}.docx"`,
      },
    });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
    }
    console.error('export route failed', e);
    return NextResponse.json({ error: 'Lỗi xuất báo cáo.' }, { status: 500 });
  }
}
