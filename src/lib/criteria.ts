// =============================================================================
// Scopus 7-criterion rubric. Source: dùng làm sàn quốc tế cho UAE18, KHÔNG
// theo chuẩn Bộ GD VN. Weight tổng = 100%.
// =============================================================================

import type { TargetTier } from './constants';

export interface ScopusCriterion {
  id: string;
  name: string;
  /** % trọng số trong tổng điểm (số nguyên). */
  weight: number;
  /** Mô tả ngắn dùng cho prompt + UI. */
  description: string;
  /** Các câu hỏi rubric — tham chiếu trong prompt để Claude bám vào. */
  rubricQuestions: string[];
}

export const SCOPUS_CRITERIA: readonly ScopusCriterion[] = [
  {
    id: 'originality',
    name: 'Originality & Novelty',
    weight: 15,
    description:
      'Does the paper present a new contribution that is genuinely different from prior work?',
    rubricQuestions: [
      'Is the contribution novel relative to the cited literature?',
      'Are the claims of novelty supported with concrete evidence?',
      'Does the work advance the field rather than incrementally repeat prior studies?',
    ],
  },
  {
    id: 'research_question',
    name: 'Research Question & Hypothesis',
    weight: 10,
    description:
      'Are the research questions and hypotheses well-formulated, falsifiable, and clearly scoped?',
    rubricQuestions: [
      'Is the research question explicit and answerable?',
      'Are hypotheses (where applicable) testable and falsifiable?',
      'Is the scope appropriate — neither too narrow nor too broad?',
    ],
  },
  {
    id: 'methodology',
    name: 'Methodology',
    weight: 20,
    description:
      'Is the methodology rigorous, appropriate, reproducible, and well-justified?',
    rubricQuestions: [
      'Is the chosen method appropriate for the research question?',
      'Are sample size, controls, statistical tests, and validity threats handled?',
      'Is the method reproducible from the description alone?',
    ],
  },
  {
    id: 'results',
    name: 'Results & Analysis',
    weight: 15,
    description:
      'Are the results clearly presented, correctly analyzed, and supported by the data?',
    rubricQuestions: [
      'Are results presented with appropriate tables/figures and statistics?',
      'Do the conclusions follow from the data without overreach?',
      'Are limitations and alternative explanations discussed?',
    ],
  },
  {
    id: 'literature',
    name: 'Literature Review & References',
    weight: 15,
    description:
      'Does the paper situate itself in the literature with up-to-date, high-quality citations?',
    rubricQuestions: [
      'Are key recent works (last 3-5 years) cited?',
      'Is the citation density appropriate (typically 30-60 for Scopus papers)?',
      'Are the citations from reputable Scopus/WoS-indexed venues?',
    ],
  },
  {
    id: 'writing',
    name: 'Writing Quality',
    weight: 15,
    description:
      'Is the manuscript well-organized, clearly written, and free of language issues?',
    rubricQuestions: [
      'Is academic English clear and grammatically correct?',
      'Are sections logically structured (IMRAD or equivalent)?',
      'Are abstract, figures captions, and tables self-contained?',
    ],
  },
  {
    id: 'fit',
    name: 'Journal Fit & Impact',
    weight: 10,
    description:
      'Does the paper fit the target journal scope and have potential impact at that tier?',
    rubricQuestions: [
      'Does the topic align with the target journal scope and recent issues?',
      'Is the contribution significant enough for the target Q-tier?',
      'Does the paper follow the journal’s formatting and style expectations?',
    ],
  },
] as const;

export const TOTAL_WEIGHT = SCOPUS_CRITERIA.reduce(
  (s, c) => s + c.weight,
  0,
);

if (TOTAL_WEIGHT !== 100) {
  // Fail fast — rubric weight phải = 100% để overallScore tính đúng.
  throw new Error(
    `Scopus rubric weights must sum to 100, got ${TOTAL_WEIGHT}`,
  );
}

/**
 * Strictness instruction cho Claude theo Q-tier. Q1 = strict, Q4 = lenient.
 * Áp dụng vào prompt hệ thống — KHÔNG đổi rubric, chỉ đổi ngưỡng đánh giá.
 */
export function tierStrictnessGuide(tier: TargetTier): string {
  switch (tier) {
    case 'Q1':
      return [
        'Apply the strictest standards. Q1 journals (top 25% by impact) reject papers with',
        'incremental novelty, weak methodology, or limited theoretical contribution. Score ≥4',
        'only if the paper genuinely meets the bar of top international venues. A score of 3 means',
        'the paper is publishable in a lower tier but not Q1.',
      ].join(' ');
    case 'Q2':
      return [
        'Apply rigorous standards. Q2 journals (25-50%) require solid methodology, clear',
        'contribution, and competent writing. Score ≥4 indicates strong paper; 3 indicates',
        'borderline that needs major revision; ≤2 indicates rejection-level issues.',
      ].join(' ');
    case 'Q3':
      return [
        'Apply moderate standards. Q3 journals (50-75%) accept solid but not breakthrough work.',
        'Score ≥4 if the paper is competent and contributes something useful; 3 if it has',
        'fixable issues; ≤2 if there are fundamental flaws.',
      ].join(' ');
    case 'Q4':
      return [
        'Apply baseline standards. Q4 journals (75-100%) accept work that is technically correct',
        'and adds incremental value. Score ≥4 for a competent paper; 3 for needs-revision but',
        'salvageable; ≤2 for fundamentally broken.',
      ].join(' ');
  }
}

export function getCriterion(id: string): ScopusCriterion {
  const c = SCOPUS_CRITERIA.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown criterion id: ${id}`);
  return c;
}
