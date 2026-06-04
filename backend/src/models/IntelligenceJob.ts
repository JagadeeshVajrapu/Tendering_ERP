import mongoose, { Document, Schema, Types } from 'mongoose';
import { IntelligenceJobStatus } from '../types/intelligence';
import { ChunkProcessingStatistics } from '../types/chunkProcessing';

export interface IIntelligenceJob extends Document {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  status: IntelligenceJobStatus;
  progress: number;
  pageCount: number;
  chunkCount: number;
  chunksProcessed: number;
  totalChunkPasses: number;
  passesCompleted: number;
  chunkStatistics?: ChunkProcessingStatistics;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const intelligenceJobSchema = new Schema<IIntelligenceJob>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    status: {
      type: String,
      enum: [
        'queued',
        'extracting_pages',
        'chunking',
        'analyzing',
        'merging',
        'validating',
        'generating_report',
        'completed',
        'failed',
      ],
      default: 'queued',
    },
    progress: { type: Number, default: 0 },
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    chunksProcessed: { type: Number, default: 0 },
    totalChunkPasses: { type: Number, default: 0 },
    passesCompleted: { type: Number, default: 0 },
    chunkStatistics: {
      totalChunks: { type: Number },
      totalPages: { type: Number },
      chunksProcessed: { type: Number },
      chunksFailed: { type: Number },
      totalProcessingTimeMs: { type: Number },
      averageChunkProcessingTimeMs: { type: Number },
      minChunkProcessingTimeMs: { type: Number },
      maxChunkProcessingTimeMs: { type: Number },
      totalTablesExtracted: { type: Number },
      totalCharacters: { type: Number },
      chunks: [
        {
          chunkNumber: { type: Number },
          startPage: { type: Number },
          endPage: { type: Number },
          pageNumbers: [{ type: Number }],
          characterCount: { type: Number },
          tablesExtracted: { type: Number },
          processingTimeMs: { type: Number },
          status: { type: String, enum: ['completed', 'failed'] },
          error: { type: String },
        },
      ],
    },
    errorMessage: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const IntelligenceJob = mongoose.model<IIntelligenceJob>('IntelligenceJob', intelligenceJobSchema);
