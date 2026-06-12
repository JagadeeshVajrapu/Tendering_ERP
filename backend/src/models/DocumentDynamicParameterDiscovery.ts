import mongoose, { Document, Schema, Types } from 'mongoose';

const discoveredParamSchema = new Schema(
  {
    parameter: { type: String, required: true },
    value: { type: String, required: true },
    page: { type: Number, required: true },
    confidence: { type: Number, default: 0 },
    category: { type: String, default: 'Additional Tender Parameters' },
    isCoreParameter: { type: Boolean, default: false },
    validationStatus: { type: String, default: 'VALID_DYNAMIC_PARAMETER' },
    sourceText: { type: String, default: '' },
    originalLabel: { type: String, default: '' },
    aiEvaluated: { type: Boolean, default: false },
    aiReason: { type: String, default: '' },
    discoveryMethod: { type: String, default: '' },
  },
  { _id: false }
);

export interface IDocumentDynamicParameterDiscovery extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  serviceCategory: string;
  discovered: Array<Record<string, unknown>>;
  rejected: Array<Record<string, unknown>>;
  promoted: unknown[];
  stats: Record<string, number>;
  discoveredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IDocumentDynamicParameterDiscovery>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, unique: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    serviceCategory: { type: String, default: '' },
    discovered: { type: [discoveredParamSchema], default: [] },
    rejected: { type: [discoveredParamSchema], default: [] },
    promoted: { type: Schema.Types.Mixed, default: [] },
    stats: { type: Schema.Types.Mixed, default: {} },
    discoveredAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'document_dynamic_parameter_discovery' }
);

export const DocumentDynamicParameterDiscovery = mongoose.model<IDocumentDynamicParameterDiscovery>(
  'DocumentDynamicParameterDiscovery',
  schema
);
