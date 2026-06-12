import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IEnterpriseMasterDatasetVersion extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  version: number;
  parameterCount: number;
  parameters: unknown[];
  statistics: Record<string, unknown>;
  changeSummary: {
    added: number;
    removed: number;
    valueChanged: number;
  };
  builtAt: Date;
  createdAt: Date;
}

const schema = new Schema<IEnterpriseMasterDatasetVersion>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true },
    version: { type: Number, required: true },
    parameterCount: { type: Number, default: 0 },
    parameters: { type: Schema.Types.Mixed, default: [] },
    statistics: { type: Schema.Types.Mixed, default: {} },
    changeSummary: {
      added: { type: Number, default: 0 },
      removed: { type: Number, default: 0 },
      valueChanged: { type: Number, default: 0 },
    },
    builtAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'enterprise_master_dataset_versions',
  }
);

schema.index({ documentId: 1, version: 1 }, { unique: true });

export const EnterpriseMasterDatasetVersion = mongoose.model<IEnterpriseMasterDatasetVersion>(
  'EnterpriseMasterDatasetVersion',
  schema
);
