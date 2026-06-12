import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { PreparationDocument } from '../../models/PreparationDocument';
import {
  PreparationDocumentValidation,
  IPreparationDocumentValidation,
  ValidationStatus,
} from '../../models/PreparationDocumentValidation';
import { preparationOcrService } from './preparationOcrService';
import { fileStorageService } from '../storage/fileStorageService';
import fs from 'fs/promises';
import {
  certificateExpiryCheck,
  detectBlankPages,
  detectCertificateExpiry,
  detectMissingSignature,
  runFullValidation,
  ValidationDocumentInput,
} from './validation/documentValidationEngine';

export interface DocumentValidationDto {
  id: string;
  tenderId: string;
  documentId: string;
  documentName: string;
  status: ValidationStatus;
  score: number;
  checks: IPreparationDocumentValidation['checks'];
  certificateFindings: IPreparationDocumentValidation['certificateFindings'];
  blankPages: number[];
  hasSignature: boolean;
  validatedAt: string;
  updatedAt: string;
}

export interface ValidationDashboardDto {
  tenderId: string;
  totalDocuments: number;
  validDocuments: number;
  warningDocuments: number;
  errorDocuments: number;
  unvalidatedDocuments: number;
  averageScore: number;
  validations: DocumentValidationDto[];
}

function worstStatus(statuses: ValidationStatus[]): ValidationStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('warning')) return 'warning';
  return 'valid';
}

function scoreFromChecks(checks: IPreparationDocumentValidation['checks']): number {
  if (!checks.length) return 100;
  let score = 100;
  for (const check of checks) {
    if (check.status === 'error') score -= 25;
    else if (check.status === 'warning') score -= 10;
  }
  return Math.max(0, score);
}

type ValidationRecordLike = Pick<
  IPreparationDocumentValidation,
  | 'tenderId'
  | 'documentId'
  | 'documentName'
  | 'status'
  | 'score'
  | 'checks'
  | 'certificateFindings'
  | 'blankPages'
  | 'hasSignature'
  | 'validatedAt'
  | 'updatedAt'
> & { _id: Types.ObjectId };

function toDto(record: ValidationRecordLike): DocumentValidationDto {
  return {
    id: String(record._id),
    tenderId: String(record.tenderId),
    documentId: String(record.documentId),
    documentName: record.documentName,
    status: record.status,
    score: record.score,
    checks: record.checks,
    certificateFindings: record.certificateFindings,
    blankPages: record.blankPages,
    hasSignature: record.hasSignature,
    validatedAt: record.validatedAt.toISOString(),
    updatedAt: record.updatedAt?.toISOString() || record.validatedAt.toISOString(),
  };
}

class DocumentValidationService {
  private async loadDocumentInput(
    tenderId: string,
    documentId: string
  ): Promise<{ doc: InstanceType<typeof PreparationDocument>; input: ValidationDocumentInput }> {
    if (!Types.ObjectId.isValid(documentId)) throw new AppError('Invalid document id', 400);

    const doc = await PreparationDocument.findOne({
      _id: new Types.ObjectId(documentId),
      tenderId: new Types.ObjectId(tenderId),
    });
    if (!doc) throw new AppError('Document not found', 404);

    const absolute = fileStorageService.getAbsolutePath(doc.localPath);
    const buffer = await fs.readFile(absolute);

    const ocr = await preparationOcrService.getResult(tenderId, documentId);

    return {
      doc,
      input: {
        displayName: doc.displayName,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        pageCount: doc.pageCount,
        buffer,
        ocrText: ocr?.fullText,
        ocrPages: ocr?.pages?.map((p) => ({ pageNumber: p.pageNumber, text: p.text })),
      },
    };
  }

  private async persistValidation(
    tenderId: string,
    documentId: string,
    documentName: string,
    userId: Types.ObjectId,
    result: Awaited<ReturnType<typeof runFullValidation>>
  ): Promise<DocumentValidationDto> {
    const record = await PreparationDocumentValidation.findOneAndUpdate(
      { documentId: new Types.ObjectId(documentId) },
      {
        tenderId: new Types.ObjectId(tenderId),
        documentId: new Types.ObjectId(documentId),
        documentName,
        status: result.status,
        score: result.score,
        checks: result.checks,
        certificateFindings: result.certificateFindings,
        blankPages: result.blankPages,
        hasSignature: result.hasSignature,
        validatedBy: userId,
        validatedAt: new Date(),
      },
      { upsert: true, new: true }
    );
    return toDto(record);
  }

  async validateDocument(
    tenderId: string,
    documentId: string,
    userId: Types.ObjectId
  ): Promise<DocumentValidationDto> {
    const { doc, input } = await this.loadDocumentInput(tenderId, documentId);
    const result = await runFullValidation(input);
    return this.persistValidation(tenderId, documentId, doc.displayName, userId, result);
  }

