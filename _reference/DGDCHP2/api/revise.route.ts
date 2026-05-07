import { NextRequest, NextResponse } from 'next/server';
import { reviseSyllabus } from '@/lib/evaluator';
import { describeClaudeError } from '@/lib/claude';
import { getEvaluation, getSyllabus, updateSyllabus } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { syllabusId, evaluationId, instructions, applyToSyllabus } =
      await req.json();
    if (!syllabusId || !evaluationId) {
      return NextResponse.json(
        { error: 'syllabusId and evaluationId required' },
        { status: 400 },
      );
    }
    const syl = await getSyllabus(syllabusId);
    if (!syl) return NextResponse.json({ error: 'syllabus not found' }, { status: 404 });
    const evaluation = await getEvaluation(evaluationId);
    if (!evaluation) return NextResponse.json({ error: 'evaluation not found' }, { status: 404 });

    const result = await reviseSyllabus(syl.content, evaluation, instructions);
    if (applyToSyllabus) {
      await updateSyllabus(syllabusId, { content: result.revised });
    }
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('revise route failed', e);
    return NextResponse.json(
      { error: describeClaudeError(e) },
      { status: 500 },
    );
  }
}
