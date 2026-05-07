import { SCOPUS_CRITERIA, tierStrictnessGuide } from '../criteria';
import type { Field, SectionKey, TargetTier } from '../constants';

// =============================================================================
// Detailed mode = 2-step pipeline:
//   Step 1 (parallel): summarize each section (claims, evidence, weaknesses).
//   Step 2 (single):   aggregate summaries into full 7-criterion report.
// =============================================================================

export function buildSectionSummaryPrompt(args: {
  sectionKey: SectionKey;
  heading: string;
  text: string;
  field: Field;
}): { system: string; user: string } {
  const system =
    'You are a senior peer reviewer. Read one section of a manuscript and extract its essence. ' +
    'Respond ONLY with the requested JSON object.';

  const user = `Summarize this manuscript section for downstream review aggregation.

Section: ${args.sectionKey} ("${args.heading}")
Field: ${args.field}

Return JSON:
{
  "summary": "<3-5 sentences capturing the section's main content>",
  "claims": ["<key claim 1>", "<key claim 2>", ...],
  "evidence": ["<evidence/data backing claims>", ...],
  "weaknesses": ["<methodological or argumentative weakness>", ...]
}

SECTION TEXT:
"""
${args.text}
"""`;

  return { system, user };
}

export interface SectionSummary {
  sectionKey: SectionKey;
  heading: string;
  summary: string;
  claims: string[];
  evidence: string[];
  weaknesses: string[];
}

export function buildDetailedAggregatePrompt(args: {
  summaries: SectionSummary[];
  targetTier: TargetTier;
  field: Field;
  journalName: string | null;
}): { system: string; user: string } {
  const rubric = SCOPUS_CRITERIA.map(
    (c) =>
      `- id="${c.id}" name="${c.name}" weight=${c.weight}%\n    rubric:\n` +
      c.rubricQuestions.map((q) => `      • ${q}`).join('\n'),
  ).join('\n');

  const sectionsBlock = args.summaries
    .map(
      (s) =>
        `### ${s.sectionKey} — ${s.heading}\n` +
        `Summary: ${s.summary}\n` +
        (s.claims.length ? `Claims: ${s.claims.join('; ')}\n` : '') +
        (s.evidence.length ? `Evidence: ${s.evidence.join('; ')}\n` : '') +
        (s.weaknesses.length ? `Weaknesses: ${s.weaknesses.join('; ')}\n` : ''),
    )
    .join('\n');

  const journalLine = args.journalName
    ? `Target journal: "${args.journalName}" (assume ${args.targetTier} tier).`
    : `Target tier: ${args.targetTier}.`;

  const system =
    'You are a senior Scopus peer reviewer. Be rigorous, specific, and actionable. ' +
    'Respond ONLY with the requested JSON. All free-text fields must be in English.';

  const user = `Synthesize the per-section summaries below into a full peer-review report.

Field: ${args.field}
${journalLine}

Strictness guide:
${tierStrictnessGuide(args.targetTier)}

Rubric:
${rubric}

For each criterion: give an integer score 1..5, a 2-3 sentence comment that references concrete content in the summaries, and 2-3 actionable suggestions.
Then provide:
- topIssues: 3-6 ranked critical issues that would block acceptance.
- sectionRevisions: 3-8 section-level revisions, each pointing to ONE section by sectionKey
  (one of: abstract, introduction, methods, results, discussion, conclusion, references).

Return ONLY this JSON:
{
  "criteria": [
    {
      "criterionId": "<id>",
      "score": <1..5>,
      "comment": "<2-3 sentences>",
      "suggestions": ["<actionable suggestion>", ...]
    }
  ],
  "topIssues": ["<issue 1>", ...],
  "sectionRevisions": [
    { "sectionKey": "<key>", "issue": "<what's wrong>", "suggestion": "<concrete fix>" }
  ]
}

SECTION SUMMARIES:
${sectionsBlock}`;

  return { system, user };
}

export interface DetailedRawResult {
  criteria: {
    criterionId: string;
    score: number;
    comment: string;
    suggestions: string[];
  }[];
  topIssues: string[];
  sectionRevisions: { sectionKey: string; issue: string; suggestion: string }[];
}
