import mongoose, { Document, Schema, Types } from 'mongoose';

export type ChecklistReviewStatus = 'pending' | 'approved' | 'rejected';

export interface IChecklistItemWorkflowState extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  itemId: string;
  markedComplete: boolean;
  markedCompleteBy?: Types.ObjectId;
  markedCompleteAt?: Date;
  reviewStatus?: ChecklistReviewStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  linkedDocumentId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IChecklistItemWorkflowState>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    itemId: { type: String, required: true },
    markedComplete: { type: Boolean, default: false },
    markedCompleteBy: { type: Schema.Types.ObjectId, ref: 'User' },
    markedCompleteAt: { type: Date },
    reviewStatus: { type: String, enum: ['pending', 'approved', 'rejected'] },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String, default: '' },
    linkedDocumentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument' },
  },
  {
    timestamps: true,
    collection: 'tender_checklist_item_states',
  }
);

schema.index({ documentId: 1, itemId: 1 }, { unique: true });

export const TenderChecklistItemState = mongoose.model<IChecklistItemWorkflowState>(
  'TenderChecklistItemState',
  schema
);
