import { Types } from 'mongoose';
import { AppError } from '../middleware/errorHandler';
import { DocumentPage } from '../models/DocumentPage';
import { TenderDocument } from '../models/TenderDocument';
import { Tender } from '../models/Tender';

export const OCR_PENDING_MESSAGE =
  'OCR is still processing. This view will populate automatically when page text is ready.';

export interface DocumentOcrReadiness {
  ready: boolean;
  documentId: Types.ObjectId;
  tenderId?: Types.ObjectId;
  originalName?: string;
  pageCount: number;
}

export function assertDocumentFound(readiness: DocumentOcrReadiness | null): asserts readiness is DocumentOcrReadiness {
  if (!readiness) throw new AppError('Document not found', 404);
}

export async function getDocumentOcrReadiness(documentId: Types.ObjectId): Promise<DocumentOcrReadiness | null> {
  const document = await TenderDocument.findById(documentId);
  if (!document) return null;
  const pageCount = await DocumentPage.countDocuments({ documentId });
  return {
    ready: pageCount > 0,
    documentId: document._id,
    tenderId: document.tenderId,
    originalName: document.originalName,
    pageCount,
  };
}

export async function getTenderDocumentOcrReadiness(tenderId: string) {
  const tender = await Tender.findById(tenderId);
  if (!tender) return null;
  const document = await TenderDocument.findOne({ tenderId: tender._id }).sort({ createdAt: -1 });
  if (!document) return null;
  const pageCount = await DocumentPage.countDocuments({ documentId: document._id });
  return {
    ready: pageCount > 0,
    document,
    documentId: document._id,
    tenderId: tender._id,
    originalName: document.originalName,
    pageCount,
  };
}
