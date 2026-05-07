import 'server-only';
import { cookies } from 'next/headers';
import { adminAuth } from './firebase-admin';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE_MS,
} from './constants';
import type { AuthUser } from './types';

// =============================================================================
// UAE18 auth helpers — server-side. Pattern Firebase ID token -> session
// cookie httpOnly Lax 14 days. Source of truth là cookie, không phải client
// SDK state.
// =============================================================================

/**
 * Mint a session cookie từ Firebase ID token. Gọi trong route handler
 * `POST /api/auth/session` sau khi `verifyIdToken` thành công.
 */
export async function mintSessionCookie(idToken: string): Promise<string> {
  return adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_COOKIE_MAX_AGE_MS,
  });
}

/**
 * Verify session cookie. `checkRevoked: true` đảm bảo nếu user đã bị
 * sign-out toàn cục (revoke refresh token) thì cookie cũ không còn dùng được.
 */
export async function verifySessionCookie(value: string) {
  return adminAuth().verifySessionCookie(value, true);
}

/**
 * Resolve current user từ cookie `__session`. Trả null khi cookie thiếu /
 * hết hạn / bị revoke. Server components dùng helper này rồi
 * `redirect('/login')` nếu null; route handlers dùng `requireAuth()`.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookie = cookies().get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await verifySessionCookie(cookie);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded.name as string | undefined) ?? null,
      picture: (decoded.picture as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Require auth trong route handler. Throw Error có `code: 'UNAUTHENTICATED'`
 * để route convert thành 401. Lưu ý dùng try/catch và check `(e as any).code`
 * trong route handler — đừng để 401 leak thành 500.
 */
export async function requireAuth(): Promise<AuthUser> {
  const u = await getCurrentUser();
  if (!u) {
    const e = new Error('Bạn cần đăng nhập để thực hiện thao tác này.');
    (e as Error & { code: string }).code = 'UNAUTHENTICATED';
    throw e;
  }
  return u;
}
