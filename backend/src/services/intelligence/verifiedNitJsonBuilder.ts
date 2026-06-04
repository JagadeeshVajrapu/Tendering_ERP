import { ExtractedProductionField } from './extractedProductionField';
import { VERIFICATION_DISPLAY_THRESHOLD } from './productionFieldPipeline';
import { validateFieldDictionary } from './fieldDictionaryEngine';

/**
 * Structured verified NIT JSON — only consultant-grade field values.
 * Never raw AI output or paragraph extractions.
 */
export interface VerifiedNitJson {
  tenderNumber?: string;
  tenderName?: string;
  tenderAuthority?: string;
  estimatedTenderValue?: string;
  emdAmount?: string;
  tenderFee?: string;
  performanceSecurity?: string;
  bankGuarantee?: string;
  bidSecurityAmount?: string;
  submissionMode?: string;
  bidSystem?: string;
  bidSubmissionDate?: string;
  bidOpeningDate?: string;
  preBidMeetingDate?: string;
  contractDuration?: string;
  workLocation?: string;
  turnoverRequirement?: string;
  experienceRequirement?: string;
  gstRequirement?: string;
  epfRequirement?: string;
  esiRequirement?: string;
  labourLicense?: string;
  msmeRequirement?: string;
  isoRequirement?: string;
  reverseAuction?: string;
  mafRequired?: string;
  requiredDocuments?: string[];
  technicalRequirements?: string[];
  scopeOfWork?: string;
}

const FIELD_TO_JSON: Record<string, keyof VerifiedNitJson> = {
  tenderNumber: 'tenderNumber',
  tenderName: 'tenderName',
  issuingAuthority: 'tenderAuthority',
  organization: 'tenderAuthority',
  estimatedTenderValue: 'estimatedTenderValue',
  emdAmount: 'emdAmount',
  tenderFee: 'tenderFee',
  performanceSecurity: 'performanceSecurity',
  bankGuarantee: 'bankGuarantee',
  bidSecurityAmount: 'bidSecurityAmount',
  submissionMode: 'submissionMode',
  bidSystem: 'bidSystem',
  bidSubmissionDate: 'bidSubmissionDate',
  bidOpeningDate: 'bidOpeningDate',
  preBidMeetingDate: 'preBidMeetingDate',
  contractDuration: 'contractDuration',
  workLocation: 'workLocation',
  turnoverRequirements: 'turnoverRequirement',
  experienceRequirements: 'experienceRequirement',
  gstRequirement: 'gstRequirement',
  epfRequirement: 'epfRequirement',
  esiRequirement: 'esiRequirement',
  labourLicense: 'labourLicense',
  msmeRequirement: 'msmeRequirement',
  certificationsRequired: 'isoRequirement',
  reverseAuction: 'reverseAuction',
  mafRequired: 'mafRequired',
  requiredDocuments: 'requiredDocuments',
  technicalRequirements: 'technicalRequirements',
  scopeOfWork: 'scopeOfWork',
};

function scalarValue(field: ExtractedProductionField): string | null {
  if (!field.validated || field.confidence < VERIFICATION_DISPLAY_THRESHOLD) return null;
  const v = field.value;
  if (v === null || v === undefined) return null;
  const s = Array.isArray(v) ? v[0] : String(v);
  const t = s.trim();
  if (!t || /^(?:not found|unknown|n\/a)$/i.test(t)) return null;

  const dict = validateFieldDictionary(field.id, t, field.sourceText || '');
  if (!dict.valid || !dict.normalizedValue) return null;
  return dict.normalizedValue;
}

class VerifiedNitJsonBuilder {
  build(productionFields: ExtractedProductionField[]): VerifiedNitJson {
    const json: VerifiedNitJson = {};

    for (const field of productionFields) {
      const key = FIELD_TO_JSON[field.id];
      if (!key) continue;

      if (key === 'requiredDocuments' || key === 'technicalRequirements') {
        if (!field.validated || field.confidence < VERIFICATION_DISPLAY_THRESHOLD) continue;
        const items = Array.isArray(field.value)
          ? field.value.map(String).filter(Boolean)
          : field.value
            ? [String(field.value)]
            : [];
        if (items.length) {
          json[key] = items.slice(0, 20);
        }
        continue;
      }

      const val = scalarValue(field);
      if (!val) continue;

      if (key === 'tenderAuthority' && json.tenderAuthority && json.tenderAuthority !== val) {
        continue;
      }

      json[key] = val;
    }

    return json;
  }
}

export const verifiedNitJsonBuilder = new VerifiedNitJsonBuilder();
