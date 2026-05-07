import 'server-only';
import {
  initializeApp,
  getApps,
  cert,
  applicationDefault,
  type App,
} from 'firebase-admin/app';
import { getFirestore, type Firestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

let _app: App | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;

function buildApp(): App {
  if (_app) return _app;
  if (getApps().length) {
    _app = getApps()[0];
    return _app;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  // Path 1: service account JSON dán nguyên 1 dòng vào env (quy ước UAE18).
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    let credentials;
    try {
      credentials = JSON.parse(saJson);
    } catch (e) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON không phải JSON hợp lệ. Kiểm tra .env.local đã escape dấu " thành \\" trong private_key chưa.',
      );
    }
    _app = initializeApp({
      credential: cert(credentials),
      projectId,
      storageBucket: bucket,
    });
    return _app;
  }

  // Path 2: GOOGLE_APPLICATION_CREDENTIALS hoặc workload identity (Cloud Run).
  _app = initializeApp({
    credential: applicationDefault(),
    projectId,
    storageBucket: bucket,
  });
  return _app;
}

export function adminDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(buildApp());
  // Tolerate undefined fields trong payload — Firestore mặc định sẽ reject.
  _db.settings({ ignoreUndefinedProperties: true });
  return _db;
}

export function adminAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(buildApp());
  return _auth;
}

export function adminBucket() {
  return getStorage(buildApp()).bucket();
}

export { FieldValue };
