import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';
import { AppError } from '../../middleware/errorHandler';

class OcrService {
  async extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    if (mimeType === 'application/pdf' || ext === 'pdf') {
      return this.extractFromPdf(buffer);
    }
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    ) {
      return this.extractFromDocx(buffer);
    }
    if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'tiff', 'bmp'].includes(ext)) {
      return this.extractFromImage(buffer);
    }
    if (ext === 'doc') {
      throw new AppError('Legacy .doc files not supported. Please upload PDF or DOCX.', 400);
    }
    throw new AppError(`Unsupported file type: ${mimeType}`, 400);
  }

  private async extractFromPdf(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      const text = data.text?.trim() || '';
      if (text.length < 100) {
        return this.extractFromImage(buffer);
      }
      return text;
    } catch {
      throw new AppError('Failed to parse PDF. Ensure the file is a valid, readable PDF document.', 400);
    }
  }

  private async extractFromDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value?.trim() || '';
  }

  private async extractFromImage(buffer: Buffer): Promise<string> {
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      logger: () => {},
    });
    return data.text?.trim() || '';
  }
}

export const ocrService = new OcrService();
