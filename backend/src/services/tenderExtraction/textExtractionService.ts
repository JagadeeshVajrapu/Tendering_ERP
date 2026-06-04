import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { textractService } from './textractService';
import { detectByMimeAndExt, DetectedFileType } from './fileTypeDetector';

export interface TextExtractionResult {
  detectedType: DetectedFileType;
  extractedText: string;
  method: 'pdf-parse' | 'mammoth' | 'textract';
}

class TextExtractionService {
  async extract(buffer: Buffer, mimeType: string, fileName: string, s3?: { key: string; bucket: string }) {
    const baseType = detectByMimeAndExt(mimeType, fileName);

    if (baseType === 'docx') {
      const result = await mammoth.extractRawText({ buffer });
      return {
        detectedType: 'docx' as const,
        extractedText: (result.value || '').trim(),
        method: 'mammoth' as const,
      };
    }

    if (baseType === 'image') {
      const extractedText = await textractService.detectTextFromImageBytes(buffer);
      return { detectedType: 'image' as const, extractedText, method: 'textract' as const };
    }

    if (baseType === 'digital_pdf') {
      // Attempt digital parse first
      try {
        const data = await pdfParse(buffer);
        const text = (data.text || '').trim();
        if (text.length >= 150) {
          return { detectedType: 'digital_pdf' as const, extractedText: text, method: 'pdf-parse' as const };
        }
      } catch {
        // fall through to scanned path
      }

      // Scanned PDF path: AWS Textract (requires S3)
      if (!env.aws.accessKeyId) {
        throw new AppError(
          'Scanned PDF detected but AWS Textract is not configured. Set AWS_* env vars and upload to S3.',
          500
        );
      }
      if (!s3?.key || !s3.bucket) {
        throw new AppError('Scanned PDF OCR requires S3 object key + bucket for AWS Textract.', 500);
      }

      const extractedText = await textractService.detectTextFromS3Pdf({ bucket: s3.bucket, key: s3.key });
      return { detectedType: 'scanned_pdf' as const, extractedText, method: 'textract' as const };
    }

    throw new AppError(`Unsupported file type: ${mimeType}`, 400);
  }
}

export const textExtractionService = new TextExtractionService();

