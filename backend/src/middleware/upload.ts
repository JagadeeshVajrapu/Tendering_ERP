import multer from 'multer';
import {
  UPLOAD_LIMITS,
  ALLOWED_TENDER_MIME_TYPES,
  ALLOWED_TENDER_EXTENSIONS,
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_DOCUMENT_EXTENSIONS,
} from '../config/upload';

function createMemoryUpload(allowedMimes: readonly string[], allowedExt: RegExp, label: string) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: UPLOAD_LIMITS.maxFileSizeBytes,
      files: UPLOAD_LIMITS.maxFiles,
    },
    fileFilter: (_req, file, cb) => {
      const mimeOk = allowedMimes.includes(file.mimetype);
      const extOk = allowedExt.test(file.originalname);
      if (mimeOk || extOk) {
        cb(null, true);
        return;
      }
      cb(new Error(`Invalid file type. Allowed: ${label}`));
    },
  });
}

/** Tender Analysis module: PDF, DOC, DOCX */
export const tenderAnalysisUpload = createMemoryUpload(
  ALLOWED_TENDER_MIME_TYPES,
  ALLOWED_TENDER_EXTENSIONS,
  'PDF, DOC, DOCX'
);

/** Legacy NIT upload: PDF, DOCX, images */
export const tenderDocumentUpload = createMemoryUpload(
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_DOCUMENT_EXTENSIONS,
  'PDF, DOCX, PNG, JPEG, TIFF'
);
