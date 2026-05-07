import type { Field, TargetTier } from '../constants';
import type { CriterionScore } from '../types';

// =============================================================================
// "Extras" = cover letter draft + related papers (BibTeX) + acceptance prob.
// Mỗi extra là 1 Claude call riêng — chạy parallel sau detailed aggregate.
// =============================================================================

interface CommonArgs {
  paperTitle: string;
  abstract: string;
  field: Field;
  targetTier: TargetTier;
  journalName: string | null;
}

export function buildCoverLetterPrompt(
  args: CommonArgs & { topContributions: string[] },
): { system: string; user: string } {
  const system =
    'You are an academic writing coach. Draft a professional cover letter to a journal editor. ' +
    'Output ONLY JSON: { "coverLetter": "<full letter, plain text, English>" }.';

  const journal = args.journalName ?? `a ${args.targetTier} journal in ${args.field}`;

  const user = `Draft a cover letter for the manuscript below, addressed to the Editor of ${journal}.

Constraints:
- 250-350 words
- Plain text, no markdown, no placeholders like [Your Name]
- Use neutral salutation "Dear Editor" — sender block can use "Sincerely,\\nThe Authors"
- Mention 2-3 key contributions and why they fit the journal
- Confirm originality, no concurrent submission, no conflicts of interest

Return ONLY: { "coverLetter": "<full letter>" }

Manuscript title: ${args.paperTitle}
Field: ${args.field}
Target tier: ${args.targetTier}

Key contributions to highlight:
${args.topContributions.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Abstract:
"""
${args.abstract}
"""`;

  return { system, user };
}

export function buildRelatedPapersPrompt(args: CommonArgs): {
  system: string;
  user: string;
} {
  const system =
    'You are a research librarian familiar with Scopus-indexed venues. ' +
    'Suggest closely related published papers the author should cite. ' +
    'Output ONLY the requested JSON object. ' +
    'IMPORTANT: only suggest papers you are confident actually exist; do NOT fabricate DOIs. ' +
    'If you are unsure, set "doi" to null.';

  const user = `Suggest 5-10 closely related, published papers the author of the manuscript below should consider citing.

Field: ${args.field}
Target tier: ${args.targetTier}
Journal: ${args.journalName ?? 'unspecified'}
Title: ${args.paperTitle}

Abstract:
"""
${args.abstract}
"""

For EACH suggestion, provide a plausible BibTeX entry. Do NOT invent DOIs — leave as null when uncertain.

Return ONLY this JSON:
{
  "papers": [
    {
      "title": "<paper title>",
      "authors": "<authors, AP style>",
      "year": <YYYY>,
      "venue": "<journal/conf name>",
      "doi": "<doi or null>",
      "bibtex": "@article{key, title={...}, author={...}, year={...}, journal={...}}",
      "reasonToCite": "<one sentence>"
    }
  ]
}`;

  return { system, user };
}

export function buildAcceptanceProbPrompt(
  args: CommonArgs & { criteria: CriterionScore[]; topIssues: string[] },
): { system: string; user: string } {
  const system =
    'You are a peer-review strategist. Estimate acceptance probability based on rubric scores ' +
    'and known issues. Be honest — most manuscripts at first submission need major revision. ' +
    'Output ONLY the requested JSON.';

  const scoreList = args.criteria
    .map((c) => `- ${c.criterionName} (${c.weight}%): ${c.score}/5`)
    .join('\n');

  const user = `Estimate acceptance probability at the target venue.

Field: ${args.field}
Target tier: ${args.targetTier}
Journal: ${args.journalName ?? `(${args.targetTier} tier, unspecified)`}

Rubric scores:
${scoreList}

Top issues:
${args.topIssues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

Calibration:
- Q1 first submission baseline ≈ 10-20% acceptance
- Q2 first submission baseline ≈ 25-40%
- Q3 first submission baseline ≈ 35-55%
- Q4 first submission baseline ≈ 45-65%
Adjust UP for strong rubric scores (≥4), DOWN for any score ≤2 or critical top issues.

Return ONLY this JSON:
{
  "estimate": <integer 0..100>,
  "ci95": [<lower 0..100>, <upper 0..100>],
  "rationale": "<2-3 sentences explaining the estimate>",
  "disclaimer": "This is a rough AI estimate based on rubric scores and visible issues, not an authoritative prediction. Real editorial decisions depend on reviewer fit, journal scope, novelty perception, and many factors not captured here."
}`;

  return { system, user };
}

export interface CoverLetterRaw {
  coverLetter: string;
}
export interface RelatedPapersRaw {
  papers: {
    title: string;
    authors: string;
    year: number;
    venue: string;
    doi: string | null;
    bibtex: string;
    reasonToCite: string;
  }[];
}
export interface AcceptanceRaw {
  estimate: number;
  ci95: [number, number];
  rationale: string;
  disclaimer: string;
}
