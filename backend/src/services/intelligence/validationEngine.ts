import { MANDATORY_FIELDS } from './fields';
import { mergeEngine } from './mergeEngine';
import { missingDataRecovery } from './missingDataRecovery';
import { isVerifiedField } from './fieldVerification';
import {
  IntelligenceFieldKey,
  MergedField,
  MergedIntelligence,
  PageText,
} from '../../types/intelligence';
import { validateIntelligence } from './valueValidator';

function needsRecovery(field?: MergedField): boolean {
  return !isVerifiedField(field);
}

class ValidationEngine {
  validateAll(merged: MergedIntelligence): MergedIntelligence {
    return validateIntelligence(merged);
  }

  getMissingMandatoryFields(merged: MergedIntelligence): IntelligenceFieldKey[] {
    return MANDATORY_FIELDS.filter((field) => needsRecovery(merged[field]));
  }

  async requeryMissingFields(
    merged: MergedIntelligence,
    pages: PageText[]
  ): Promise<MergedIntelligence> {
    const missing = this.getMissingMandatoryFields(merged);
    if (!missing.length) return merged;

    const recovered = missingDataRecovery.recover(pages, missing);
    let updated = mergeEngine.appendRequeryResults(merged, recovered);
    return this.validateAll(updated);
  }

  /** Full-document rule recovery for any unverified mandatory fields. */
  async recoverAll(merged: MergedIntelligence, pages: PageText[]): Promise<MergedIntelligence> {
    const allRecovered = missingDataRecovery.recoverAll(pages);
    let updated = mergeEngine.appendRequeryResults(merged, allRecovered);
    updated = await this.requeryMissingFields(updated, pages);
    return this.validateAll(updated);
  }
}

export const validationEngine = new ValidationEngine();
