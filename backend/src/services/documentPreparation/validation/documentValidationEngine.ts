import pdfParse from 'pdf-parse';
import { UPLOAD_LIMITS } from '../../../config/upload';
import { IValidationCheck, ICertificateFinding, ValidationStatus } from '../../../models/PreparationDocumentValidation';
import { loadPdfDocument } from '../pdfUtilityService';
import {
  BLANK_PAGE_CHAR_THRESHOLD,
  CERTIFICATE_PATTERNS,
  PORTAL_RULES,
  SIGNATURE_KEYWORDS,
  SIGNATURE_REQUIRED_DOC_PATTERN,
} from './validationRules';
import { daysUntil, extractExpiryDates } from './dateParsingUtils';

export interface ValidationDocumentInput {
  displayName: string;
  mimeType: string;
  fileSize: number;
  pageCount: number;
  buffer: Buffer;
  ocrText?: string;
  ocrPages?: Array<{ pageNumber: number; text: string }>;
}

export interface ValidationEngineResult {
  status: ValidationStatus;
  score: number;
  checks: IValidationCheck[];
  certificateFindings: ICertificateFinding[];
  blankPages: number[];
  hasSignature: boolean;
}

function worstStatus(statuses: ValidationStatus[]): ValidationStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('warning')) return 'warning';
  return 'valid';
}

function scoreFromChecks(checks: IValidationCheck[]): number {
  if (!checks.length) return 100;
  let score = 100;
  for (const check of checks) {
    if (check.status === 'error') score -= 25;
    else if (check.status === 'warning') score -= 10;
  }
  return Math.max(0, score);
}

async function extractPageTexts(buffer: Buffer, ocrPages?: Array<{ pageNumber: number; text: string }>) {
  if (ocrPages?.length) return ocrPages;
  const pages: Array<{ pageNumber: number; text: string }> = [];
  let pageIndex = 0;
  await pdfParse(buffer, {
    pagerender: async (pageData) => {
      pageIndex += 1;
      const textContent = await pageData.getTextContent();
      const text = textContent.items
        .map((item: { str?: string }) => (item.str ? String(item.str) : ''))
        .join(' ')
        .trim();
      pages.push({ pageNumber: pageIndex, text });
      return text;
    },
  });
  return pages;
}

export function validateFileSize(fileSize: number): IValidationCheck {
  const maxMb = PORTAL_RULES.maxFileSizeBytes / (1024 * 1024);
  const warnMb = PORTAL_RULES.warnFileSizeBytes / (1024 * 1024);
  const sizeMb = +(fileSize / (1024 * 1024)).toFixed(2);

  if (fileSize > PORTAL_RULES.maxFileSizeBytes) {
    return {
      id: 'file_size',
      category: 'file_size',
      status: 'error',
      message: `File size ${sizeMb} MB exceeds portal limit of ${maxMb} MB`,
      details: { fileSize, maxBytes: PORTAL_RULES.maxFileSizeBytes },
    };
  }
  if (fileSize > PORTAL_RULES.warnFileSizeBytes) {
    return {
      id: 'file_size',
      category: 'file_size',
      status: 'warning',
      message: `File size ${sizeMb} MB is large (portal recommends under ${warnMb} MB)`,
      details: { fileSize, warnBytes: PORTAL_RULES.warnFileSizeBytes },
    };
  }
  return {
    id: 'file_size',
    category: 'file_size',
    status: 'valid',
    message: `File size ${sizeMb} MB is within portal limits`,
    details: { fileSize },
  };
}

export async function validatePortalFormat(input: ValidationDocumentInput): Promise<IValidationCheck> {
  const issues: string[] = [];
  let status: ValidationStatus = 'valid';

  if (!PORTAL_RULES.allowedMimeTypes.includes(input.mimeType as 'application/pdf')) {
    issues.push(`MIME type ${input.mimeType} is not accepted (PDF required)`);
    status = 'error';
  }

  try {
    await loadPdfDocument(input.buffer);
  } catch {
    issues.push('PDF is corrupted or encrypted and may be rejected by the portal');
    status = worstStatus([status, 'error']);
  }

  if (input.pageCount > PORTAL_RULES.maxPageCount) {
    issues.push(`Page count ${input.pageCount} exceeds portal maximum (${PORTAL_RULES.maxPageCount})`);
    status = worstStatus([status, 'error']);
  } else if (input.pageCount > PORTAL_RULES.warnPageCount) {
    issues.push(`Page count ${input.pageCount} is high (recommended under ${PORTAL_RULES.warnPageCount})`);
    status = worstStatus([status, 'warning']);
  }

  if (!issues.length) {
    return {
      id: 'portal_format',
      category: 'portal_format',
      status: 'valid',
      message: 'Document meets portal format requirements (PDF, readable, page count OK)',
      details: { mimeType: input.mimeType, pageCount: input.pageCount },
    };
  }

  return {
    id: 'portal_format',
    category: 'portal_format',
    status,
    message: issues.join('; '),
    details: { mimeType: input.mimeType, pageCount: input.pageCount, issues },
  };
}

