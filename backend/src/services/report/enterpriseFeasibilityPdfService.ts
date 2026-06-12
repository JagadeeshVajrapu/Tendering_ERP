import PDFDocument from 'pdfkit';
import { APP_NAME } from '../../config/branding';
import { EnterpriseFeasibilityReport } from '../../types/enterpriseFeasibilityReport';

class EnterpriseFeasibilityPdfService {
  async generatePdf(report: EnterpriseFeasibilityReport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const chunks: Buffer[] = [];
      const w = doc.page.width - 96;

      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(10).fillColor('#555').text(APP_NAME, { align: 'center' });
      doc.fontSize(15).fillColor('#000').font('Helvetica-Bold').text('Enterprise Feasibility Report', {
        align: 'center',
      });
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(report.overview.tenderTitle || 'Tender Decision Brief', { align: 'center' });
      doc.moveDown(0.8);

      this.section(doc, '1. Tender Overview', w, [
        `Tender No: ${report.overview.tenderNumber || '—'}`,
        `Organization: ${report.overview.organization || '—'}`,
        `Service: ${report.overview.serviceCategory || '—'}`,
        `Value: ${report.overview.tenderValue || '—'} · EMD: ${report.overview.emdAmount || '—'}`,
        `Bid End: ${report.overview.bidSubmissionEndDate || '—'}`,
      ]);

      this.section(doc, '2. Scope Summary', w, report.scopeSummary.bullets.map((b) => `• ${b}`));

      this.section(
        doc,
        '3. Manpower',
        w,
        report.manpowerRequirements.items.map((m) => `${m.role}: ${m.count}`)
      );

      this.section(doc, '4. Eligibility', w, [
        `Turnover: ${report.eligibilitySummary.turnoverRequirement || '—'}`,
        `Experience: ${report.eligibilitySummary.experienceRequirement || '—'}`,
        `Solvency: ${report.eligibilitySummary.bankSolvency || '—'}`,
      ]);

      this.section(doc, '5. Financial', w, [
        `Exposure: ${report.financialSummary.estimatedFinancialExposure}`,
        `EMD: ${report.financialSummary.emd || '—'} · Fee: ${report.financialSummary.tenderFee || '—'}`,
      ]);

      this.section(doc, '6. Timeline', w, [
        `Bid End: ${report.timelineSummary.bidEndDate || '—'}`,
        `Days Remaining: ${report.timelineSummary.daysRemaining ?? '—'}`,
      ]);

      this.section(doc, '7. Checklist Readiness', w, [
        report.checklistReadiness.readinessLabel,
        `Missing: ${report.checklistReadiness.missingDocuments} · Expired: ${report.checklistReadiness.expiredDocuments}`,
      ]);

      this.section(doc, '8. Experience', w, [
        `Status: ${report.experienceMatching.eligibilityStatus}`,
        ...report.experienceMatching.experienceGaps.map((g) => `Gap: ${g}`),
      ]);

      this.section(
        doc,
        '9. Risk Analysis',
        w,
        report.riskAnalysis.risks.map((r) => `${r.riskType} (${r.level}): ${r.reason}`)
      );

      doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold').text('10. AI Recommendation');
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#1d4ed8').text(report.aiRecommendation.recommendation);
      doc.fillColor('#000').fontSize(9).font('Helvetica');
      doc.text(report.aiRecommendation.reason, { width: w });
      doc.moveDown(0.4);
      doc.font('Helvetica-Bold').text('Required Actions');
      doc.font('Helvetica');
      report.aiRecommendation.requiredActions.forEach((a) => doc.text(`• ${a}`, { width: w }));

      doc.end();
    });
  }

  private section(doc: InstanceType<typeof PDFDocument>, title: string, w: number, lines: string[]) {
    if (doc.y > doc.page.height - 100) doc.addPage();
    doc.fontSize(11).font('Helvetica-Bold').text(title);
    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica');
    for (const line of lines.filter(Boolean)) {
      if (doc.y > doc.page.height - 50) doc.addPage();
      doc.text(line, { width: w });
    }
    doc.moveDown(0.5);
  }
}

export const enterpriseFeasibilityPdfService = new EnterpriseFeasibilityPdfService();
