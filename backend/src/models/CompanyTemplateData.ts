import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICompanyTemplateData extends Document {
  companyName: string;
  gst: string;
  pan: string;
  address: string;
  cin: string;
  msme: string;
  email?: string;
  phone?: string;
  updatedBy?: Types.ObjectId;
}

const companyTemplateDataSchema = new Schema<ICompanyTemplateData>(
  {
    companyName: { type: String, default: '', trim: true },
    gst: { type: String, default: '', trim: true },
    pan: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    cin: { type: String, default: '', trim: true },
    msme: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

/** Single org-wide company profile document (singleton). */
companyTemplateDataSchema.index({ createdAt: 1 });

export const CompanyTemplateData = mongoose.model<ICompanyTemplateData>(
  'CompanyTemplateData',
  companyTemplateDataSchema
);
