import { StandardFonts, rgb, degrees as pdfDegrees } from 'pdf-lib';
import { loadPdfDocument } from './pdfUtilityService';

export interface HeaderFooterOptions {
  headerText?: string;
  footerText?: string;
  fontSize?: number;
}

export interface WatermarkOptions {
  watermarkText: string;
  fontSize?: number;
  opacity?: number;
}

export interface PageNumbersOptions {
  format?: string;
  fontSize?: number;
  position?: 'bottom-center' | 'bottom-right' | 'bottom-left';
}

function wrapText(text: string, maxLen = 90): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLen) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function addHeaderFooterToPdf(
  buffer: Buffer,
  opts: HeaderFooterOptions
): Promise<{ buffer: Buffer; pageCount: number }> {
  const doc = await loadPdfDocument(buffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = opts.fontSize ?? 10;
  const pages = doc.getPages();

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    if (opts.headerText?.trim()) {
      wrapText(opts.headerText.trim(), 100).forEach((line, i) => {
        page.drawText(line, {
          x: 40,
          y: height - 36 - i * (fontSize + 2),
          size: fontSize,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
      });
    }
    if (opts.footerText?.trim()) {
      wrapText(opts.footerText.trim(), 100).forEach((line, i) => {
        page.drawText(line, {
          x: 40,
          y: 28 + i * (fontSize + 2),
          size: fontSize,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
      });
    }
    void width;
  });

  const bytes = await doc.save({ useObjectStreams: true });
  return { buffer: Buffer.from(bytes), pageCount: pages.length };
}

export async function addWatermarkToPdf(
  buffer: Buffer,
  opts: WatermarkOptions
): Promise<{ buffer: Buffer; pageCount: number }> {
  const doc = await loadPdfDocument(buffer);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = opts.fontSize ?? 42;
  const opacity = Math.min(1, Math.max(0.1, opts.opacity ?? 0.25));
  const text = opts.watermarkText.trim();
  const pages = doc.getPages();

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: height / 2,
      size: fontSize,
      font,
      color: rgb(0.65, 0.65, 0.65),
      rotate: pdfDegrees(45),
      opacity,
    });
  });

  const bytes = await doc.save({ useObjectStreams: true });
  return { buffer: Buffer.from(bytes), pageCount: pages.length };
}

export async function addPageNumbersToPdf(
  buffer: Buffer,
  opts: PageNumbersOptions
): Promise<{ buffer: Buffer; pageCount: number }> {
  const doc = await loadPdfDocument(buffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = opts.fontSize ?? 10;
  const format = opts.format || 'Page {n} of {total}';
  const position = opts.position || 'bottom-center';
  const pages = doc.getPages();
  const total = pages.length;

  pages.forEach((page, index) => {
    const { width } = page.getSize();
    const label = format.replace('{n}', String(index + 1)).replace('{total}', String(total));
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    let x = (width - textWidth) / 2;
    if (position === 'bottom-right') x = width - textWidth - 40;
    if (position === 'bottom-left') x = 40;

    page.drawText(label, {
      x,
      y: 22,
      size: fontSize,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  });

  const bytes = await doc.save({ useObjectStreams: true });
  return { buffer: Buffer.from(bytes), pageCount: total };
}
