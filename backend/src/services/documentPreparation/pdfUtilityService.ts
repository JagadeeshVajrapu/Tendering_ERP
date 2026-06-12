import { PDFDocument, degrees as pdfDegrees } from 'pdf-lib';
import { AppError } from '../../middleware/errorHandler';

const PDF_LOAD_OPTIONS = { ignoreEncryption: true } as const;

export async function loadPdfDocument(buffer: Buffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(buffer, PDF_LOAD_OPTIONS);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown PDF parse error';
    throw new AppError(`Could not read PDF: ${message}`, 400);
  }
}

export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const doc = await loadPdfDocument(buffer);
  return doc.getPageCount();
}

export async function mergePdfBuffers(buffers: Buffer[]): Promise<{ buffer: Buffer; pageCount: number }> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await loadPdfDocument(buf);
    const copied = await merged.copyPages(src, src.getPageIndices());
    copied.forEach((page) => merged.addPage(page));
  }
  const bytes = await merged.save({ useObjectStreams: true });
  return { buffer: Buffer.from(bytes), pageCount: merged.getPageCount() };
}

export async function splitPdfByRanges(
  buffer: Buffer,
  ranges: Array<{ from: number; to: number }>
): Promise<Array<{ buffer: Buffer; pageCount: number; from: number; to: number }>> {
  const src = await loadPdfDocument(buffer);
  const total = src.getPageCount();
  const results: Array<{ buffer: Buffer; pageCount: number; from: number; to: number }> = [];

  for (const range of ranges) {
    if (!Number.isFinite(range.from) || !Number.isFinite(range.to)) {
      throw new AppError('Page range must use valid page numbers', 400);
    }
    const from = Math.max(1, Math.min(Math.floor(range.from), total));
    const to = Math.max(from, Math.min(Math.floor(range.to), total));
    const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);

    const part = await PDFDocument.create();
    const copied = await part.copyPages(src, indices);
    copied.forEach((page) => part.addPage(page));
    const bytes = await part.save({ useObjectStreams: true });
    results.push({
      buffer: Buffer.from(bytes),
      pageCount: part.getPageCount(),
      from,
      to,
    });
  }

  return results;
}

export async function compressPdfBuffer(buffer: Buffer): Promise<{ buffer: Buffer; pageCount: number }> {
  const doc = await loadPdfDocument(buffer);
  const bytes = await doc.save({ useObjectStreams: true });
  return { buffer: Buffer.from(bytes), pageCount: doc.getPageCount() };
}

type PdfRotation = 0 | 90 | 180 | 270;

function normalizeRotation(value: number): PdfRotation {
  const normalized = ((Math.round(value) % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) return normalized;
  return 0;
}

export async function rotatePdfBuffer(
  buffer: Buffer,
  rotation: 90 | 180 | 270,
  pageNumbers?: number[]
): Promise<{ buffer: Buffer; pageCount: number }> {
  const doc = await loadPdfDocument(buffer);
  const total = doc.getPageCount();
  const targets =
    pageNumbers?.length && pageNumbers.length > 0
      ? [...new Set(pageNumbers.filter((p) => p >= 1 && p <= total).map((p) => p - 1))]
      : doc.getPageIndices();

  if (!targets.length) {
    throw new AppError('No valid pages selected for rotation', 400);
  }

  for (const index of targets) {
    const page = doc.getPage(index);
    const current = page.getRotation().angle;
    const next = normalizeRotation(current + rotation);
    page.setRotation(pdfDegrees(next));
  }

  const bytes = await doc.save({ useObjectStreams: true });
  return { buffer: Buffer.from(bytes), pageCount: doc.getPageCount() };
}

export function sanitizePdfName(name: string, fallback = 'document.pdf'): string {
  const trimmed = name.trim() || fallback;
  const base = trimmed.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}
