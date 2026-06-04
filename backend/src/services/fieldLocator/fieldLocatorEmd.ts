import { PageText } from '../../types/intelligence';
import { FieldLocatorFailure, FieldLocatorResult } from '../../types/fieldLocator';
import { INDIAN_AMOUNT_REGEX } from './fieldLocatorAmount';
import { extractEmdWithRules } from './fieldLocatorEmdEngine';
import { FieldLocatorRunOptions } from './fieldLocatorOptions';

const EMD_ALIASES = [
  'EMD Amount',
  'EMD',
  'Earnest Money Deposit',
  'Earnest Money',
  'Bid Security',
  'Security Deposit',
];

export function extractEmdFromPages(
  pages: PageText[],
  options?: FieldLocatorRunOptions
): {
  field: FieldLocatorResult | null;
  failure: FieldLocatorFailure | null;
} {
  const fieldName = 'EMD' as const;
  const { field, debug, failureReason } = extractEmdWithRules(pages, options);

  if (field) {
    return { field, failure: null };
  }

  return {
    field: null,
    failure: {
      fieldName,
      pagesSearched: pages.length,
      regexUsed: [INDIAN_AMOUNT_REGEX.source],
      aliasesUsed: EMD_ALIASES,
      failureReason: failureReason ?? 'EMD extraction failed',
      keywordMatched: debug.keywordFound,
      amountFound: debug.selectedAmount,
      amountDebug: debug,
    },
  };
}
