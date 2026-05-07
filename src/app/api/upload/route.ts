import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { describeClaudeError } from '@/lib/claude';
import {
  FIELDS,
  MAX_FILE_SIZE_BYTES,
  MIN_CONTENT_LENGTH,
  TARGET_TIERS,
} from '@/lib/constants';
import { parseUploadedFile } from '@/lib/parseFile';
import { sectionizePaper } from '@/lib/sectionizer';
import { createPaper } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MetaSchema = z.object({
  title: z.string().min(1).max(500),
  targetTier: z.enum(TARGET_TIERS),
  field: z.enum(FIELDS),
  journalName: z.string().max(200).optional().nullable(),
  /** Khi user paste plain text thay vì upload file. */
  pastedText: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const form = await req.formData();
    const metaStr = form.get('meta');
    if (typeof metaStr !== 'string') {
      return NextResponse.json({ error: 'Missing meta field' }, { status: 400 });
    }
    const meta = MetaSchema.parse(JSON.parse(metaStr));

    let text = '';
    const file = form.get('file');
    if (file && typeof file !== 'string') {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: 'File vượt giới hạn 50MB.' },
          { status: 400 },
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const r = await parseUploadedFile(buf, file.name);
      if (r.empty) {
        return NextResponse.json(
          {
            error:
              'File rỗng hoặc không đọc được. Vui lòng paste nội dung trực tiếp.',
          },
          { status: 400 },
        );
      }
      text = r.text;
    } else if (meta.pastedText) {
      text = meta.pastedText.trim();
    } else {
      return NextResponse.json(
        { error: 'Cần upload file hoặc paste nội dung.' },
        { status: 400 },
      );
    }

    if (text.length < MIN_CONTENT_LENGTH) {
      return NextResponse.json(
        {
          error: `Nội dung quá ngắn (cần >= ${MIN_CONTENT_LENGTH} ký tự).`,
        },
        { status: 400 },
      );
    }

    const sections = sectionizePaper(text);

    const paperId = await createPaper(user.uid, {
      title: meta.title,
      content: text,
      sections,
      targetTier: meta.targetTier,
      field: meta.field,
      journalName: meta.journalName?.trim() || null,
      charCount: text.length,
    });

    return NextResponse.json({ paperId, charCount: text.length, sectionCount: sections.length });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dữ liệu không hợp lệ: ' + e.errors.map((x) => x.message).join('; ') },
        { status: 400 },
      );
    }
    const code = (e as { code?: string })?.code;
    if (code === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Bạn cần đăng nhập.' }, { status: 401 });
    }
    console.error('upload route failed', e);
    return NextResponse.json(
      { error: describeClaudeError(e) },
      { status: 500 },
    );
  }
}
