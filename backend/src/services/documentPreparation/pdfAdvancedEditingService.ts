import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { AppError } from '../../middleware/errorHandler';
import { IMarkupRegion } from '../../models/PreparationDocumentMarkup';

export interface MarkupRegionInput {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  color?: string;
  stampLabel?: string;
}

function parseColor(color?: string) {
  if (!color) return rgb(0, 0, 0);
  const hex = color.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return rgb(r, g, b);
  }
  return rgb(0, 0, 0);
}

export async function unlockPasswordProtectedPdf(
  buffer: Buffer,
  password: string
): Promise<{ buffer: Buffer; pageCount: number }> {
  if (!password?.trim()) throw new AppError('PDF password is required', 400);
  try {
    const doc = await PDFDocument.load(buffer, {
      password: password.trim(),
      ignoreEncryption: false,
    } as Parameters<typeof PDFDocument.load>[1]);
    const bytes = await doc.save({ useObjectStreams: true });
    return { buffer: Buffer.from(bytes), pageCount: doc.getPageCount() };
  } catch {
    throw new AppError('Incorrect password or unsupported PDF encryption', 400);
  }
}

async function loadDoc(buffer: Buffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(buffer, { ignoreEncryption: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown PDF parse error';
    throw new AppError(`Could not read PDF: ${message}`, 400);
  }
}

export async function applyRedactions(
  buffer: Buffer,
  regions: MarkupRegionInput[]
): Promise<{ buffer: Buffer; pageCount: number }> {
  const doc = await loadDoc(buffer);
  const pages = doc.getPages();

  for (const region of regions) {
    const page = pages[region.pageNumber - 1];
    if (!page) continue;
    page.drawRectangle({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      color: rgb(0, 0, 0),
      borderWidth: 0,
    });
  }

  const bytes = await doc.save({ useObjectStreams: true });
  return { buffer: Buffer.from(bytes), pageCount: pages.length };
}

export async function applyAnnotations(
  buffer: Buffer,
  regions: MarkupRegionInput[]
): Promise<{ buffer: Buffer; pageCount: number }> {
  const doc = await loadDoc(buffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  for (const region of regions) {
    const page = pages[region.pageNumber - 1];
    if (!page) continue;
    const color = parseColor(region.color || '#1e40af');
    page.drawRectangle({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      borderColor: color,
      borderWidth: 1,
      color: rgb(0.95, 0.97, 1),
      opacity: 0.85,
    });
    if (region.text?.trim()) {
      page.drawText(region.text.trim(), {
        x: region.x + 4,
        y: region.y + region.height - 14,
        size: 10,
        font,
        color,
        maxWidth: Math.max(20, region.width - 8),
      });
    }
  }

  const bytes = await doc.save({ useObjectStreams: true });
  return { buffer: Buffer.from(bytes), pageCount: pages.length };
}

export async function applyHighlights(
  buffer: Buffer,
  regions: MarkupRegionInput[]
): Promise<{ buffer: Buffer; pageCount: number }> {
  const doc = await loadDoc(buffer);
  const pages = doc.getPages();

  for (const region of regions) {
    const page = pages[region.pageNumber - 1];
    if (!page) continue;
    page.drawRectangle({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      color: rgb(1, 0.92, 0.23),
      opacity: 0.4,
      borderWidth: 0,
    });
  }

  const bytes = await doc.save({ useObjectStreams: true });
  return { buffer: Buffer.from(bytes), pageCount: pages.length };
}

export async function applyStamps(
  buffer: Buffer,
  regions: MarkupRegionInput[]
): Promise<{ buffer: Buffer; pageCount: number }> {
  const doc = await loadDoc(buffer);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  for (const region of regions) {
    const page = pages[region.pageNumber - 1];
    if (!page) continue;
    const label = (region.stampLabel || region.text || 'STAMP').trim().toUpperCase();
    const color = parseColor(region.color || '#b91c1c');
    page.drawRectangle({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      borderColor: color,
      borderWidth: 2,
      opacity: 0.9,
    });
    const textWidth = font.widthOfTextAtSize(label, 12);
    page.drawText(label, {
      x: region.x + Math.max(4, (region.width - textWidth) / 2),
      y: region.y + region.height / 2 - 6,
      size: 12,
      font,
      color,
    });
  }

  const bytes = await doc.save({ useObjectStreams: true });
  return { buffer: Buffer.from(bytes), pageCount: pages.length };
}

export async function embedSignatureImage(
  buffer: Buffer,
  signaturePng: Buffer,
  placement: { pageNumber: number; x: number; y: number; width: number; height: number }
): Promise<{ buffer: Buffer; pageCount: number }> {
  const doc = await loadDoc(buffer);
  const pages = doc.getPages();
  const page = pages[placement.pageNumber - 1];
  if (!page) throw new AppError('Invalid signature page number', 400);

  const image = await doc.embedPng(signaturePng);
  page.drawImage(image, {
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
  });

  const bytes = await doc.save({ useObjectStreams: true });
  return { buffer: Buffer.from(bytes), pageCount: pages.length };
}

export function toMarkupRegions(regions: MarkupRegionInput[]): IMarkupRegion[] {
  return regions.map((r) => ({
    pageNumber: r.pageNumber,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    text: r.text,
    color: r.color,
    stampLabel: r.stampLabel,
  }));
}
