// Client-side Firebase singletons. Chỉ dùng trong `'use client'` components.
// MUST NOT import firebase-admin (package khác hẳn, server-only).

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  inMemoryPersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _appCheckReady = false;

export function clientApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  if (!_appCheckReady && typeof window !== 'undefined') {
    _appCheckReady = true;
    void initAppCheck(_app);
  }
  return _app;
}

async function initAppCheck(app: FirebaseApp) {
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (!siteKey) return;
  try {
    const { initializeAppCheck, ReCaptchaV3Provider } = await import(
      'firebase/app-check'
    );
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    // App Check là best-effort phía client — đừng crash sign-in vì nó.
    console.warn('App Check init failed', e);
  }
}

export function clientAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(clientApp());
  // Source of truth là server session cookie. SDK không cần persist
  // user state qua reload — tránh lệch giữa cookie và in-memory state.
  void setPersistence(_auth, inMemoryPersistence);
  return _auth;
}

export function googleProvider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  // UX: luôn cho user chọn account, tránh sticky session sai người.
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

export function clientDb(): Firestore {
  if (!_db) _db = getFirestore(clientApp());
  return _db;
}

export function clientStorage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(clientApp());
  return _storage;
}
