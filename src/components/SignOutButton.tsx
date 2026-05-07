'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase';

/**
 * Two-step sign-out: clear server cookie trước, sau đó drop SDK state.
 * Ngược thứ tự = user reload thấy client mất state nhưng cookie còn → confusing.
 */
export default function SignOutButton({
  className = 'btn-secondary',
}: {
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
      await signOut(clientAuth());
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <button className={className} onClick={onClick} disabled={busy}>
      {busy ? 'Đang đăng xuất...' : 'Đăng xuất'}
    </button>
  );
}
