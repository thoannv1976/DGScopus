import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { adminDb, FieldValue } from './firebase-admin';
import {
  CLAUDE_MODEL,
  CLAUDE_MAX_TOKENS,
  COL,
  MIN_CONTENT_LENGTH,
  RATE_LIMIT_PER_DAY,
  RATE_LIMIT_PER_HOUR,
} from './constants';

// =============================================================================
// UAE18 Claude wrapper — xử lý 3 trách nhiệm cùng lúc:
//   1. Validate input (length >= MIN_CONTENT_LENGTH).
//   2. Rate limit per user (5/giờ + 30/ngày default, override qua env).
//   3. Log usage_logs (KHÔNG log nội dung user).
//
// Mọi route gọi Claude phải đi qua hàm `runClaude()` ở dưới — không tự
// `messages.create` trực tiếp.
// =============================================================================

let _client: Anthropic | null = null;

// Cap dưới App Hosting timeout 540s — để dư cho retries trong cùng request.
const REQUEST_TIMEOUT_MS = 240_000;
const MAX_RETRIES = 1;

function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');
  _client = new Anthropic({
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });
  return _client;
}

export interface RunClaudeOptions {
  userId: string;
  route: string; // vd: 'POST /api/evaluate'
  /** System prompt + user message; áp dụng template chuẩn Anthropic. */
  system: string;
  user: string;
  /** Override mặc định nếu cần (vd: aggregate call cần ít output). */
  maxTokens?: number;
  /** Skip validate length cho call internal (vd: aggregate đã sanitize). */
  skipMinLengthCheck?: boolean;
}

export interface RunClaudeResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  model: string;
}

/**
 * Gọi Claude an toàn. Throw Error có `.code` cho các lỗi user-facing:
 *   - 'INPUT_TOO_SHORT'
 *   - 'RATE_LIMITED'
 *   - 'CLAUDE_ERROR'
 * Route handler bắt + trả message tiếng Việt qua `describeClaudeError`.
 */
export async function runClaude(opts: RunClaudeOptions): Promise<RunClaudeResult> {
  // ----- 1. Validate input length -----
  if (!opts.skipMinLengthCheck && opts.user.trim().length < MIN_CONTENT_LENGTH) {
    const e = new Error(
      `Nội dung quá ngắn (cần >= ${MIN_CONTENT_LENGTH} ký tự).`,
    );
    (e as Error & { code: string }).code = 'INPUT_TOO_SHORT';
    throw e;
  }

  // ----- 2. Rate limit -----
  await assertWithinRateLimit(opts.userId);

  // ----- 3. Call Claude -----
  const start = Date.now();
  let result: RunClaudeResult;
  try {
    const resp = await client().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? CLAUDE_MAX_TOKENS,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    });

    const text = resp.content
      .filter((b) => b.type === 'text')
      .map((b: { type: string; text?: string }) => b.text ?? '')
      .join('\n');

    result = {
      text,
      tokensIn: resp.usage?.input_tokens ?? 0,
      tokensOut: resp.usage?.output_tokens ?? 0,
      latencyMs: Date.now() - start,
      model: resp.model,
    };

    await logUsage({ ...opts, ...result, status: 'ok' });
    return result;
  } catch (e: unknown) {
    await logUsage({
      ...opts,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: Date.now() - start,
      model: CLAUDE_MODEL,
      status: 'error',
      errorCode: extractErrorCode(e),
    });
    throw e;
  }
}

// =============================================================================
// Rate limit
// =============================================================================

async function assertWithinRateLimit(userId: string): Promise<void> {
  const db = adminDb();
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  // Một query trả 24h, đếm theo giờ ở client để đỡ index riêng.
  const snap = await db
    .collection(COL.usageLogs)
    .where('userId', '==', userId)
    .where('createdAt', '>=', dayAgo)
    .get();

  const dayCount = snap.size;
  const hourCount = snap.docs.filter(
    (d) => (d.data().createdAt as string) >= hourAgo,
  ).length;

  if (hourCount >= RATE_LIMIT_PER_HOUR) {
    const e = new Error(
      `Bạn đã vượt giới hạn ${RATE_LIMIT_PER_HOUR} lượt/giờ. Vui lòng thử lại sau ít phút.`,
    );
    (e as Error & { code: string }).code = 'RATE_LIMITED';
    throw e;
  }
  if (dayCount >= RATE_LIMIT_PER_DAY) {
    const e = new Error(
      `Bạn đã vượt giới hạn ${RATE_LIMIT_PER_DAY} lượt/ngày. Vui lòng thử lại sau 24h.`,
    );
    (e as Error & { code: string }).code = 'RATE_LIMITED';
    throw e;
  }
}

