import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { fileStorageService } from '../storage/fileStorageService';
import { s3Service } from '../s3/s3Service';
import { env } from '../../config/env';
import { tenderRepository, tenderDocumentRepository } from '../../repositories/tenderRepository';
import { TenderStatus } from '../../types';

export interface SaveUploadResult {
  tender: Awaited<ReturnType<typeof tenderRepository.findById>>;
  document: Awaited<ReturnType<typeof tenderDocumentRepository.create>>;
}

class UploadService {
  /** Save file only — text extraction happens in intelligence pipeline phases. */
  async saveTenderDocument(
    file: Express.Multer.File,
    userId: Types.ObjectId,
    options: { title?: string; tenderId?: string }
  ): Promise<SaveUploadResult> {
    let tenderId = options.tenderId;

    if (tenderId) {
      const existing = await tenderRepository.findById(tenderId);
      if (!existing) throw new AppError('Tender not found', 404);
    } else {
      const tender = await tenderRepository.create({
        title: options.title || file.originalname.replace(/\.[^.]+$/, ''),
        createdBy: userId,
        assignedExecutive: userId,
        status: TenderStatus.DRAFT,
        currentStage: 'Document Uploaded',
      });
      tenderId = String(tender._id);
    }

    const { fileName, relativePath } = await fileStorageService.saveFile(
      file.buffer,
      file.originalname,
      `tenders/${tenderId}`
    );

    let s3Key = relativePath;
    let s3Url = fileStorageService.getPublicUrl(relativePath);

    if (env.aws.accessKeyId) {
      try {
        const s3Result = await s3Service.uploadFile(
          file.buffer,
          file.originalname,
          file.mimetype,
          `tenders/${tenderId}`
        );
        s3Key = s3Result.key;
        s3Url = s3Result.url;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[UploadService] S3 upload failed, using local storage:', msg);
        // Keep local path URLs. This prevents dev from breaking when S3 bucket is missing.
        s3Key = relativePath;
        s3Url = fileStorageService.getPublicUrl(relativePath);
      }
    }

    const document = await tenderDocumentRepository.create({
      tenderId: new Types.ObjectId(tenderId),
      fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      s3Key,
      s3Url,
      localPath: relativePath,
      documentType: 'NIT',
      uploadedBy: userId,
      pageCount: 0,
    });

    await tenderRepository.setStatus(tenderId, TenderStatus.DRAFT, 'Analyzing Document...');

    const tender = await tenderRepository.findById(tenderId);
    return { tender, document };
  }
}

export const uploadService = new UploadService();
