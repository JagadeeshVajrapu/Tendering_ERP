import path from 'path';
import fs from 'fs';

/** Resolves the runtime uploads root (project `uploads/`, not compiled `dist/`). */
export function resolveUploadsRoot(): string {
  if (process.env.UPLOADS_DIR) {
    return path.resolve(process.env.UPLOADS_DIR);
  }
  return path.resolve(process.cwd(), 'uploads');
}

export const UPLOAD_SUBDIRS = ['tenders', 'reports', 'temp', 'preparation'] as const;

export type UploadSubdir = (typeof UPLOAD_SUBDIRS)[number];

export const UPLOAD_LIMITS = {
  maxFileSizeBytes: parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || '25', 10) * 1024 * 1024,
  maxFiles: 1,
} as const;

export const ALLOWED_TENDER_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const ALLOWED_TENDER_EXTENSIONS = /\.(pdf|doc|docx)$/i;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  ...ALLOWED_TENDER_MIME_TYPES,
  'image/png',
  'image/jpeg',
  'image/tiff',
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = /\.(pdf|doc|docx|png|jpg|jpeg|tiff)$/i;

export function ensureUploadDirectories(): void {
  const root = resolveUploadsRoot();
  fs.mkdirSync(root, { recursive: true });
  for (const subdir of UPLOAD_SUBDIRS) {
    fs.mkdirSync(path.join(root, subdir), { recursive: true });
  }
}
