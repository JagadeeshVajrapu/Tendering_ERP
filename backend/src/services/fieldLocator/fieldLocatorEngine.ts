import { PageText } from '../../types/intelligence';
import {
  FieldLocatorEngineResult,
  FieldLocatorFailure,
  FieldLocatorFieldName,
  FieldLocatorResult,
} from '../../types/fieldLocator';
import { FIELD_LOCATOR_FIELD_ORDER } from './fieldLocatorRegistry';
import {
  extractEmd,
  extractNameOfWork,
  extractOrganization,
  extractTenderNumber,
  extractTenderValue,
} from './fieldLocatorExtractors';
import { FieldLocatorRunOptions } from './fieldLocatorOptions';

type ExtractorFn = (
  pages: PageText[],
  options?: FieldLocatorRunOptions
) => { field: FieldLocatorResult | null; failure: FieldLocatorFailure | null };

const EXTRACTORS: Record<FieldLocatorFieldName, ExtractorFn> = {
  'Tender Number': extractTenderNumber,
  Organization: extractOrganization,
  EMD: extractEmd,
  'Tender Value': extractTenderValue,
  'Name of Work': extractNameOfWork,
};

class FieldLocatorEngine {
  locate(pages: PageText[], options?: FieldLocatorRunOptions): FieldLocatorEngineResult {
    const fields: FieldLocatorResult[] = [];
    const failedFields: FieldLocatorFailure[] = [];
    const missingFields: FieldLocatorFieldName[] = [];

    for (const fieldName of FIELD_LOCATOR_FIELD_ORDER) {
      const run = EXTRACTORS[fieldName];
      const outcome = run(pages, options);
      if (outcome.field) {
        fields.push(outcome.field);
      } else {
        missingFields.push(fieldName);
        if (outcome.failure) failedFields.push(outcome.failure);
      }
    }

    return {
      pagesSearched: pages.length,
      priorityPages: Math.min(5, pages.length),
      fields,
      foundCount: fields.length,
      missingFields,
      failedFields,
    };
  }
}

export const fieldLocatorEngine = new FieldLocatorEngine();
