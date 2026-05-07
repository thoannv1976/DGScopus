import PDFDocument from "pdfkit";

export async function markdownToPdf(markdown: string, title = "Báo cáo công việc"): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: title } });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.font("Helvetica-Bold").fontSize(20).text(title, { align: "center" });
      doc.moveDown(1);
      doc.font("Helvetica").fontSize(11);

      for (const raw of markdown.split(/\r?\n/)) {
        const line = raw.trimEnd();
        if (!line.trim()) {
          doc.moveDown(0.5);
          continue;
        }
        let m;
        if ((m = line.match(/^#\s+(.*)/))) {
          doc.moveDown(0.5).font("Helvetica-Bold").fontSize(16).text(m[1]).font("Helvetica").fontSize(11);
        } else if ((m = line.match(/^##\s+(.*)/))) {
          doc.moveDown(0.4).font("Helvetica-Bold").fontSize(14).text(m[1]).font("Helvetica").fontSize(11);
        } else if ((m = line.match(/^###\s+(.*)/))) {
          doc.moveDown(0.3).font("Helvetica-Bold").fontSize(12).text(m[1]).font("Helvetica").fontSize(11);
        } else if ((m = line.match(/^\s*[-*]\s+(.*)/))) {
          doc.text(`• ${stripMd(m[1])}`, { indent: 12 });
        } else if ((m = line.match(/^\s*(\d+)\.\s+(.*)/))) {
          doc.text(`${m[1]}. ${stripMd(m[2])}`, { indent: 12 });
        } else {
          doc.text(stripMd(line));
        }
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function stripMd(s: string): string {
  return s.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
}
