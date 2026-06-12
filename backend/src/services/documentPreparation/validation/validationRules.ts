import { UPLOAD_LIMITS } from '../../../config/upload';

export const PORTAL_RULES = {
  allowedMimeTypes: ['application/pdf'],
  maxFileSizeBytes: UPLOAD_LIMITS.maxFileSizeBytes,
  warnFileSizeBytes: 10 * 1024 * 1024,
  maxPageCount: 500,
  warnPageCount: 200,
} as const;

export const BLANK_PAGE_CHAR_THRESHOLD = 25;

export const SIGNATURE_KEYWORDS =
  /\b(digitally signed|authorized signatory|authorised signatory|signature|signed by|signatory|e-?sign)/i;

export const SIGNATURE_REQUIRED_DOC_PATTERN =
  /\b(affidavit|declaration|undertaking|power of attorney|authorization letter|board resolution)/i;

export const CERTIFICATE_PATTERNS: Array<{
  type: 'iso' | 'bank_solvency' | 'license' | 'registration';
  label: string;
  detect: RegExp;
}> = [
  { type: 'iso', label: 'ISO Certificate', detect: /\bISO[\s-]?(9001|14001|27001|45001|22000)\b/i },
  {
    type: 'bank_solvency',
    label: 'Bank Solvency Certificate',
    detect: /\b(bank solvency|solvency certificate|financial solvency)\b/i,
  },
  {
    type: 'license',
    label: 'License',
    detect: /\b(PSARA|trade license|contractor license|operating license|licen[cs]e no)\b/i,
  },
  {
    type: 'registration',
    label: 'Registration',
    detect: /\b(GST registration|PF registration|ESIC registration|MSME registration|CIN registration)\b/i,
  },
];

export const EXPIRY_DATE_PATTERNS = [
  /\b(?:valid\s+(?:up\s*to|till|until|upto)|expir(?:y|es|ed)\s*(?:on|date)?|validity)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
  /\b(?:valid\s+(?:up\s*to|till|until|upto)|expir(?:y|es|ed)\s*(?:on|date)?)\s*[:\-]?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/gi,
  /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s*(?:to|-)\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
];
