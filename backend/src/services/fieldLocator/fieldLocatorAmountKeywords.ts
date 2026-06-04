import { FieldLocatorMethod } from '../../types/fieldLocator';
import { KeywordAmountSearch } from './fieldLocatorAmount';

export const EMD_SEARCH_KEYWORDS: KeywordAmountSearch[] = [
  { label: 'EMD Amount', method: 'keyword', priority: 1 },
  { label: 'Amount of EMD', method: 'keyword', priority: 2 },
  { label: 'Earnest Money Deposit', method: 'keyword', priority: 3 },
  { label: 'EMD', method: 'keyword', priority: 5 },
  { label: 'Earnest Money', method: 'alias', priority: 6 },
  { label: 'Bid Security', method: 'alias', priority: 7 },
  { label: 'Security Deposit', method: 'alias', priority: 8 },
];

export const TENDER_VALUE_SEARCH_KEYWORDS: KeywordAmountSearch[] = [
  { label: 'Estimated Cost of Work', method: 'keyword', priority: 1 },
  { label: 'Estimated Cost', method: 'keyword', priority: 2 },
  { label: 'Tender Value', method: 'keyword', priority: 3 },
  { label: 'Contract Value', method: 'keyword', priority: 4 },
  { label: 'Approximate Cost', method: 'keyword', priority: 5 },
  { label: 'Cost of Work', method: 'keyword', priority: 6 },
];
