import 'server-only';
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import type { EvaluationDoc, PaperDoc } from './types';

// =============================================================================
// DOCX exporter cho evaluation report. Output English, không cần DejaVu font
// (chỉ pdfkit mới cần). Trả về Buffer; route handler set Content-Disposition.
// =============================================================================

export async function exportEvaluationDocx(
  paper: PaperDoc,
  evaluation: EvaluationDoc,
): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(`DGScopus Pre-Submission Review`)],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Manuscript: ', bold: true }),
        new TextRun(paper.title),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Target: ', bold: true }),
        new TextRun(
          `${paper.targetTier}${paper.journalName ? ` — ${paper.journalName}` : ''} (${paper.field})`,
        ),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Mode: ', bold: true }),
        new TextRun(`${evaluation.mode}`),
        new TextRun({ text: '   Overall score: ', bold: true }),
        new TextRun(`${evaluation.overallScore.toFixed(2)} / 5`),
      ],
    }),
    new Paragraph({ text: '' }),
  );

  // Rubric scores table.
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun('Rubric scores')],
    }),
  );
  const tableRows = [
    new TableRow({
      children: [
        headerCell('Criterion'),
        headerCell('Weight'),
        headerCell('Score'),
        headerCell('Comment'),
      ],
    }),
    ...evaluation.criteria.map(
      (c) =>
        new TableRow({
          children: [
            cell(c.criterionName),
            cell(`${c.weight}%`),
            cell(`${c.score}/5`),
            cell(c.comment),
          ],
        }),
    ),
  ];
  const table = new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  // Suggestions per criterion.
  const suggestionParas: Paragraph[] = [];
  for (const c of evaluation.criteria) {
    if (c.suggestions.length === 0) continue;
    suggestionParas.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun(c.criterionName)],
      }),
    );
    for (const s of c.suggestions) {
      suggestionParas.push(new Paragraph({ text: `• ${s}` }));
    }
  }

  // Top issues.
  const topIssuesParas: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun('Top issues')],
    }),
    ...evaluation.topIssues.map(
      (i, idx) => new Paragraph({ text: `${idx + 1}. ${i}` }),
    ),
  ];

  const sectionRevParas: Paragraph[] = [];
  if (evaluation.sectionRevisions?.length) {
    sectionRevParas.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun('Section-level revisions')],
      }),
    );
    for (const r of evaluation.sectionRevisions) {
      sectionRevParas.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${r.sectionKey}] `, bold: true }),
            new TextRun(`${r.issue} → ${r.suggestion}`),
          ],
        }),
      );
    }
  }

  const acceptParas: Paragraph[] = [];
  if (evaluation.acceptanceProbability) {
    const ap = evaluation.acceptanceProbability;
    acceptParas.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun('Acceptance probability (rough estimate)')],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Estimate: ', bold: true }),
          new TextRun(`${ap.estimate}% (95% CI: ${ap.ci95[0]}–${ap.ci95[1]}%)`),
        ],
      }),
      new Paragraph({ text: ap.rationale }),
      new Paragraph({
        children: [new TextRun({ text: ap.disclaimer, italics: true })],
      }),
    );
  }

  const coverParas: Paragraph[] = [];
  if (evaluation.coverLetter) {
    coverParas.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun('Draft cover letter')],
      }),
      ...evaluation.coverLetter
        .split(/\n+/)
        .map((line) => new Paragraph({ text: line })),
    );
  }

  const relatedParas: Paragraph[] = [];
  if (evaluation.relatedPapers?.length) {
    relatedParas.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun('Related papers (BibTeX)')],
      }),
    );
    for (const r of evaluation.relatedPapers) {
      relatedParas.push(
        new Paragraph({
          children: [new TextRun({ text: `${r.title} (${r.year})`, bold: true })],
        }),
        new Paragraph({ text: `${r.authors} — ${r.venue}${r.doi ? ` — DOI: ${r.doi}` : ''}` }),
        new Paragraph({ text: `Reason: ${r.reasonToCite}` }),
        new Paragraph({
          children: [new TextRun({ text: r.bibtex, font: 'Courier New' })],
        }),
        new Paragraph({ text: '' }),
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          ...children,
          table,
          new Paragraph({ text: '' }),
          ...suggestionParas,
          ...topIssuesParas,
          ...sectionRevParas,
          ...acceptParas,
          ...coverParas,
          ...relatedParas,
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function headerCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({ children: [new TextRun({ text, bold: true })] }),
    ],
  });
}

function cell(text: string): TableCell {
  return new TableCell({ children: [new Paragraph({ text })] });
}
