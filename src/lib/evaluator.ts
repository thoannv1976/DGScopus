import 'server-only';
import pLimit from 'p-limit';
import { runClaude, extractJson } from './claude';
import { CLAUDE_PARALLELISM, SECTION_KEYS, type SectionKey } from './constants';
import { SCOPUS_CRITERIA, getCriterion } from './criteria';
import { findSection } from './sectionizer';
import { buildQuickPrompt, type QuickRawResult } from './prompts/quick';
import {
  buildSectionSummaryPrompt,
  buildDetailedAggregatePrompt,
  type DetailedRawResult,
  type SectionSummary,
} from './prompts/detailed';
import {
  buildCoverLetterPrompt,
  buildRelatedPapersPrompt,
  buildAcceptanceProbPrompt,
  type CoverLetterRaw,
  type RelatedPapersRaw,
  type AcceptanceRaw,
} from './prompts/extras';
import type {
  AcceptanceProbability,
  CriterionScore,
  PaperDoc,
  RelatedPaper,
  SectionRevision,
} from './types';

// =============================================================================
// High-level evaluator. Mọi route handler gọi qua các hàm dưới — KHÔNG gọi
// runClaude() trực tiếp ngoài file này (giữ prompt engineering tập trung).
// =============================================================================

export interface QuickEvaluation {
  overallScore: number;
  criteria: CriterionScore[];
  topIssues: string[];
  model: string;
  latencyMs: number;
}

export async function evaluateQuick(
  userId: string,
  paper: PaperDoc,
): Promise<QuickEvaluation> {
  // Quick mode chỉ gửi abstract + intro + conclusion để tiết kiệm token.
  const slices = pickQuickSlices(paper);
  const { system, user } = buildQuickPrompt({
    paperText: slices,
    targetTier: paper.targetTier,
    field: paper.field,
    journalName: paper.journalName,
  });

  const r = await runClaude({
    userId,
    route: 'POST /api/evaluate (quick)',
    system,
    user,
    maxTokens: 4096,
  });
  const raw = extractJson<QuickRawResult>(r.text);

  const criteria = mergeCriteria(raw.criteria.map((c) => ({ ...c, suggestions: [] })));
  return {
    overallScore: weightedAverage(criteria),
    criteria,
    topIssues: (raw.topIssues ?? []).slice(0, 3),
    model: r.model,
    latencyMs: r.latencyMs,
  };
}

export interface DetailedEvaluation {
  overallScore: number;
  criteria: CriterionScore[];
  topIssues: string[];
  sectionRevisions: SectionRevision[];
  model: string;
  latencyMs: number;
  /** Truyền sang generateExtras() — abstract + key contributions. */
  abstractText: string;
}

export async function evaluateDetailed(
  userId: string,
  paper: PaperDoc,
): Promise<DetailedEvaluation> {
  const start = Date.now();

  // Step 1: per-section summary parallel.
  const limit = pLimit(CLAUDE_PARALLELISM);
  const sectionsToSummarize = paper.sections.filter((s) => s.text.length >= 200);

  const summaryResults = await Promise.all(
    sectionsToSummarize.map((s) =>
      limit(async (): Promise<{ summary: SectionSummary; model: string }> => {
        const { system, user } = buildSectionSummaryPrompt({
          sectionKey: s.key,
          heading: s.heading,
          text: s.text,
          field: paper.field,
        });
        const r = await runClaude({
          userId,
          route: 'POST /api/evaluate (section-summary)',
          system,
          user,
          maxTokens: 2048,
          // Section text đã đủ dài (>=200 chars); skip min-length check tránh
          // false-positive khi system prompt ngắn.
          skipMinLengthCheck: true,
        });
        const parsed = extractJson<{
          summary: string;
          claims: string[];
          evidence: string[];
          weaknesses: string[];
        }>(r.text);
        return {
          summary: {
            sectionKey: s.key,
            heading: s.heading,
            summary: parsed.summary ?? '',
            claims: parsed.claims ?? [],
            evidence: parsed.evidence ?? [],
            weaknesses: parsed.weaknesses ?? [],
          },
          model: r.model,
        };
      }),
    ),
  );

  const summaries = summaryResults.map((r) => r.summary);

  // Step 2: aggregate.
  const { system, user } = buildDetailedAggregatePrompt({
    summaries,
    targetTier: paper.targetTier,
    field: paper.field,
    journalName: paper.journalName,
  });
  const aggR = await runClaude({
    userId,
    route: 'POST /api/evaluate (detailed-aggregate)',
    system,
    user,
    maxTokens: 8192,
    skipMinLengthCheck: true,
  });
  const raw = extractJson<DetailedRawResult>(aggR.text);

  const criteria = mergeCriteria(raw.criteria);
  const sectionRevisions = (raw.sectionRevisions ?? [])
    .filter((r) => SECTION_KEYS.includes(r.sectionKey as SectionKey))
    .map<SectionRevision>((r) => ({
      sectionKey: r.sectionKey as SectionKey,
      issue: r.issue,
      suggestion: r.suggestion,
    }));

  const abstractText =
    findSection(paper.sections, 'abstract')?.text ?? paper.content.slice(0, 2000);

  return {
    overallScore: weightedAverage(criteria),
    criteria,
    topIssues: raw.topIssues ?? [],
    sectionRevisions,
    model: aggR.model,
    latencyMs: Date.now() - start,
    abstractText,
  };
}

