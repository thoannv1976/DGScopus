import { NextRequest, NextResponse } from "next/server";
import { COL, getDb } from "@/lib/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getDb();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const meetingId = url.searchParams.get("meetingId");
  const assignee = url.searchParams.get("assignee");

  let q: FirebaseFirestore.Query = db.collection(COL.tasks);
  if (status) q = q.where("status", "==", status);
  if (meetingId) q = q.where("meetingId", "==", meetingId);
  if (assignee) q = q.where("assignee", "==", assignee);

  const snap = await q.limit(500).get();
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Sort client-side to avoid composite index requirements
  items.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  const now = new Date().toISOString();
  const ref = db.collection(COL.tasks).doc();
  const data = {
    title: String(body.title || "").trim() || "Công việc",
    description: body.description || "",
    assignee: body.assignee || "",
    dueDate: body.dueDate || "",
    priority: ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium",
    status: ["todo", "in_progress", "done", "cancelled"].includes(body.status) ? body.status : "todo",
    progress: typeof body.progress === "number" ? Math.max(0, Math.min(100, body.progress)) : 0,
    meetingId: body.meetingId || "",
    reminderAt: body.reminderAt || (body.dueDate ? `${body.dueDate}T09:00:00.000Z` : ""),
    reminded: false,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(data);
  return NextResponse.json({ id: ref.id, ...data });
}
