import { AppError } from '../../middleware/errorHandler';
import { OcrPageResult, OcrQualityMetrics } from '../../types/ocr';
import { PageText } from '../../types/intelligence';

const MIN_MEANINGFUL_CHARS = 40;
const TARGET_CHARS_PER_PAGE = 2000;

export const OCR_MIN_QUALITY_SCORE = parseInt(process.env.OCR_MIN_QUALITY_SCORE || '70', 10);

export const OCR_QUALITY_TOO_LOW = 'OCR quality too low';

export function buildOcrQualityMetrics(pages: OcrPageResult[]): OcrQualityMetrics {
  const pageCount = pages.length;
  const totalCharacters = pages.reduce((sum, p) => sum + p.characterCount, 0);
  const averageCharactersPerPage = pageCount
    ? Math.round(totalCharacters / pageCount)
    : 0;

  const nonEmptyPages = pages.filter((p) => p.characterCount >= MIN_MEANINGFUL_CHARS).length;
  const coverageRatio = pageCount ? nonEmptyPages / pageCount : 0;
  const densityRatio = Math.min(1, averageCharactersPerPage / TARGET_CHARS_PER_PAGE);

  const qualityScore = Math.round(
    Math.min(100, coverageRatio * 55 + densityRatio * 45)
  );

  return {
    pages: pageCount,
    totalCharacters,
    averageCharactersPerPage,
    qualityScore,
  };
}

export function buildOcrQualityMetricsFromPages(pages: PageText[]): OcrQualityMetrics {
  return buildOcrQualityMetrics(
    pages.map((p) => ({
      pageNumber: p.pageNumber,
      text: p.text,
      characterCount: p.charCount,
    }))
  );
}

/** Prefer live page stats; fall back to stored metrics when pages are empty. */
export function resolveOcrQualityMetrics(
  stored: Partial<OcrQualityMetrics> | null | undefined,
  pages: PageText[]
): OcrQualityMetrics {
  if (pages.length) return buildOcrQualityMetricsFromPages(pages);
  if (
    stored &&
    typeof stored.qualityScore === 'number' &&
    typeof stored.totalCharacters === 'number' &&
    typeof stored.averageCharactersPerPage === 'number'
  ) {
    return {
      pages: stored.pages ?? 0,
      totalCharacters: stored.totalCharacters,
      averageCharactersPerPage: stored.averageCharactersPerPage,
      qualityScore: stored.qualityScore,
    };
  }
  return { pages: 0, totalCharacters: 0, averageCharactersPerPage: 0, qualityScore: 0 };
}

export function assertOcrQuality(metrics: OcrQualityMetrics): void {
  if (metrics.qualityScore < OCR_MIN_QUALITY_SCORE) {
    throw new AppError(OCR_QUALITY_TOO_LOW, 422);
  }
}
