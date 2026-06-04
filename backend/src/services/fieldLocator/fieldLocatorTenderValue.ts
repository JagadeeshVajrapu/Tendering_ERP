import { PageText } from '../../types/intelligence';
import { FieldLocatorFailure, FieldLocatorResult } from '../../types/fieldLocator';
import { INDIAN_AMOUNT_REGEX } from './fieldLocatorAmount';
import { extractTenderValueWithRules } from './fieldLocatorTenderValueEngine';
import { FieldLocatorRunOptions } from './fieldLocatorOptions';

const TENDER_VALUE_ALIASES = [
  'Estimated Cost',
  'Tender Value',
  'Tender Amount',
  'Estimated Tender Value',
  'Contract Value',
  'Approximate Cost',
  'Cost of Work',
  'Project Cost',
];

export function extractTenderValueFromPages(
  pages: PageText[],
  options?: FieldLocatorRunOptions
): {
  field: FieldLocatorResult | null;
  failure: FieldLocatorFailure | null;
} {
  const fieldName = 'Tender Value' as const;
  const { field, debug, failureReason } = extractTenderValueWithRules(pages, options);

  if (field) {
    return { field, failure: null };
  }

  return {
    field: null,
    failure: {
      fieldName,
      pagesSearched: pages.length,
      regexUsed: [INDIAN_AMOUNT_REGEX.source],
      aliasesUsed: TENDER_VALUE_ALIASES,
      failureReason: failureReason ?? 'Tender Value extraction failed',
      keywordMatched: debug.keywordFound,
      amountFound: debug.selectedAmount,
      amountDebug: debug,
    },
  };
}
