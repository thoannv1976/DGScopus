import { NextRequest, NextResponse } from "next/server";
import { COL, getDb } from "@/lib/firebase";
import { markdownToDocx } from "@/lib/docx";
import { markdownToPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const fmt = (url.searchParams.get("format") || "docx").toLowerCase();
  const db = getDb();
  const doc = await db.collection(COL.reports).doc(params.id).get();
  if (!doc.exists) return NextResponse.json({ error: "not found" }, { status: 404 });
  const data: any = doc.data();
  const title = data.title || "Báo cáo công việc";

  if (fmt === "pdf") {
    const buf = await markdownToPdf(data.content || "", title);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safe(title)}.pdf"`,
      },
    });
  }

  if (fmt === "md" || fmt === "markdown") {
    return new NextResponse(data.content || "", {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safe(title)}.md"`,
      },
    });
  }

  const buf = await markdownToDocx(data.content || "", title);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safe(title)}.docx"`,
    },
  });
}

function safe(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_\.]+/g, "_").slice(0, 80);
}
