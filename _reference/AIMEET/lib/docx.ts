import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } from "docx";

export async function markdownToDocx(markdown: string, title = "Báo cáo công việc"): Promise<Buffer> {
  const lines = markdown.split(/\r?\n/);
  const children: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: "" }),
  ];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      children.push(new Paragraph({ text: "" }));
      continue;
    }
    let m;
    if ((m = line.match(/^#\s+(.*)/))) {
      children.push(new Paragraph({ text: m[1], heading: HeadingLevel.HEADING_1 }));
    } else if ((m = line.match(/^##\s+(.*)/))) {
      children.push(new Paragraph({ text: m[1], heading: HeadingLevel.HEADING_2 }));
    } else if ((m = line.match(/^###\s+(.*)/))) {
      children.push(new Paragraph({ text: m[1], heading: HeadingLevel.HEADING_3 }));
    } else if ((m = line.match(/^\s*[-*]\s+(.*)/))) {
      children.push(new Paragraph({ text: m[1], bullet: { level: 0 } }));
    } else if ((m = line.match(/^\s*(\d+)\.\s+(.*)/))) {
      children.push(new Paragraph({ text: `${m[1]}. ${m[2]}` }));
    } else {
      children.push(new Paragraph({ children: parseInline(line) }));
    }
  }

  const doc = new Document({
    creator: "AIMEET",
    title,
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index) }));
    const tok = m[0];
    if (tok.startsWith("**")) runs.push(new TextRun({ text: tok.slice(2, -2), bold: true }));
    else runs.push(new TextRun({ text: tok.slice(1, -1), italics: true }));
    last = m.index + tok.length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last) }));
  if (runs.length === 0) runs.push(new TextRun({ text }));
  return runs;
}
