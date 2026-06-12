import mongoose, { Document, Schema, Types } from 'mongoose';
import { TenderDocumentSectionType, TenderIntelligenceType } from '../types/tenderIntelligenceLayer';

export interface ITenderDocumentSection {
  section: TenderDocumentSectionType;
  confidence: number;
  pages: number[];
  startPage?: number;
  endPage?: number;
  matchedKeywords: string[];
}

export interface IPageSectionClassification {
  page: number;
  primarySection: TenderDocumentSectionType | string;
  primaryConfidence: number;
  sections: Array<{
    section: TenderDocumentSectionType | string;
    confidence: number;
    matchedKeywords: string[];
  }>;
}

export interface ITenderIntelligenceLayer extends Document {
  documentId: Types.ObjectId;
  tenderId: Types.ObjectId;
  tenderType: TenderIntelligenceType | '';
  confidence: number;
  sections: ITenderDocumentSection[];
  pageClassifications: IPageSectionClassification[];
  typeScores: Record<string, number>;
  pagesScanned: number;
  analyzedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sectionSchema = new Schema<ITenderDocumentSection>(
  {
    section: { type: String, required: true },
    confidence: { type: Number, default: 0 },
    pages: { type: [Number], default: [] },
    startPage: { type: Number },
    endPage: { type: Number },
    matchedKeywords: { type: [String], default: [] },
  },
  { _id: false }
);

const pageClassificationSchema = new Schema(
  {
    page: { type: Number, required: true },
    primarySection: { type: String, default: '' },
    primaryConfidence: { type: Number, default: 0 },
    sections: {
      type: [
        {
          section: { type: String, required: true },
          confidence: { type: Number, default: 0 },
          matchedKeywords: { type: [String], default: [] },
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

const schema = new Schema<ITenderIntelligenceLayer>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'TenderDocument', required: true, unique: true, index: true },
    tenderId: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    tenderType: { type: String, default: '' },
    confidence: { type: Number, default: 0 },
    sections: { type: [sectionSchema], default: [] },
    pageClassifications: { type: [pageClassificationSchema], default: [] },
    typeScores: { type: Schema.Types.Mixed, default: {} },
    pagesScanned: { type: Number, default: 0 },
    analyzedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'tender_intelligence_layers',
  }
);

export const TenderIntelligenceLayer = mongoose.model<ITenderIntelligenceLayer>(
  'TenderIntelligenceLayer',
  schema
);
