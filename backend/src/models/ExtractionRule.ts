import mongoose, { Document, Schema } from 'mongoose';

export interface IExtractionRule extends Document {
  fieldName: string;
  aliases: string[];
  regexPatterns: string[];
  priority: number;
  active: boolean;
}

const extractionRuleSchema = new Schema<IExtractionRule>(
  {
    fieldName: { type: String, required: true, index: true },
    aliases: { type: [String], default: [] },
    regexPatterns: { type: [String], default: [] },
    priority: { type: Number, default: 1 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

extractionRuleSchema.index({ fieldName: 1, active: 1, priority: -1 });

export const ExtractionRule = mongoose.model<IExtractionRule>('ExtractionRule', extractionRuleSchema);

