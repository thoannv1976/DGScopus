// =============================================================================
// UAE18 constants — single source of truth cho rate limit, file size, model.
// Tất cả code khác phải import từ đây thay vì hardcode magic strings.
// =============================================================================

export const APP_NAME =
  process.env.NEXT_PUBLIC_APP_NAME || 'DGScopus';

// ----- Claude / Anthropic -----
export const CLAUDE_MODEL =
  process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// Output cap an toàn — tăng nếu app cần response dài hơn (luôn nhỏ hơn cap
// thực tế của model để tránh truncation lỗi không rõ).
export const CLAUDE_MAX_TOKENS = 4096;

// ----- Rate limit -----
// Default sàn an toàn cho UAE18 app. App cụ thể có thể nâng qua env hoặc
// override cấu hình trong route handler.
export const RATE_LIMIT_PER_HOUR = Number(
  process.env.RATE_LIMIT_PER_HOUR ?? 5,
);
export const RATE_LIMIT_PER_DAY = Number(
  process.env.RATE_LIMIT_PER_DAY ?? 30,
);

// ----- Input validation -----
// Input ngắn hơn ngưỡng này gần như chắc chắn là user gõ nhầm; reject sớm
// để khỏi tốn 1 round-trip Claude.
export const MIN_CONTENT_LENGTH = 50;

// ----- Upload constraints -----
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
] as const;

export const SUPPORTED_FILE_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.txt',
  '.md',
] as const;

// ----- Auth / session -----
export const SESSION_COOKIE = '__session';
export const SESSION_COOKIE_MAX_AGE_DAYS = 14;
export const SESSION_COOKIE_MAX_AGE_MS =
  SESSION_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

// ----- Firestore collections -----
// Đổi tên app-specific khi cần (vd: 'textbooks', 'meetings'); usage_logs
// luôn giữ nguyên để cross-app queries dễ.
export const COL = {
  usageLogs: 'usage_logs',
  papers: 'papers',
  evaluations: 'evaluations',
} as const;

// ----- DGScopus domain enums -----
export const TARGET_TIERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export type TargetTier = (typeof TARGET_TIERS)[number];

export const FIELDS = [
  'Engineering',
  'Social Science',
  'Medicine',
  'Other',
] as const;
export type Field = (typeof FIELDS)[number];

export const REVIEW_MODES = ['quick', 'detailed'] as const;
export type ReviewMode = (typeof REVIEW_MODES)[number];

// Detailed mode tốn ~6-9 calls Claude → tính 3 quota; quick = 1 quota.
export const QUOTA_COST: Record<ReviewMode, number> = {
  quick: 1,
  detailed: 3,
};

// Paper section labels (Anh sẽ extract bằng heading regex; nếu không khớp,
// fallback whole-text vào IMRAD bucket).
export const SECTION_KEYS = [
  'abstract',
  'introduction',
  'methods',
  'results',
  'discussion',
  'conclusion',
  'references',
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

// p-limit concurrency cho parallel section calls (theo CLAUDE.md mục 7).
export const CLAUDE_PARALLELISM = 3;
