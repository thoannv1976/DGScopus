import { NextRequest, NextResponse } from 'next/server';
import { parseUploadedFile } from '@/lib/parseFile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const text = await parseUploadedFile(buf, file.name);
    return NextResponse.json({
      fileName: file.name,
      content: text,
      size: buf.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
