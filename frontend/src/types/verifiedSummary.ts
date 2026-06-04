import type { ExecutiveRecommendation } from './executiveRecommendation';

export interface VerifiedTableRow {
  parameter: string;
  value: string;
  confidence: number | null;
  sourcePage: number | null;
  found: boolean;
}

export interface TenderVerifiedSummary {
  tenderId: string;
  documentId: string;
  originalName?: string;
  rows: VerifiedTableRow[];
  statistics: {
    totalParameters: number;
    foundParameters: number;
    missingParameters: number;
    averageConfidence: number;
  };
  recommendation: ExecutiveRecommendation | null;
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | null;
}
