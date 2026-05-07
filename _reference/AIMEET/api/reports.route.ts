import { NextRequest, NextResponse } from "next/server";
import { COL, getDb } from "@/lib/firebase";
import { generateReport } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const snap = await db.collection(COL.reports).orderBy("createdAt", "desc").limit(100).get();
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { title, periodLabel, taskIds, meetingIds } = body || {};

  const db = getDb();
  // Resolve tasks
  let tasks: any[] = [];
  if (Array.isArray(taskIds) && taskIds.length) {
    const refs = taskIds.map((id: string) => db.collection(COL.tasks).doc(id));
    const docs = await db.getAll(...refs);
    tasks = docs.filter((d) => d.exists).map((d) => ({ id: d.id, ...d.data() }));
  } else {
    const snap = await db.collection(COL.tasks).limit(500).get();
    tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  let meetings: any[] = [];
  if (Array.isArray(meetingIds) && meetingIds.length) {
    const refs = meetingIds.map((id: string) => db.collection(COL.meetings).doc(id));
    const docs = await db.getAll(...refs);
    meetings = docs
      .filter((d) => d.exists)
      .map((d) => {
        const data: any = d.data();
        return { title: data.title, summary: data.summary, date: data.date };
      });
  }

  const content = await generateReport({
    meetings,
    tasks: tasks.map((t) => ({
      title: t.title,
      status: t.status,
      assignee: t.assignee,
      dueDate: t.dueDate,
      priority: t.priority,
      description: t.description,
      progress: t.progress,
    })),
    periodLabel,
  });

  const now = new Date().toISOString();
  const ref = db.collection(COL.reports).doc();
  const report = {
    title: title || `Báo cáo ${new Date().toLocaleDateString("vi-VN")}`,
    periodLabel: periodLabel || "",
    content,
    taskIds: tasks.map((t) => t.id),
    meetingIds: Array.isArray(meetingIds) ? meetingIds : [],
    createdAt: now,
  };
  await ref.set(report);
  return NextResponse.json({ id: ref.id, ...report });
}
