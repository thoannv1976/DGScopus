import { NextRequest, NextResponse } from "next/server";
import { COL, FieldValue, getDb } from "@/lib/firebase";
import { extractTasksFromTranscript } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const snap = await db.collection(COL.meetings).orderBy("createdAt", "desc").limit(100).get();
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, transcript, date } = body || {};
  if (!transcript || typeof transcript !== "string") {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString();

  let summary = "";
  let extracted: Array<any> = [];
  try {
    const result = await extractTasksFromTranscript(transcript);
    summary = result.summary;
    extracted = result.tasks || [];
  } catch (err: any) {
    return NextResponse.json(
      { error: "AI extraction failed", detail: String(err?.message || err) },
      { status: 500 },
    );
  }

  const meetingRef = db.collection(COL.meetings).doc();
  const taskRefs: string[] = [];

  const batch = db.batch();
  for (const t of extracted) {
    const ref = db.collection(COL.tasks).doc();
    taskRefs.push(ref.id);
    batch.set(ref, {
      title: t.title || "Công việc",
      description: t.description || "",
      assignee: t.assignee || "",
      dueDate: t.dueDate || "",
      priority: ["low", "medium", "high"].includes(t.priority) ? t.priority : "medium",
      status: "todo",
      progress: 0,
      meetingId: meetingRef.id,
      reminderAt: t.dueDate ? `${t.dueDate}T09:00:00.000Z` : "",
      reminded: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  batch.set(meetingRef, {
    title: title || `Cuộc họp ${new Date(date || now).toLocaleString("vi-VN")}`,
    date: date || now,
    transcript,
    summary,
    taskIds: taskRefs,
    createdAt: now,
  });

  await batch.commit();

  return NextResponse.json({
    id: meetingRef.id,
    summary,
    taskIds: taskRefs,
    taskCount: taskRefs.length,
  });
}
