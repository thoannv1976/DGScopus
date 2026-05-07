import 'server-only';
import { adminDb, FieldValue } from './firebase-admin';
import { COL } from './constants';
import type { EvaluationDoc, PaperDoc } from './types';

// =============================================================================
// Firestore CRUD cho papers + evaluations. Server-only — admin SDK bypass
// rules; client SDK chỉ dùng cho Auth/Storage.
// =============================================================================

function nowIso() {
  return new Date().toISOString();
}

export async function createPaper(
  ownerId: string,
  data: Omit<PaperDoc, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const db = adminDb();
  const ref = await db.collection(COL.papers).add({
    ...data,
    ownerId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    _serverTime: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function getPaper(
  ownerId: string,
  paperId: string,
): Promise<PaperDoc | null> {
  const db = adminDb();
  const doc = await db.collection(COL.papers).doc(paperId).get();
  if (!doc.exists) return null;
  const data = doc.data() as PaperDoc;
  if (data.ownerId !== ownerId) return null;
  return { ...data, id: doc.id };
}

export async function createEvaluation(
  ownerId: string,
  data: Omit<EvaluationDoc, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const db = adminDb();
  const ref = await db.collection(COL.evaluations).add({
    ...data,
    ownerId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    _serverTime: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function getEvaluation(
  ownerId: string,
  evalId: string,
): Promise<EvaluationDoc | null> {
  const db = adminDb();
  const doc = await db.collection(COL.evaluations).doc(evalId).get();
  if (!doc.exists) return null;
  const data = doc.data() as EvaluationDoc;
  if (data.ownerId !== ownerId) return null;
  return { ...data, id: doc.id };
}

export async function updateEvaluation(
  ownerId: string,
  evalId: string,
  patch: Partial<Omit<EvaluationDoc, 'id' | 'ownerId' | 'createdAt'>>,
): Promise<void> {
  const existing = await getEvaluation(ownerId, evalId);
  if (!existing) throw new Error('Evaluation not found or not owned by user');
  const db = adminDb();
  await db.collection(COL.evaluations).doc(evalId).update({
    ...patch,
    updatedAt: nowIso(),
  });
}
