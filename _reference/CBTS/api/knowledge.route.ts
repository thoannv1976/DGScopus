import { NextRequest, NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/firebaseAdmin";
import type { KnowledgeEntry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const snap = await adminDb().collection("knowledge").orderBy("updatedAt", "desc").limit(500).get();
  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<KnowledgeEntry, "id">) }));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as Partial<KnowledgeEntry>;
  if (!body.title || !body.content) {
    return NextResponse.json({ error: "Cần nhập tiêu đề và nội dung" }, { status: 400 });
  }
  const now = Date.now();
  const doc = {
    title: String(body.title).slice(0, 500),
    category: String(body.category || "Tổng quát").slice(0, 100),
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 30).map((t) => String(t).slice(0, 60)) : [],
    content: String(body.content).slice(0, 200_000),
    source: body.source ? String(body.source).slice(0, 1000) : null,
    fileUrl: body.fileUrl ? String(body.fileUrl).slice(0, 1000) : null,
    createdAt: now,
    updatedAt: now,
    createdBy: admin.uid,
  };
  const ref = await adminDb().collection("knowledge").add(doc);
  return NextResponse.json({ id: ref.id, ...doc });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json()) as Partial<KnowledgeEntry> & { id?: string };
  if (!body.id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  const ref = adminDb().collection("knowledge").doc(body.id);
  const update: Record<string, unknown> = { updatedAt: Date.now() };
  for (const k of ["title", "category", "content", "tags", "source", "fileUrl"] as const) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  await ref.set(update, { merge: true });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  await adminDb().collection("knowledge").doc(id).delete();
  return NextResponse.json({ ok: true });
}