  async getDocumentValidation(
    tenderId: string,
    documentId: string
  ): Promise<DocumentValidationDto | null> {
    const record = await PreparationDocumentValidation.findOne({
      tenderId: new Types.ObjectId(tenderId),
      documentId: new Types.ObjectId(documentId),
    });
    return record ? toDto(record) : null;
  }

  async validatePackage(tenderId: string, userId: Types.ObjectId): Promise<ValidationDashboardDto> {
    const docs = await PreparationDocument.find({ tenderId: new Types.ObjectId(tenderId) });
    for (const doc of docs) {
      try {
        await this.validateDocument(tenderId, String(doc._id), userId);
      } catch {
        // Skip documents that were removed or are temporarily unavailable.
      }
    }
    return this.getDashboard(tenderId);
  }

  async getDashboard(tenderId: string): Promise<ValidationDashboardDto> {
    const [docs, validations] = await Promise.all([
      PreparationDocument.find({ tenderId: new Types.ObjectId(tenderId) }).lean(),
      PreparationDocumentValidation.find({ tenderId: new Types.ObjectId(tenderId) }).lean(),
    ]);

    const validationDtos = validations.map((v) => toDto(v as ValidationRecordLike));
    const validDocuments = validationDtos.filter((v) => v.status === 'valid').length;
    const warningDocuments = validationDtos.filter((v) => v.status === 'warning').length;
    const errorDocuments = validationDtos.filter((v) => v.status === 'error').length;
    const averageScore = validationDtos.length
      ? Math.round(validationDtos.reduce((s, v) => s + v.score, 0) / validationDtos.length)
      : 0;

    return {
      tenderId,
      totalDocuments: docs.length,
      validDocuments,
      warningDocuments,
      errorDocuments,
      unvalidatedDocuments: Math.max(0, docs.length - validationDtos.length),
      averageScore,
      validations: validationDtos,
    };
  }

  async detectExpiry(tenderId: string, documentId: string, userId: Types.ObjectId) {
    const { doc, input } = await this.loadDocumentInput(tenderId, documentId);
    const findings = detectCertificateExpiry(input);
    const check = certificateExpiryCheck(findings);
    const existing = await PreparationDocumentValidation.findOne({ documentId: doc._id });
    const checks = existing?.checks?.filter((c) => c.category !== 'certificate_expiry') || [];
    checks.push(check);
    const status = worstStatus(checks.map((c) => c.status));
    const score = scoreFromChecks(checks);

    const record = await PreparationDocumentValidation.findOneAndUpdate(
      { documentId: doc._id },
      {
        tenderId: new Types.ObjectId(tenderId),
        documentId: doc._id,
        documentName: doc.displayName,
        status,
        score,
        certificateFindings: findings,
        checks,
        validatedBy: userId,
        validatedAt: new Date(),
      },
      { upsert: true, new: true }
    );
    return { validation: toDto(record), findings };
  }

  async detectBlankPagesOnly(tenderId: string, documentId: string, userId: Types.ObjectId) {
    const { doc, input } = await this.loadDocumentInput(tenderId, documentId);
    const { check, blankPages } = await detectBlankPages(input);
    const existing = await PreparationDocumentValidation.findOne({ documentId: doc._id });
    const checks = existing?.checks?.filter((c) => c.category !== 'blank_page') || [];
    checks.push(check);

    const status = worstStatus(checks.map((c) => c.status));
    const score = scoreFromChecks(checks);

    const record = await PreparationDocumentValidation.findOneAndUpdate(
      { documentId: doc._id },
      {
        tenderId: new Types.ObjectId(tenderId),
        documentId: doc._id,
        documentName: doc.displayName,
        status,
        score,
        blankPages,
        checks,
        validatedBy: userId,
        validatedAt: new Date(),
      },
      { upsert: true, new: true }
    );
    return { validation: toDto(record), blankPages };
  }

  async detectSignatureOnly(tenderId: string, documentId: string, userId: Types.ObjectId) {
    const { doc, input } = await this.loadDocumentInput(tenderId, documentId);
    const { check, hasSignature } = detectMissingSignature(input);
    const existing = await PreparationDocumentValidation.findOne({ documentId: doc._id });
    const checks = existing?.checks?.filter((c) => c.category !== 'signature') || [];
    checks.push(check);

    const status = worstStatus(checks.map((c) => c.status));
    const score = scoreFromChecks(checks);

    const record = await PreparationDocumentValidation.findOneAndUpdate(
      { documentId: doc._id },
      {
        tenderId: new Types.ObjectId(tenderId),
        documentId: doc._id,
        documentName: doc.displayName,
        status,
        score,
        hasSignature,
        checks,
        validatedBy: userId,
        validatedAt: new Date(),
      },
      { upsert: true, new: true }
    );
    return { validation: toDto(record), hasSignature };
  }
}

export const documentValidationService = new DocumentValidationService();
