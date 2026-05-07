import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { describeClaudeError } from '@/lib/claude';
import { REVIEW_MODES } from '@/lib/constants';
import { evaluateQuick, evaluateDetailed, generateExtras } from '@/lib/evaluator';
import { createEvaluation, getPaper, updateEvaluation } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z.object({
  paperId: z.string().min(1),
  mode: z.enum(REVIEW_MODES),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { paperId, mode } = Body.parse(await req.json());

    const paper = await getPaper(user.uid, paperId);
    if (!paper) {
      return NextResponse.json({ error: 'Không tìm thấy bài báo.' }, { status: 404 });
    }

    const start = Date.now();

    if (mode === 'quick') {
      const result = await evaluateQuick(user.uid, paper);
      const evalId = await createEvaluation(user.uid, {
        paperId,
        mode: 'quick',
        targetTier: paper.targetTier,
        field: paper.field,
        journalName: paper.journalName,
        overallScore: result.overallScore,
        criteria: result.criteria,
        topIssues: result.topIssues,
        model: result.model,
        latencyMs: Date.now() - start,
      });
      return NextResponse.json({ evalId });
    }

    // Detailed
    const detailed = await evaluateDetailed(user.uid, paper);
    const evalId = await createEvaluation(user.uid, {
      paperId,
      mode: 'detailed',
      targetTier: paper.targetTier,
      field: paper.field,
      journalName: paper.journalName,
      overallScore: detailed.overallScore,
      criteria: detailed.criteria,
      topIssues: detailed.topIssues,
      sectionRevisions: detailed.sectionRevisions,
      model: detailed.model,
      latencyMs: Date.now() - start,
    });

    // Extras chạy parallel sau, lỗi không làm fail evaluation chính.
    try {
      const extras = await generateExtras(user.uid, paper, detailed);
      await updateEvaluation(user.uid, evalId, {
        coverLetter: extras.coverLetter ?? undefined,
        relatedPapers: extras.relatedPapers ?? undefined,
        acceptanceProbability: extras.acceptanceProbability ?? undefined,
        latencyMs: Date.now() - start,
      });
    } catch (e) {
      console.error('extras generation failed (non-fatal)', e);
    }

    return NextResponse.json({ evalId });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dữ liệu không hợp lệ: ' + e.errors.map((x) => x.message).join('; ') },
        { status: 400 },
      );
    }
    const code = (e as { code?: string })?.code;
    if (code === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
    }
    if (code === 'RATE_LIMITED' || code === 'INPUT_TOO_SHORT') {
      return NextResponse.json(
        { error: describeClaudeError(e) },
        { status: 429 },
      );
    }
    console.error('evaluate route failed', e);
    return NextResponse.json(
      { error: describeClaudeError(e) },
      { status: 500 },
    );
  }
}
