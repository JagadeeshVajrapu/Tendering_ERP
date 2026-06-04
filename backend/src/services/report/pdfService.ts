import PDFDocument from 'pdfkit';
import { APP_NAME, APP_TAGLINE } from '../../config/branding';
import { MdFeasibilityContent } from './mdFeasibilityReportBuilder';

export interface FeasibilityReportContent {
  scopeSummary: string;
  eligibilitySummary: string;
  timelineSummary: string;
  financialSummary: string;
  keyRisks: string[];
  recommendation: 'Suitable' | 'Not Suitable';
  intelligenceRecommendation?: string;
  recommendationJustification?: string;
}

class PdfService {
  /** MD Tender Feasibility Report — decision brief for Managing Director (1–2 pages). */
  async generateMdFeasibilityBrief(content: MdFeasibilityContent): Promise<Buffer> {
    const report = content.executive;
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const w = doc.page.width - 100;

      doc.fontSize(11).font('Helvetica').fillColor('#444').text(APP_NAME, { align: 'center' });
      doc.fontSize(8).text(APP_TAGLINE, { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text('Tender Feasibility Report', {
        align: 'center',
      });
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#555')
        .text(
          new Date().toLocaleDateString('en-IN', { dateStyle: 'long' }),
          { align: 'center' }
        );
      doc.moveDown(1);
      doc.fillColor('#000');

      this.heading(doc, 'Tender Overview');
      doc.fontSize(10).font('Helvetica');
      report.overviewLines.forEach((line) => {
        doc.text(line, { width: w });
      });
      doc.moveDown(0.6);

      this.heading(doc, 'Scope Assessment');
      doc.fontSize(10).font('Helvetica');
      report.scopeBullets.forEach((b) => {
        doc.text(`• ${b}`, { width: w, indent: 8 });
      });
      doc.moveDown(0.6);

      this.heading(doc, 'Eligibility Assessment');
      doc.fontSize(10).font('Helvetica');
      report.eligibilityBullets.forEach((b) => {
        doc.text(`• ${b}`, { width: w, indent: 8 });
      });
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text(`Eligibility Status: ${report.eligibilityStatus}`, { width: w });
      doc.font('Helvetica');
      doc.moveDown(0.6);

      this.heading(doc, 'Timeline Assessment');
      const tableTop = doc.y;
      const colA = 50;
      const colB = 260;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Milestone', colA, tableTop, { width: 190 });
      doc.text('Date / Period', colB, tableTop, { width: 250 });
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(9);
      for (const row of report.timelineRows) {
        const y = doc.y;
        if (y > doc.page.height - 70) doc.addPage();
        doc.text(row.milestone, colA, doc.y, { width: 190 });
        const lineY = doc.y;
        doc.text(row.date, colB, y, { width: 250 });
        doc.y = Math.max(lineY, doc.y) + 6;
      }
      doc.moveDown(0.6);

      this.heading(doc, 'Key Risks');
      doc.fontSize(10).font('Helvetica');
      report.keyRisks.forEach((r) => {
        doc.text(`• ${r}`, { width: w, indent: 8 });
      });
      doc.moveDown(0.6);

      this.heading(doc, 'Executive Recommendation');
      const recColor =
        report.recommendation === 'APPLY'
          ? '#166534'
          : report.recommendation === 'DO NOT APPLY'
            ? '#991b1b'
            : '#b45309';
      doc.fontSize(12).font('Helvetica-Bold').fillColor(recColor).text(report.recommendation, {
        width: w,
      });
      doc.fillColor('#000').fontSize(10).font('Helvetica');
      doc.moveDown(0.25);
      doc.text(content.recommendationJustification || report.recommendationJustification, {
        width: w,
        align: 'justify',
      });

      doc.end();
    });
  }

  private heading(doc: InstanceType<typeof PDFDocument>, title: string): void {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000').text(title);
    doc.moveDown(0.25);
    doc
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .strokeColor('#ddd')
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.35);
  }
}

export const pdfService = new PdfService();
