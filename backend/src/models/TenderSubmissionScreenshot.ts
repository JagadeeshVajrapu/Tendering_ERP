import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITenderSubmissionScreenshot extends Document {
  tenderId: Types.ObjectId;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  localPath: string;
  caption?: string;
  uploadedBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const tenderSubmissionScreenshotSchema = new Schema<ITenderSubmissionScreenshot>(
  {
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    localPath: { type: String, required: true },
    caption: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

tenderSubmissionScreenshotSchema.index({ tenderId: 1, createdAt: -1 });

export const TenderSubmissionScreenshot = mongoose.model<ITenderSubmissionScreenshot>(
  'TenderSubmissionScreenshot',
  tenderSubmissionScreenshotSchema
);
