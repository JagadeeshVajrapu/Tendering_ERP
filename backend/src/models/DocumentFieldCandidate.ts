import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDocumentFieldCandidate extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId?: Types.ObjectId;
  fieldName: string;
  candidateValue: string;
  sourcePage: number;
  sourceText: string;
  detectionMethod?: string;
  confidence?: number;
}

const documentFieldCandidateSchema = new Schema<IDocumentFieldCandidate>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'IntelligenceJob', index: true },
    fieldName: { type: String, required: true, index: true },
    candidateValue: { type: String, required: true },
    sourcePage: { type: Number, required: true },
    sourceText: { type: String, default: '' },
    detectionMethod: { type: String, default: 'pattern' },
    confidence: { type: Number },
  },
  { timestamps: true }
);

documentFieldCandidateSchema.index({ documentId: 1, fieldName: 1, sourcePage: 1 });

export const DocumentFieldCandidate = mongoose.model<IDocumentFieldCandidate>(
  'DocumentFieldCandidate',
  documentFieldCandidateSchema
);
