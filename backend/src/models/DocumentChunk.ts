import mongoose, { Document, Schema, Types } from 'mongoose';
import { ExtractionPass } from '../types/intelligence';

export interface IDocumentChunk extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  jobId: Types.ObjectId;
  chunkNumber: number;
  startPage: number;
  endPage: number;
  text: string;
  pageNumbers: number[];
  characterCount?: number;
  processingTimeMs?: number;
  tablesExtracted?: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
}

export interface IChunkExtraction extends Document {
  chunkId: Types.ObjectId;
  documentId: Types.ObjectId;
  jobId: Types.ObjectId;
  chunkNumber: number;
  pass: ExtractionPass;
  fields: Record<string, unknown>;
  rawJson: string;
  aiModel: string;
  tokensUsed?: number;
}

const documentChunkSchema = new Schema<IDocumentChunk>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'IntelligenceJob', required: true, index: true },
    chunkNumber: { type: Number, required: true },
    startPage: { type: Number, required: true },
    endPage: { type: Number, required: true },
    text: { type: String, required: true },
    pageNumbers: [{ type: Number }],
    characterCount: { type: Number, default: 0 },
    processingTimeMs: { type: Number },
    tablesExtracted: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

const chunkExtractionSchema = new Schema<IChunkExtraction>(
  {
    chunkId: { type: Schema.Types.ObjectId, ref: 'DocumentChunk', required: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'IntelligenceJob', required: true, index: true },
    chunkNumber: { type: Number, required: true },
    pass: {
      type: String,
      enum: [
        'rule',
        'general',
        'scope',
        'eligibility',
        'financial',
        'documents',
        'dates',
        'compliance',
        'risks',
        'executive',
      ],
      required: true,
    },
    fields: { type: Schema.Types.Mixed, default: {} },
    rawJson: { type: String, default: '{}' },
    aiModel: { type: String, default: '' },
    tokensUsed: { type: Number },
  },
  { timestamps: true }
);

documentChunkSchema.index({ jobId: 1, chunkNumber: 1 }, { unique: true });
chunkExtractionSchema.index({ jobId: 1, chunkNumber: 1, pass: 1 }, { unique: true });

export const DocumentChunk = mongoose.model<IDocumentChunk>('DocumentChunk', documentChunkSchema);
export const ChunkExtraction = mongoose.model<IChunkExtraction>('ChunkExtraction', chunkExtractionSchema);
