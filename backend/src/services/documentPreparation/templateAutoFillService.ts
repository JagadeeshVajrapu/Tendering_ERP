import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { CompanyTemplateDataDto } from '../../types/documentPreparation';
import { loadPdfDocument } from './pdfUtilityService';

function trySetFormField(doc: PDFDocument, fieldNames: string[], value: string): boolean {
  if (!value.trim()) return false;
  try {
    const form = doc.getForm();
    for (const name of fieldNames) {
      try {
        const field = form.getTextField(name);
        field.setText(value);
        return true;
      } catch {
        // try next alias
      }
    }
  } catch {
    return false;
  }
  return false;
}

export async function autoFillTemplatePdf(
  buffer: Buffer,
  company: CompanyTemplateDataDto,
  includeCoverPage = true
): Promise<{ buffer: Buffer; pageCount: number; filledFields: string[] }> {
  const doc = await loadPdfDocument(buffer);
  const filledFields: string[] = [];

  const mappings: Array<{ keys: string[]; value: string; label: string }> = [
    { keys: ['company_name', 'companyName', 'CompanyName', 'firm_name'], value: company.companyName, label: 'companyName' },
    { keys: ['gst', 'gstin', 'GST', 'GSTIN'], value: company.gst, label: 'gst' },
    { keys: ['pan', 'PAN', 'pan_number'], value: company.pan, label: 'pan' },
    { keys: ['address', 'registered_address', 'Address'], value: company.address, label: 'address' },
    { keys: ['cin', 'CIN', 'cin_number'], value: company.cin, label: 'cin' },
    { keys: ['msme', 'udyam', 'MSME', 'msme_number'], value: company.msme, label: 'msme' },
  ];

  for (const mapping of mappings) {
    if (trySetFormField(doc, mapping.keys, mapping.value)) {
      filledFields.push(mapping.label);
    }
  }

  if (includeCoverPage) {
    const cover = doc.insertPage(0, [595.28, 841.89]);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = [
      { text: 'Company Profile — Auto Fill', size: 16, bold: true },
      { text: '', size: 12, bold: false },
      { text: `Company Name: ${company.companyName}`, size: 11, bold: false },
      { text: `GST: ${company.gst}`, size: 11, bold: false },
      { text: `PAN: ${company.pan}`, size: 11, bold: false },
      { text: `CIN: ${company.cin}`, size: 11, bold: false },
      { text: `MSME: ${company.msme}`, size: 11, bold: false },
      { text: `Address: ${company.address}`, size: 11, bold: false },
    ];

    let y = 780;
    for (const line of lines) {
      if (!line.text) {
        y -= 10;
        continue;
      }
      const activeFont = line.bold ? fontBold : font;
      const wrapped = line.text.length > 85 ? [line.text.slice(0, 85), line.text.slice(85)] : [line.text];
      for (const part of wrapped) {
        cover.drawText(part, {
          x: 50,
          y,
          size: line.size,
          font: activeFont,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= line.size + 8;
      }
    }
    filledFields.push('coverPage');
  }

  // Stamp company block on each existing content page (after cover insert)
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const stamp = `Co: ${company.companyName} | GST: ${company.gst} | PAN: ${company.pan}`;
  doc.getPages().forEach((page, idx) => {
    if (includeCoverPage && idx === 0) return;
    const { width, height } = page.getSize();
    const label = stamp.length > 90 ? `${stamp.slice(0, 87)}...` : stamp;
    page.drawText(label, {
      x: 40,
      y: height - 24,
      size: 8,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    void width;
  });

  const bytes = await doc.save({ useObjectStreams: true });
  return { buffer: Buffer.from(bytes), pageCount: doc.getPageCount(), filledFields };
}
