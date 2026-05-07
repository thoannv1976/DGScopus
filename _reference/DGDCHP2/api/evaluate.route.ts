import { NextRequest, NextResponse } from 'next/server';
import { evaluateSyllabus } from '@/lib/evaluator';
import { describeClaudeError } from '@/lib/claude';
import { getSyllabus, saveEvaluation } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { syllabusId } = await req.json();
    if (!syllabusId) {
      return NextResponse.json(
        { error: 'syllabusId required' },
        { status: 400 },
      );
    }
    const syl = await getSyllabus(syllabusId);
    if (!syl) {
      return NextResponse.json({ error: 'syllabus not found' }, { status: 404 });
    }
    const evaluation = await evaluateSyllabus(syl.content);
    const id = await saveEvaluation(syllabusId, evaluation);
    return NextResponse.json({ id, evaluation });
  } catch (e: any) {
    console.error('evaluate route failed', e);
    return NextResponse.json(
      { error: describeClaudeError(e) },
      { status: 500 },
    );
  }
}