// =============================================================================
// Extras (cover letter + related papers + acceptance probability) — chạy
// parallel sau detailed evaluation. Lỗi 1 cái KHÔNG block các cái khác.
// =============================================================================

export interface ExtrasResult {
  coverLetter: string | null;
  relatedPapers: RelatedPaper[] | null;
  acceptanceProbability: AcceptanceProbability | null;
}

export async function generateExtras(
  userId: string,
  paper: PaperDoc,
  detailed: DetailedEvaluation,
): Promise<ExtrasResult> {
  const common = {
    paperTitle: paper.title,
    abstract: detailed.abstractText,
    field: paper.field,
    targetTier: paper.targetTier,
    journalName: paper.journalName,
  };
  const topContributions = detailed.criteria
    .filter((c) => c.score >= 4)
    .map((c) => c.comment)
    .slice(0, 3);
  const contribs = topContributions.length
    ? topContributions
    : detailed.criteria.slice(0, 3).map((c) => c.comment);

  const limit = pLimit(CLAUDE_PARALLELISM);

  const [letter, related, prob] = await Promise.all([
    limit(() =>
      callExtra<CoverLetterRaw>(
        userId,
        'cover-letter',
        buildCoverLetterPrompt({ ...common, topContributions: contribs }),
        4096,
      ),
    ),
    limit(() =>
      callExtra<RelatedPapersRaw>(
        userId,
        'related-papers',
        buildRelatedPapersPrompt(common),
        4096,
      ),
    ),
    limit(() =>
      callExtra<AcceptanceRaw>(
        userId,
        'acceptance-prob',
        buildAcceptanceProbPrompt({
          ...common,
          criteria: detailed.criteria,
          topIssues: detailed.topIssues,
        }),
        1024,
      ),
    ),
  ]);

  return {
    coverLetter: letter ? letter.coverLetter : null,
    relatedPapers: related
      ? related.papers.map<RelatedPaper>((p) => ({
          title: p.title,
          authors: p.authors,
          year: p.year,
          venue: p.venue,
          doi: p.doi ?? null,
          bibtex: p.bibtex,
          reasonToCite: p.reasonToCite,
        }))
      : null,
    acceptanceProbability: prob
      ? {
          estimate: clamp(prob.estimate, 0, 100),
          ci95: [clamp(prob.ci95?.[0] ?? 0, 0, 100), clamp(prob.ci95?.[1] ?? 0, 0, 100)],
          rationale: prob.rationale ?? '',
          disclaimer:
            prob.disclaimer ??
            'Rough AI estimate, not authoritative. Editorial decisions depend on many factors.',
        }
      : null,
  };
}

async function callExtra<T>(
  userId: string,
  tag: string,
  prompt: { system: string; user: string },
  maxTokens: number,
): Promise<T | null> {
  try {
    const r = await runClaude({
      userId,
      route: `POST /api/extras (${tag})`,
      system: prompt.system,
      user: prompt.user,
      maxTokens,
      skipMinLengthCheck: true,
    });
    return extractJson<T>(r.text);
  } catch (e) {
    // Extras là best-effort — log và trả null thay vì làm fail toàn bộ flow.
    console.error(`extras.${tag} failed`, e);
    return null;
  }
}

// =============================================================================
// Helpers
// =============================================================================

function pickQuickSlices(paper: PaperDoc): string {
  const wanted: SectionKey[] = ['abstract', 'introduction', 'conclusion'];
  const parts = wanted
    .map((k) => findSection(paper.sections, k))
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((s) => `## ${s.key.toUpperCase()} — ${s.heading}\n${s.text}`);
  if (parts.length >= 2) return parts.join('\n\n');
  // Fallback: lấy 8K ký tự đầu (~2K tokens).
  return paper.content.slice(0, 8000);
}

function mergeCriteria(
  raw: { criterionId: string; score: number; comment: string; suggestions: string[] }[],
): CriterionScore[] {
  return SCOPUS_CRITERIA.map((c) => {
    const found = raw.find((r) => r.criterionId === c.id);
    return {
      criterionId: c.id,
      criterionName: c.name,
      weight: c.weight,
      score: clamp(Math.round(found?.score ?? 3), 1, 5),
      comment: found?.comment ?? '',
      suggestions: found?.suggestions ?? [],
    };
  });
}

function weightedAverage(criteria: CriterionScore[]): number {
  const total = criteria.reduce((s, c) => s + c.score * c.weight, 0);
  const weights = criteria.reduce((s, c) => s + c.weight, 0);
  return Math.round((total / Math.max(1, weights)) * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Re-export getCriterion for callers if needed (UI label lookup).
export { getCriterion };
