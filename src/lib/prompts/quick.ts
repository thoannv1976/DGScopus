import { SCOPUS_CRITERIA, tierStrictnessGuide } from '../criteria';
import type { Field, TargetTier } from '../constants';

interface QuickArgs {
  paperText: string;
  targetTier: TargetTier;
  field: Field;
  journalName: string | null;
}

export function buildQuickPrompt(args: QuickArgs): { system: string; user: string } {
  const rubric = SCOPUS_CRITERIA.map(
    (c) => `- ${c.id} (${c.name}, ${c.weight}%): ${c.description}`,
  ).join('\n');

  const journalLine = args.journalName
    ? `Target journal: "${args.journalName}" (assume ${args.targetTier} tier).`
    : `Target tier: ${args.targetTier} (no specific journal named).`;

  const system =
    'You are a senior peer reviewer for Scopus-indexed journals. Respond concisely in English. ' +
    'Output ONLY a JSON object that matches the requested schema — no prose, no markdown fences.';

  const user = `Perform a QUICK pre-submission review of the manuscript below.

Field: ${args.field}
${journalLine}

Strictness guide:
${tierStrictnessGuide(args.targetTier)}

Rubric (7 criteria, weights sum to 100):
${rubric}

For EACH criterion, give an integer score 1..5 (1 worst, 5 best) and a one-sentence comment.
Then list the TOP 3 ISSUES that would most likely cause rejection, ordered by severity.

Return ONLY this JSON:
{
  "criteria": [
    { "criterionId": "<id from rubric>", "score": <1..5>, "comment": "<≤25 words>" }
  ],
  "topIssues": ["<issue 1>", "<issue 2>", "<issue 3>"]
}

MANUSCRIPT:
"""
${args.paperText}
"""`;

  return { system, user };
}

export interface QuickRawResult {
  criteria: { criterionId: string; score: number; comment: string }[];
  topIssues: string[];
}
