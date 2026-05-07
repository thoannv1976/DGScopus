import "server-only";
import { cert, getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

let adminApp: App | undefined;

function init(): App {
  if (adminApp) return adminApp;
  const existing = getApps();
  if (existing.length) {
    adminApp = existing[0]!;
    return adminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (clientEmail && privateKey && projectId) {
    adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  } else {
    // Application Default Credentials — works automatically on Google Cloud
    // (Cloud Run, App Hosting, Cloud Functions) where the service account is
    // attached at runtime.
    adminApp = initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }
  return adminApp;
}

export function adminDb(): Firestore {
  return getFirestore(init());
}

export function adminAuth(): Auth {
  return getAuth(init());
}

export async function verifyIdToken(token: string) {
  return adminAuth().verifyIdToken(token);
}

export async function isAdminUid(uid: string): Promise<boolean> {
  const doc = await adminDb().collection("admins").doc(uid).get();
  return doc.exists;
}

export async function isAdminEmail(email: string | undefined | null): Promise<boolean> {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/**
 * Authenticate an admin from the Authorization: Bearer <idToken> header.
 * Returns the decoded token if the user is an admin, otherwise null.
 */
export async function requireAdmin(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const decoded = await verifyIdToken(m[1]!);
    const allowed =
      (await isAdminUid(decoded.uid)) || (await isAdminEmail(decoded.email));
    if (!allowed) return null;

    // Auto-provision the admins/{uid} document on first successful login by
    // an allow-listed email so that Firestore rules grant access immediately.
    if (!(await isAdminUid(decoded.uid))) {
      await adminDb().collection("admins").doc(decoded.uid).set(
        {
          email: decoded.email || null,
          name: decoded.name || null,
          createdAt: Date.now(),
          source: "ADMIN_EMAILS",
        },
        { merge: true },
      );
    }
    return decoded;
  } catch {
    return null;
  }
}
