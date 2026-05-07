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
