import { NextRequest, NextResponse } from 'next/server';
import { syllabusToDocx, syllabusToPdf } from '@/lib/exporters';
import { getEvaluation, getSyllabus } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeFileName(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .slice(0, 80);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const url = new URL(req.url);
    const format = (url.searchParams.get('format') || 'docx').toLowerCase();
    const includeEvaluation = url.searchParams.get('evaluation') !== '0';

    const syl = await getSyllabus(params.id);
    if (!syl) return NextResponse.json({ error: 'not found' }, { status: 404 });

    let evaluation = null;
    if (includeEvaluation && syl.latestEvaluationId) {
      evaluation = await getEvaluation(syl.latestEvaluationId);
    }

    const baseName = safeFileName(syl.title || 'syllabus');

    if (format === 'pdf') {
      const buf = await syllabusToPdf(syl, evaluation);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${baseName}.pdf"`,
        },
      });
    }

    const buf = await syllabusToDocx(syl, evaluation);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${baseName}.docx"`,
      },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
