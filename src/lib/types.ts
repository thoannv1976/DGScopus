// =============================================================================
// Shared TypeScript types. Mở rộng theo domain của app cụ thể (vd: thêm
// TextbookDoc cho textbook-review, MeetingDoc cho aimeet...).
// =============================================================================

export interface AuthUser {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

// Mọi document Firestore của UAE18 đều có 4 trường gốc này.
export interface OwnedDoc {
  id?: string;
  ownerId: string;
  createdAt?: string; // ISO string, server-generated
  updatedAt?: string;
}

export interface UsageLogDoc extends OwnedDoc {
  // Lưu ý: usage_logs dùng `userId` thay vì `ownerId` để khớp rules
  // (immutable audit log). Khi tạo doc, set cả ownerId === userId.
  userId: string;
  route: string; // vd: 'POST /api/evaluate'
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  latencyMs?: number;
  status: 'ok' | 'error';
  errorCode?: string;
}

// Tiện cho route handlers / SSE.
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; status?: number };

// =============================================================================
// DGScopus domain
// =============================================================================

import type { Field, ReviewMode, SectionKey, TargetTier } from './constants';

export interface PaperSection {
  key: SectionKey;
  heading: string;
  text: string;
}

export interface PaperDoc extends OwnedDoc {
  title: string;
  /** Plain text trích từ DOCX/PDF/TXT, đã trim. */
  content: string;
  sections: PaperSection[];
  targetTier: TargetTier;
  /** Nếu user nhập tên journal cụ thể; null nếu chỉ chọn Q-tier. */
  journalName: string | null;
  field: Field;
  /** Số ký tự content — tiện cho UI hiển thị + rate-limit logic. */
  charCount: number;
}

export interface CriterionScore {
  criterionId: string;
  criterionName: string;
  weight: number;
  score: number; // 1..5
  comment: string;
  suggestions: string[];
}

export interface SectionRevision {
  sectionKey: SectionKey;
  issue: string;
  suggestion: string;
}

export interface RelatedPaper {
  title: string;
  authors: string;
  year: number;
  venue: string;
  doi: string | null;
  bibtex: string;
  reasonToCite: string;
}

export interface AcceptanceProbability {
  /** 0..100 */
  estimate: number;
  /** Khoảng tin cậy 95%, hai số 0..100. */
  ci95: [number, number];
  rationale: string;
  disclaimer: string;
}

export interface EvaluationDoc extends OwnedDoc {
  paperId: string;
  mode: ReviewMode;
  targetTier: TargetTier;
  field: Field;
  journalName: string | null;
  /** 1..5, weighted average. */
  overallScore: number;
  criteria: CriterionScore[];
  topIssues: string[];
  /** Chỉ điền cho detailed mode. */
  sectionRevisions?: SectionRevision[];
  coverLetter?: string;
  relatedPapers?: RelatedPaper[];
  acceptanceProbability?: AcceptanceProbability;
  model: string;
  /** Latency tổng (ms). */
  latencyMs: number;
}
