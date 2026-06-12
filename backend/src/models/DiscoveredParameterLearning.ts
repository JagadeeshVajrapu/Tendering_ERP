import mongoose, { Document, Schema } from 'mongoose';

export interface IDiscoveredParameterLearning extends Document {
  parameterKey: string;
  parameterName: string;
  category: string;
  serviceCategories: string[];
  frequency: number;
  examples: string[];
  aliasSuggestions: string[];
  promotedToCore: boolean;
  promotedAt?: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IDiscoveredParameterLearning>(
  {
    parameterKey: { type: String, required: true, unique: true, index: true },
    parameterName: { type: String, required: true },
    category: { type: String, default: 'Additional Tender Parameters' },
    serviceCategories: { type: [String], default: [] },
    frequency: { type: Number, default: 1 },
    examples: { type: [String], default: [] },
    aliasSuggestions: { type: [String], default: [] },
    promotedToCore: { type: Boolean, default: false },
    promotedAt: { type: Date },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'discovered_parameter_learning' }
);

export const DiscoveredParameterLearning = mongoose.model<IDiscoveredParameterLearning>(
  'DiscoveredParameterLearning',
  schema
);
