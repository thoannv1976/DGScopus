import 'server-only';
import mammoth from 'mammoth';

// pdf-parse exposes a function on Buffer. require the inner file to bypass
// index.js test-mode side effect that crashes on production Alpine.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse.js');

export interface ParseResult {
  text: string;
  /** True khi parse trả về string rỗng — UI hiển thị fallback paste textarea. */
  empty: boolean;
}

export async function parseUploadedFile(
  buffer: Buffer,
  fileName: string,
): Promise<ParseResult> {
  const lower = fileName.toLowerCase();
  let text = '';
  if (lower.endsWith('.docx')) {
    const r = await mammoth.extractRawText({ buffer });
    text = r.value;
  } else if (lower.endsWith('.pdf')) {
    const r = await pdfParse(buffer);
    text = r.text;
  } else if (lower.endsWith('.txt') || lower.endsWith('.md')) {
    text = buffer.toString('utf8');
  } else {
    throw new Error(`Định dạng không hỗ trợ: ${fileName}`);
  }

  const trimmed = text.trim();
  return { text: trimmed, empty: trimmed.length === 0 };
}
