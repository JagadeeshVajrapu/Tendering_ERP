import { PageText } from '../../types/intelligence';
import { DiscoveredParameter } from '../../types/parameterDiscovery';
import { extractEmdFromPages } from '../fieldLocator/fieldLocatorEmd';
import {
  extractTenderNumber,
  extractOrganization,
  extractTenderValue,
  extractNameOfWork,
} from '../fieldLocator/fieldLocatorExtractors';
import { classifyParameterGroup } from './parameterGroupingEngine';

function toDiscovered(
  parameterName: string,
  parameterValue: string,
  pageNumber: number,
  sourceText: string,
  confidence: number
): DiscoveredParameter {
  return {
    parameterName,
    parameterValue,
    pageNumber,
    sourceText,
    confidence,
    category: classifyParameterGroup(parameterName, parameterValue),
  };
}

/**
 * Extract canonical tender fields (EMD, Name of Work, Tender Number, etc.)
 * using field-locator rules so the mapping engine receives proper labels.
 */
export function scanTenderLabelParameters(pages: PageText[]): DiscoveredParameter[] {
  const out: DiscoveredParameter[] = [];

  const tenderNo = extractTenderNumber(pages);
  if (tenderNo.field?.value?.trim()) {
    out.push(
      toDiscovered(
        'Tender Number',
        tenderNo.field.value.trim(),
        tenderNo.field.sourcePage,
        tenderNo.field.sourceText,
        96
      )
    );
  }

  const org = extractOrganization(pages);
  if (org.field?.value?.trim()) {
    out.push(
      toDiscovered(
        'Organization',
        org.field.value.trim(),
        org.field.sourcePage,
        org.field.sourceText,
        94
      )
    );
  }

  const work = extractNameOfWork(pages);
  if (work.field?.value?.trim()) {
    out.push(
      toDiscovered(
        'Name of Work',
        work.field.value.trim(),
        work.field.sourcePage,
        work.field.sourceText,
        95
      )
    );
    out.push(
      toDiscovered(
        'Scope of Work',
        work.field.value.trim(),
        work.field.sourcePage,
        work.field.sourceText,
        92
      )
    );
  }

  const emd = extractEmdFromPages(pages);
  if (emd.field?.value?.trim()) {
    out.push(
      toDiscovered(
        'EMD',
        emd.field.value.trim(),
        emd.field.sourcePage,
        emd.field.sourceText,
        96
      )
    );
    out.push(
      toDiscovered(
        'Earnest Money Deposit',
        emd.field.value.trim(),
        emd.field.sourcePage,
        emd.field.sourceText,
        94
      )
    );
  }

  const tv = extractTenderValue(pages);
  if (tv.field?.value?.trim()) {
    out.push(
      toDiscovered(
        'Tender Value',
        tv.field.value.trim(),
        tv.field.sourcePage,
        tv.field.sourceText,
        93
      )
    );
  }

  return out;
}
