"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { getClientAuth, onAuthStateChanged, signOut, consumeRedirect } from "@/lib/firebase";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  refreshAdmin: () => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  isAdmin: false,
  refreshAdmin: async () => {},
  logout: async () => {},
  getIdToken: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    try {
      const auth = getClientAuth();
      // Pick up sign-in results that completed via redirect (Cloud Shell,
      // mobile webviews, etc.) before wiring up the listener.
      void consumeRedirect();
      cleanup = onAuthStateChanged(auth, async (u) => {
        setUser(u);
        setLoading(false);
        if (u) await checkAdmin(u);
        else setIsAdmin(false);
      });
    } catch {
      setLoading(false);
    }
    return () => cleanup?.();
  }, []);

  async function checkAdmin(u: User) {
    try {
      const token = await u.getIdToken();
      const res = await fetch("/api/admin/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setIsAdmin(Boolean(data.isAdmin));
    } catch {
      setIsAdmin(false);
    }
  }

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      isAdmin,
      refreshAdmin: async () => { if (user) await checkAdmin(user); },
      logout: async () => { await signOut(); setIsAdmin(false); },
      getIdToken: async () => (user ? await user.getIdToken() : null),
    }),
    [user, loading, isAdmin],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
