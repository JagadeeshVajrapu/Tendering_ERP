import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPreparationDocument extends Document {
  tenderId: Types.ObjectId;
  displayName: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  pageCount: number;
  localPath: string;
  uploadedBy: Types.ObjectId;
  source:
    | 'upload'
    | 'merge'
    | 'split'
    | 'compress'
    | 'rotate'
    | 'ocr'
    | 'header_footer'
    | 'watermark'
    | 'page_numbers'
    | 'template_fill'
    | 'unlock'
    | 'redact'
    | 'annotate'
    | 'highlight'
    | 'stamp'
    | 'signed'
    | 'dsc_signed';
  metadata: Record<string, unknown>;
}

const preparationDocumentSchema = new Schema<IPreparationDocument>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    displayName: { type: String, required: true, trim: true },
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true, default: 'application/pdf' },
    fileSize: { type: Number, required: true, default: 0 },
    pageCount: { type: Number, required: true, default: 0 },
    localPath: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    source: {
      type: String,
      enum: [
        'upload',
        'merge',
        'split',
        'compress',
        'rotate',
        'ocr',
        'header_footer',
        'watermark',
        'page_numbers',
        'template_fill',
        'unlock',
        'redact',
        'annotate',
        'highlight',
        'stamp',
        'signed',
        'dsc_signed',
      ],
      default: 'upload',
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

preparationDocumentSchema.index({ tenderId: 1, createdAt: -1 });

export const PreparationDocument = mongoose.model<IPreparationDocument>(
  'PreparationDocument',
  preparationDocumentSchema
);
