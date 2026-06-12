import PDFDocument from 'pdfkit';
import { NitAnalysisReport } from '../../types/nitAnalysisReport';

export type NitAnalysisExportFormat = 'json' | 'excel' | 'pdf';

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

class NitAnalysisExportService {
  toJson(report: NitAnalysisReport): string {
    return JSON.stringify(report, null, 2);
  }

  toExcelCsv(report: NitAnalysisReport): string {
    const lines: string[] = [
      [
        'Section',
        'Intelligence',
        'Parameter',
        'Value',
        'Page',
        'Confidence',
        'Confidence Label',
        'Validation Status',
        'Category',
        'Parameter Type',
      ].join(','),
    ];

    for (const section of report.sections) {
      for (const row of section.fields) {
        lines.push(
          [
            escapeCsv(section.title),
            escapeCsv(section.intelligenceLabel || section.title),
            escapeCsv(row.label),
            escapeCsv(row.value),
            String(row.sourcePage || ''),
            String(row.confidence),
            escapeCsv(row.confidenceLabel || ''),
            escapeCsv(row.validationDisplay || row.validationStatus || ''),
            escapeCsv(row.category || ''),
            escapeCsv(row.parameterType || ''),
          ].join(',')
        );
      }
    }

    return '\uFEFF' + lines.join('\r\n');
  }

  async toPdfBuffer(report: NitAnalysisReport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const chunks: Buffer[] = [];
      const pageWidth = doc.page.width - 96;

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const headline =
        report.sections
          .find((s) => s.id === 'identity')
          ?.fields.find((f) => f.key === 'tenderTitle' || f.key === 'workName')?.value ||
        report.originalName ||
        'NIT Analysis';

      doc.fontSize(16).font('Helvetica-Bold').text('Enterprise NIT Analysis', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(12).font('Helvetica').text(headline, { align: 'center' });
      doc.moveDown(0.5);
      doc
        .fontSize(9)
        .fillColor('#555')
        .text(
          `${report.statistics.totalParametersExtracted ?? report.tenderParameters.length} Parameters Extracted · Master Dataset v${report.statistics.masterDatasetVersion ?? 1}`,
          { align: 'center' }
        );
      doc.fillColor('#000');
      doc.moveDown(1);

      for (const section of report.sections) {
        if (doc.y > doc.page.height - 120) doc.addPage();

        doc.fontSize(11).font('Helvetica-Bold').text(section.intelligenceLabel || section.title);
        doc.fontSize(8).font('Helvetica').fillColor('#666').text(section.description);
        doc.fillColor('#000');
        doc.moveDown(0.4);

        for (const row of section.fields.filter((r) => !r.hiddenByDefault)) {
          if (doc.y > doc.page.height - 60) doc.addPage();
          doc.fontSize(9).font('Helvetica-Bold').text(row.label, { width: pageWidth });
          doc.font('Helvetica').text(row.value, { width: pageWidth });
          doc
            .fontSize(7)
            .fillColor('#777')
            .text(
              `Page ${row.sourcePage || '—'} · ${row.confidence}% · ${row.confidenceLabel || ''} · ${row.validationDisplay || ''}`,
              { width: pageWidth }
            );
          doc.fillColor('#000');
          doc.moveDown(0.35);
        }

        doc.moveDown(0.6);
      }

      doc.end();
    });
  }
}

export const nitAnalysisExportService = new NitAnalysisExportService();
