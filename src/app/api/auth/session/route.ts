import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth } from '@/lib/firebase-admin';
import { mintSessionCookie } from '@/lib/auth';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE_MS,
} from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SessionBody = z.object({
  idToken: z.string().min(20),
});

/**
 * POST /api/auth/session
 *
 * Đổi Firebase ID token (lấy từ signInWithPopup phía client) lấy session
 * cookie httpOnly. Cookie là source of truth phía server cho 14 ngày.
 */
export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = SessionBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Thiếu hoặc sai định dạng idToken.' },
        { status: 400 },
      );
    }

    // Reject ID token cũ hơn 5 phút — Firebase yêu cầu token mới để mint
    // session cookie, nhưng error mặc định khá tối nghĩa nên ta tự catch.
    const decoded = await adminAuth().verifyIdToken(parsed.data.idToken, true);
    const ageMs = Date.now() - decoded.auth_time * 1000;
    if (ageMs > 5 * 60 * 1000) {
      return NextResponse.json(
        { error: 'ID token quá cũ. Vui lòng đăng nhập lại.' },
        { status: 401 },
      );
    }

    const sessionCookie = await mintSessionCookie(parsed.data.idToken);

    const res = NextResponse.json({ ok: true, uid: decoded.uid });
    res.cookies.set({
      name: SESSION_COOKIE,
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_COOKIE_MAX_AGE_MS / 1000),
    });
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('POST /api/auth/session failed', e);
    return NextResponse.json(
      { error: `Không xác minh được ID token: ${msg}` },
      { status: 401 },
    );
  }
}

/**
 * DELETE /api/auth/session
 *
 * Sign-out. Chỉ xoá cookie phía server; KHÔNG `revokeRefreshTokens` để
 * thiết bị khác của user vẫn giữ session. Nếu cần "log out everywhere",
 * tách thành endpoint riêng.
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
