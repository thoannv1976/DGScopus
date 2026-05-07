import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Placeholder transcription endpoint.
// The primary transcription happens client-side via Web Speech API.
// This endpoint accepts an uploaded audio blob and forwards to a configured
// STT provider. For now it returns a clear error so the UI can fall back.
export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("multipart/form-data") && !ct.includes("application/octet-stream")) {
    return NextResponse.json({ error: "Expecting audio upload" }, { status: 400 });
  }

  // TODO: Integrate Google Cloud Speech-to-Text or other provider.
  // const form = await req.formData();
  // const file = form.get("audio") as File | null;
  return NextResponse.json(
    {
      error:
        "Server-side transcription chưa cấu hình. Vui lòng dùng tính năng ghi âm + nhận dạng trực tiếp trong trình duyệt (Web Speech API), hoặc dán transcript thủ công.",
    },
    { status: 501 },
  );
}
