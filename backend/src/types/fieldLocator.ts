export type FieldLocatorFieldName =
  | 'Tender Number'
  | 'Organization'
  | 'EMD'
  | 'Tender Value'
  | 'Name of Work';

export type FieldLocatorMethod = 'regex' | 'keyword' | 'alias';

export interface KeywordMatchRecord {
  page: number;
  keyword: string;
  context: string;
  charIndex: number;
}

export interface ScoredAmountCandidateRecord {
  page: number;
  keyword: string;
  amount: string;
  score: number;
  scoreBreakdown: string[];
  distanceFromKeyword: number;
  selected?: boolean;
}

export interface EmdExtractionCandidateDebug {
  amount: string;
  page: number;
  context: string;
  keyword: string;
  pageWeight: number;
  accepted: boolean;
  reasonAccepted?: string;
  reasonRejected?: string;
  selected?: boolean;
}

export interface EmdPercentageValidation {
  emdPercent: number;
  tenderValue: string;
  calculatedEmd: string;
  matched: boolean;
  matchedAmount: string | null;
  tolerancePercent: number;
}

export interface TenderValueExtractionCandidateDebug {
  label: string;
  amount: string;
  page: number;
  context: string;
  pageWeight: number;
  accepted: boolean;
  reasonAccepted?: string;
  reasonRejected?: string;
  selected?: boolean;
}

export interface TenderValueCrossValidation {
  emdAmount: string;
  emdPercent: number;
  calculatedTenderValue: string;
  formula: string;
  matched: boolean;
  matchedAmount: string | null;
  tolerancePercent: number;
}

export interface AmountExtractionDebug {
  keywordFound: string | null;
  allAmountsFound: string[];
  selectedAmount: string | null;
  distanceFromKeyword: number | null;
  keywordMatches?: KeywordMatchRecord[];
  scoredCandidates?: ScoredAmountCandidateRecord[];
  emdCandidates?: EmdExtractionCandidateDebug[];
  percentageValidation?: EmdPercentageValidation | null;
  emdExtractionRule?: 'explicit_statement' | 'percentage_rule' | 'percentage_validated' | null;
  tenderValueCandidates?: TenderValueExtractionCandidateDebug[];
  tenderValueCrossValidation?: TenderValueCrossValidation | null;
  tenderValueExtractionRule?: 'explicit_statement' | 'emd_cross_validated' | null;
  debugMode?: boolean;
}

export interface FieldLocatorResult {
  fieldName: FieldLocatorFieldName | string;
  value: string;
  sourcePage: number;
  sourceText: string;
  extractionMethod: FieldLocatorMethod;
  confidence: number;
  amountDebug?: AmountExtractionDebug;
}

export interface FieldLocatorFailure {
  fieldName: FieldLocatorFieldName;
  pagesSearched: number;
  regexUsed: string[];
  aliasesUsed: string[];
  failureReason: string;
  /** EMD debug: last keyword hit before failure */
  keywordMatched?: string | null;
  amountFound?: string | null;
  pageSearched?: number | null;
  amountDebug?: AmountExtractionDebug;
}

export interface FieldLocatorEngineResult {
  pagesSearched: number;
  priorityPages: number;
  fields: FieldLocatorResult[];
  foundCount: number;
  missingFields: FieldLocatorFieldName[];
  failedFields: FieldLocatorFailure[];
}
