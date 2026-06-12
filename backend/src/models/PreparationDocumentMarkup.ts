import mongoose, { Document, Schema, Types } from 'mongoose';

export type MarkupType = 'annotation' | 'highlight' | 'redaction' | 'stamp';

export interface IMarkupRegion {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  color?: string;
  stampLabel?: string;
}

export interface IPreparationDocumentMarkup extends Document {
  tenderId: Types.ObjectId;
  documentId: Types.ObjectId;
  markupType: MarkupType;
  regions: IMarkupRegion[];
  appliedDocumentId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  metadata?: Record<string, unknown>;
}

const markupRegionSchema = new Schema<IMarkupRegion>(
  {
    pageNumber: { type: Number, required: true, min: 1 },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    text: { type: String },
    color: { type: String },
    stampLabel: { type: String },
  },
  { _id: false }
);

const preparationDocumentMarkupSchema = new Schema<IPreparationDocumentMarkup>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'PreparationDocument', required: true, index: true },
    markupType: {
      type: String,
      enum: ['annotation', 'highlight', 'redaction', 'stamp'],
      required: true,
    },
    regions: { type: [markupRegionSchema], default: [] },
    appliedDocumentId: { type: Schema.Types.ObjectId, ref: 'PreparationDocument' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

preparationDocumentMarkupSchema.index({ tenderId: 1, documentId: 1, createdAt: -1 });

export const PreparationDocumentMarkup = mongoose.model<IPreparationDocumentMarkup>(
  'PreparationDocumentMarkup',
  preparationDocumentMarkupSchema
);
