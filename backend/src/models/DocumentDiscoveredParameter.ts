import mongoose, { Document, Schema, Types } from 'mongoose';
import { ParameterGroup } from '../types/parameterDiscovery';

export interface IDocumentDiscoveredParameter extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  parameterName: string;
  parameterValue: string;
  pageNumber: number;
  sourceText: string;
  confidence: number;
  category: ParameterGroup;
}

const schema = new Schema<IDocumentDiscoveredParameter>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    parameterName: { type: String, required: true, index: true },
    parameterValue: { type: String, required: true },
    pageNumber: { type: Number, required: true },
    sourceText: { type: String, default: '' },
    confidence: { type: Number, default: 70 },
    category: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

schema.index({ documentId: 1, parameterName: 1, pageNumber: 1, parameterValue: 1 });

export const DocumentDiscoveredParameter = mongoose.model<IDocumentDiscoveredParameter>(
  'DocumentDiscoveredParameter',
  schema
);