export async function detectBlankPages(
  input: ValidationDocumentInput
): Promise<{ check: IValidationCheck; blankPages: number[] }> {
  const pages = await extractPageTexts(input.buffer, input.ocrPages);
  const blankPages = pages
    .filter((p) => p.text.replace(/\s+/g, '').length < BLANK_PAGE_CHAR_THRESHOLD)
    .map((p) => p.pageNumber);

  if (!blankPages.length) {
    return {
      blankPages: [],
      check: {
        id: 'blank_page',
        category: 'blank_page',
        status: 'valid',
        message: 'No blank pages detected',
        details: { blankPages: [] },
      },
    };
  }

  const status: ValidationStatus = blankPages.length > 2 ? 'error' : 'warning';
  return {
    blankPages,
    check: {
      id: 'blank_page',
      category: 'blank_page',
      status,
      message: `Blank pages detected: ${blankPages.join(', ')}`,
      details: { blankPages, threshold: BLANK_PAGE_CHAR_THRESHOLD },
    },
  };
}

export function detectMissingSignature(input: ValidationDocumentInput): {
  check: IValidationCheck;
  hasSignature: boolean;
} {
  const text = `${input.displayName}\n${input.ocrText || ''}`;
  const hasSignature = SIGNATURE_KEYWORDS.test(text);
  const requiresSignature = SIGNATURE_REQUIRED_DOC_PATTERN.test(input.displayName);

  if (hasSignature) {
    return {
      hasSignature: true,
      check: {
        id: 'signature',
        category: 'signature',
        status: 'valid',
        message: 'Signature indicators found in document',
        details: { hasSignature: true },
      },
    };
  }

  if (requiresSignature) {
    return {
      hasSignature: false,
      check: {
        id: 'signature',
        category: 'signature',
        status: 'error',
        message: 'Document type typically requires a signature but none was detected',
        details: { hasSignature: false, requiresSignature: true },
      },
    };
  }

  return {
    hasSignature: false,
    check: {
      id: 'signature',
      category: 'signature',
      status: 'warning',
      message: 'No signature indicators detected — verify if signing is required',
      details: { hasSignature: false },
    },
  };
}

export function detectCertificateExpiry(input: ValidationDocumentInput): ICertificateFinding[] {
  const text = input.ocrText || '';
  const findings: ICertificateFinding[] = [];
  const now = new Date();

  for (const cert of CERTIFICATE_PATTERNS) {
    if (!cert.detect.test(text) && !cert.detect.test(input.displayName)) continue;

    const snippetStart = Math.max(0, text.search(cert.detect) - 80);
    const snippet = text.slice(snippetStart, snippetStart + 400);
    const dates = extractExpiryDates(snippet.length ? snippet : text);

    if (!dates.length) {
      findings.push({
        type: cert.type,
        name: cert.label,
        status: 'unknown',
        evidence: snippet.slice(0, 120) || input.displayName,
      });
      continue;
    }

    const expiry = dates.sort((a, b) => b.getTime() - a.getTime())[0];
    const days = daysUntil(expiry, now);
    let status: ValidationStatus | 'unknown' = 'valid';
    if (days < 0) status = 'error';
    else if (days <= 30) status = 'warning';

    findings.push({
      type: cert.type,
      name: cert.label,
      status,
      expiryDate: expiry.toISOString().slice(0, 10),
      daysUntilExpiry: days,
      evidence: snippet.slice(0, 120),
    });
  }

  return findings;
}

export function certificateExpiryCheck(findings: ICertificateFinding[]): IValidationCheck {
  if (!findings.length) {
    return {
      id: 'certificate_expiry',
      category: 'certificate_expiry',
      status: 'valid',
      message: 'No certificate expiry issues detected',
      details: { findings: [] },
    };
  }

  const statuses = findings.map((f) => (f.status === 'unknown' ? 'warning' : f.status)) as ValidationStatus[];
  const status = worstStatus(statuses);
  const expired = findings.filter((f) => f.status === 'error');
  const expiring = findings.filter((f) => f.status === 'warning');

  let message = 'Certificate monitoring complete';
  if (expired.length) message = `${expired.length} expired certificate(s) found`;
  else if (expiring.length) message = `${expiring.length} certificate(s) expiring within 30 days`;
  else if (findings.some((f) => f.status === 'unknown')) {
    message = 'Certificates detected but expiry date could not be parsed';
  }

  return {
    id: 'certificate_expiry',
    category: 'certificate_expiry',
    status,
    message,
    details: { findings },
  };
}

export async function runFullValidation(input: ValidationDocumentInput): Promise<ValidationEngineResult> {
  const fileSizeCheck = validateFileSize(input.fileSize);
  const portalCheck = await validatePortalFormat(input);
  const { check: blankCheck, blankPages } = await detectBlankPages(input);
  const { check: signatureCheck, hasSignature } = detectMissingSignature(input);
  const certificateFindings = detectCertificateExpiry(input);
  const certCheck = certificateExpiryCheck(certificateFindings);

  const checks = [fileSizeCheck, portalCheck, blankCheck, signatureCheck, certCheck];
  const status = worstStatus(checks.map((c) => c.status));
  const score = scoreFromChecks(checks);

  return {
    status,
    score,
    checks,
    certificateFindings,
    blankPages,
    hasSignature,
  };
}

export { UPLOAD_LIMITS };
