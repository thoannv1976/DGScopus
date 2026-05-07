import 'server-only';
import { existsSync } from 'fs';
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
} from 'docx';
import PDFDocument from 'pdfkit';
import type { Evaluation, SyllabusDoc } from './types';

// pdfkit's built-in fonts are Latin-1 only, so Vietnamese diacritics render
// as garbage. Register a Unicode TTF for the whole document instead. We look
// in a few well-known locations so this works in the Alpine production image
// (ttf-dejavu installed via Dockerfile) as well as common dev machines.
const FONT_CANDIDATES_REGULAR = [
  process.env.PDF_FONT_REGULAR,
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/Library/Fonts/Arial Unicode.ttf',
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
].filter(Boolean) as string[];

const FONT_CANDIDATES_BOLD = [
  process.env.PDF_FONT_BOLD,
  '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
].filter(Boolean) as string[];

function pickFont(candidates: string[]): string | null {
  for (const p of candidates) if (existsSync(p)) return p;
  return null;
}

function paragraphsFromText(text: string): Paragraph[] {
  return text.split(/\r?\n/).map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line })],
        spacing: { after: 120 },
      }),
  );
}

export async function syllabusToDocx(
  syl: SyllabusDoc,
  evaluation?: Evaluation | null,
): Promise<Buffer> {
  const sections: Paragraph[] = [
    new Paragraph({
      text: syl.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
  ];

  const meta: string[] = [];
  if (syl.courseCode) meta.push(`Mã học phần: ${syl.courseCode}`);
  if (syl.credits != null) meta.push(`Số tín chỉ: ${syl.credits}`);
  if (syl.program) meta.push(`Chương trình: ${syl.program}`);
  if (syl.level) meta.push(`Trình độ: ${syl.level}`);
  if (meta.length) {
    sections.push(
      new Paragraph({
        children: [new TextRun({ text: meta.join(' • '), italics: true })],
        spacing: { after: 200 },
      }),
    );
  }

  sections.push(
    new Paragraph({
      text: 'Nội dung đề cương',
      heading: HeadingLevel.HEADING_1,
    }),
    ...paragraphsFromText(syl.content),
  );

  if (evaluation) {
    sections.push(
      new Paragraph({
        text: 'Kết quả đánh giá',
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Điểm tổng quát: ${evaluation.overallScore}/5  (model: ${evaluation.model})`,
            bold: true,
          }),
        ],
        spacing: { after: 200 },
      }),
    );
    for (const g of evaluation.groups) {
      sections.push(
        new Paragraph({
          text: `${g.groupName} — ${g.averageScore}/5`,
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: g.summary, spacing: { after: 120 } }),
      );
      for (const s of g.scores) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `[${s.score}/5] ${s.criterionText}`,
                bold: true,
              }),
            ],
          }),
          new Paragraph({ text: s.comment, spacing: { after: 80 } }),
        );
        for (const sg of s.suggestions) {
          sections.push(
            new Paragraph({
              text: `• ${sg}`,
              indent: { left: 360 },
              spacing: { after: 60 },
            }),
          );
        }
      }
      if (g.prioritizedRevisions.length) {
        sections.push(
          new Paragraph({
            text: 'Ưu tiên chỉnh sửa:',
            heading: HeadingLevel.HEADING_3,
          }),
        );
        for (const r of g.prioritizedRevisions) {
          sections.push(
            new Paragraph({
              text: `• ${r}`,
              indent: { left: 360 },
              spacing: { after: 60 },
            }),
          );
        }
      }
    }
  }

  const doc = new Document({
    creator: 'AI Syllabus Evaluator',
    title: syl.title,
    sections: [{ children: sections }],
  });
  return Packer.toBuffer(doc);
}

export async function syllabusToPdf(
  syl: SyllabusDoc,
  evaluation?: Evaluation | null,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const regularFont = pickFont(FONT_CANDIDATES_REGULAR);
    if (!regularFont) {
      reject(
        new Error(
          'Không tìm thấy font Unicode để xuất PDF (cần DejaVu Sans hoặc tương đương). Hãy cài ttf-dejavu trên máy chủ hoặc đặt biến PDF_FONT_REGULAR.',
        ),
      );
      return;
    }
    const boldFont = pickFont(FONT_CANDIDATES_BOLD) ?? regularFont;

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.registerFont('Body', regularFont);
    doc.registerFont('BodyBold', boldFont);
    doc.font('Body');

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('BodyBold').fontSize(18).text(syl.title, { align: 'center' });
    doc.font('Body');
    doc.moveDown(0.5);

    const meta: string[] = [];
    if (syl.courseCode) meta.push(`Mã học phần: ${syl.courseCode}`);
    if (syl.credits != null) meta.push(`Số tín chỉ: ${syl.credits}`);
    if (syl.program) meta.push(`Chương trình: ${syl.program}`);
    if (syl.level) meta.push(`Trình độ: ${syl.level}`);
    if (meta.length) {
      doc.fontSize(10).fillColor('#444').text(meta.join(' • '), { align: 'center' });
      doc.fillColor('#000');
    }
    doc.moveDown(1);

    doc.font('BodyBold').fontSize(14).text('Nội dung đề cương', { underline: true });
    doc.font('Body').fontSize(11);
    doc.moveDown(0.5);
    doc.text(syl.content);

    if (evaluation) {
      doc.addPage();
      doc.font('BodyBold').fontSize(16).text('Kết quả đánh giá');
      doc.font('Body').fontSize(11);
      doc.moveDown(0.5);
      doc.text(
        `Điểm tổng quát: ${evaluation.overallScore}/5 (model: ${evaluation.model})`,
      );
      doc.moveDown(0.5);

      for (const g of evaluation.groups) {
        doc.moveDown(0.5);
        doc.font('BodyBold').fontSize(13).text(`${g.groupName} — ${g.averageScore}/5`);
        doc.font('Body').fontSize(10).fillColor('#333').text(g.summary);
        doc.fillColor('#000');
        doc.moveDown(0.3);
        for (const s of g.scores) {
          doc.font('BodyBold').fontSize(11).text(`[${s.score}/5] ${s.criterionText}`, {
            continued: false,
          });
          doc.font('Body');
          if (s.comment) doc.fontSize(10).fillColor('#333').text(s.comment);
          doc.fillColor('#000');
          for (const sg of s.suggestions) {
            doc.fontSize(10).text(`  • ${sg}`);
          }
        }
        if (g.prioritizedRevisions.length) {
          doc.moveDown(0.3);
          doc.font('BodyBold').fontSize(11).text('Ưu tiên chỉnh sửa:');
          doc.font('Body');
          for (const r of g.prioritizedRevisions) {
            doc.fontSize(10).text(`  • ${r}`);
          }
        }
      }
    }

    doc.end();
  });
}
