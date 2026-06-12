import mongoose, { Document, Schema, Types } from 'mongoose';
import { PostAwardDocumentType } from '../types/postAward';

export interface IPostAwardDocument extends Document {
  contractId: Types.ObjectId;
  tenderId: Types.ObjectId;
  documentType: PostAwardDocumentType;
  fileName: string;
  originalName: string;
  localPath: string;
  mimeType: string;
  fileSize: number;
  documentNumber?: string;
  uploadedBy: Types.ObjectId;
  createdAt?: Date;
}

const postAwardDocumentSchema = new Schema<IPostAwardDocument>(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'PostAwardContract', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    documentType: {
      type: String,
      enum: ['work_order', 'agreement', 'purchase_order'],
      required: true,
    },
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    localPath: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    documentNumber: { type: String, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'post_award_documents' }
);

export const PostAwardDocument = mongoose.model<IPostAwardDocument>(
  'PostAwardDocument',
  postAwardDocumentSchema
);