// =============================================================================
// Logging
// =============================================================================

interface LogUsageInput {
  userId: string;
  route: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  status: 'ok' | 'error';
  errorCode?: string;
}

async function logUsage(input: LogUsageInput): Promise<void> {
  try {
    const db = adminDb();
    await db.collection(COL.usageLogs).add({
      ...input,
      ownerId: input.userId, // alias để rules helper isOwner làm việc
      costUsd: estimateCost(input.tokensIn, input.tokensOut),
      createdAt: new Date().toISOString(),
      _serverTime: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    // Logging failure không nên crash route. Print và bỏ qua.
    console.error('logUsage failed (non-fatal)', e);
  }
}

/**
 * Cost estimate cho Sonnet 4.6: $3 / 1M input, $15 / 1M output (làm tròn).
 * Cập nhật khi giá Anthropic đổi hoặc app dùng model khác.
 */
function estimateCost(tokensIn: number, tokensOut: number): number {
  const inUsd = (tokensIn / 1_000_000) * 3;
  const outUsd = (tokensOut / 1_000_000) * 15;
  return Math.round((inUsd + outUsd) * 1_000_000) / 1_000_000;
}

// =============================================================================
// Error mapping
// =============================================================================

function extractErrorCode(e: unknown): string {
  const err = e as { name?: string; status?: number; code?: string };
  if (err?.code) return err.code;
  if (err?.status) return String(err.status);
  return err?.name ?? 'unknown';
}

/**
 * Translate Anthropic SDK errors → message tiếng Việt cho UI.
 * Route handler nên gọi hàm này trước khi trả response.
 */
export function describeClaudeError(e: unknown): string {
  const err = e as { name?: string; status?: number; message?: string; code?: string };
  const code = err?.code;
  if (code === 'INPUT_TOO_SHORT') {
    return err?.message ?? `Nội dung quá ngắn (cần >= ${MIN_CONTENT_LENGTH} ký tự).`;
  }
  if (code === 'RATE_LIMITED') {
    return err?.message ?? 'Bạn đã vượt giới hạn lượt sử dụng. Vui lòng thử lại sau.';
  }

  const name = err?.name || '';
  const status = err?.status;
  const msg = err?.message || '';

  if (name === 'APIConnectionTimeoutError' || /timeout/i.test(msg)) {
    return 'Anthropic API quá thời gian phản hồi. Vui lòng thử lại sau ít phút.';
  }
  if (name === 'APIConnectionError' || /connection error/i.test(msg)) {
    return 'Không kết nối được tới Anthropic API. Kiểm tra mạng/secret ANTHROPIC_API_KEY rồi thử lại.';
  }
  if (status === 401 || name === 'AuthenticationError') {
    return 'ANTHROPIC_API_KEY không hợp lệ hoặc đã hết hạn.';
  }
  if (status === 404 || name === 'NotFoundError') {
    return `Mô hình "${CLAUDE_MODEL}" không tồn tại hoặc tài khoản chưa được cấp quyền.`;
  }
  if (status === 429 || name === 'RateLimitError') {
    return 'Anthropic API đang giới hạn tốc độ. Vui lòng thử lại sau ít phút.';
  }
  if (status && status >= 500) {
    return 'Anthropic API đang gặp sự cố. Vui lòng thử lại sau ít phút.';
  }
  if (status === 400 || name === 'BadRequestError') {
    return `Yêu cầu Anthropic API không hợp lệ: ${extractApiErrorMessage(msg)}`;
  }
  return msg || 'Lỗi không xác định khi gọi Anthropic API.';
}

function extractApiErrorMessage(msg: string): string {
  const braceAt = msg.indexOf('{');
  if (braceAt < 0) return msg;
  try {
    const parsed = JSON.parse(msg.slice(braceAt));
    return parsed?.error?.message || msg;
  } catch {
    return msg;
  }
}

/**
 * Extract first balanced JSON object/array — tolerant với prose và ```json
 * fences. Dùng để parse output của Claude khi prompt yêu cầu JSON.
 */
export function extractJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;

  const start = candidate.search(/[\[{]/);
  if (start < 0) throw new Error('No JSON found in model output');

  let depth = 0;
  let inStr = false;
  let esc = false;
  const openCh = candidate[start];
  const closeCh = openCh === '{' ? '}' : ']';
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) {
        return JSON.parse(candidate.slice(start, i + 1)) as T;
      }
    }
  }
  throw new Error('Unbalanced JSON in model output');
}
