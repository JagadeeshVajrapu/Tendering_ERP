import PDFDocument from 'pdfkit';
import { DynamicChecklistCategory, DynamicChecklistResult } from '../../types/dynamicChecklist';

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

class DynamicChecklistExportService {
  toJson(result: DynamicChecklistResult): string {
    return JSON.stringify(result, null, 2);
  }

  toExcelCsv(result: DynamicChecklistResult): string {
    const lines = [
      [
        'Section',
        'Document',
        'Required',
        'Status',
        'Critical',
        'Uploaded File',
        'Source',
        'Review Note',
      ].join(','),
    ];

    for (const cat of result.categories) {
      for (const item of cat.items) {
        lines.push(
          [
            escapeCsv(cat.title),
            escapeCsv(item.name),
            item.required ? 'Yes' : 'No',
            escapeCsv(item.status),
            item.critical ? 'Yes' : 'No',
            escapeCsv(item.matchedFileName || ''),
            escapeCsv(item.source),
            escapeCsv(item.reviewNote || ''),
          ].join(',')
        );
      }
    }

    return '\uFEFF' + lines.join('\r\n');
  }

  async sectionPdfBuffer(section: DynamicChecklistCategory, result: DynamicChecklistResult): Promise<Buffer> {
    return this.renderPdf([section], result, section.title);
  }

  async fullPdfBuffer(result: DynamicChecklistResult): Promise<Buffer> {
    return this.renderPdf(result.categories, result, 'Full Compliance Checklist');
  }

  private async renderPdf(
    sections: DynamicChecklistCategory[],
    result: DynamicChecklistResult,
    title: string
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const chunks: Buffer[] = [];
      const pageWidth = doc.page.width - 96;

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#555')
        .text(
          `${result.summary.readinessLabel} · ${result.summary.required} required · ${result.summary.missing} missing · ${result.serviceCategory || 'General'}`,
          { align: 'center' }
        );
      doc.fillColor('#000');
      doc.moveDown(1);

      for (const section of sections) {
        if (doc.y > doc.page.height - 100) doc.addPage();
        doc.fontSize(12).font('Helvetica-Bold').text(section.title);
        doc.moveDown(0.4);

        for (const item of section.items) {
          if (doc.y > doc.page.height - 70) doc.addPage();
          doc.fontSize(9).font('Helvetica-Bold').text(item.name, { width: pageWidth });
          doc
            .font('Helvetica')
            .text(
              `${item.required ? 'Required' : 'Optional'} · ${item.status}${item.critical ? ' · Critical' : ''}`,
              { width: pageWidth }
            );
          if (item.matchedFileName) {
            doc.fontSize(8).fillColor('#666').text(`File: ${item.matchedFileName}`, { width: pageWidth });
            doc.fillColor('#000');
          }
          doc.moveDown(0.3);
        }
        doc.moveDown(0.5);
      }

      doc.end();
    });
  }
}

export const dynamicChecklistExportService = new DynamicChecklistExportService();
