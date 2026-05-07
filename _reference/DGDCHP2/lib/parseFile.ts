import 'server-only';
import mammoth from 'mammoth';
// pdf-parse exposes a function that operates on a Buffer.
// Import via require to avoid its index.js test-mode side effect.
const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('pdf-parse/lib/pdf-parse.js');

export async function parseUploadedFile(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.docx')) {
    const r = await mammoth.extractRawText({ buffer });
    return r.value.trim();
  }
  if (lower.endsWith('.pdf')) {
    const r = await pdfParse(buffer);
    return r.text.trim();
  }
  if (lower.endsWith('.txt') || lower.endsWith('.md')) {
    return buffer.toString('utf8').trim();
  }
  throw new Error(`Unsupported file type: ${fileName}`);
}
