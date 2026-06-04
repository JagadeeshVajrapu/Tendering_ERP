import { MasterDatasetKey } from '../../types/masterDataset';
import { MASTER_FIELD_SOURCE_ALIASES } from '../masterDataset/masterDatasetFieldRegistry';

export interface BusinessFieldMappingRule {
  masterKey: MasterDatasetKey;
  /** Normalized parameter name aliases */
  sourceParameters: string[];
  /** Primary business field label for master dataset / locator */
  businessFieldName: string;
  priority: number;
}

/**
 * Exact normalized parameter name → master key (highest priority).
 * User examples: Tender No / Tender Number / Bid Reference Number → Tender Number; EM → EMD.
 */
export const EXACT_PARAMETER_TO_MASTER: Record<string, MasterDatasetKey> = {
  em: 'emdAmount',
  emd: 'emdAmount',
  'emd amount': 'emdAmount',
  'earnest money': 'emdAmount',
  'earnest money deposit': 'emdAmount',
  'bid security': 'emdAmount',
  'bid security amount': 'emdAmount',
  'tender no': 'tenderNumber',
  'tender no.': 'tenderNumber',
  'tender number': 'tenderNumber',
  'tender id': 'tenderNumber',
  'tender reference': 'tenderNumber',
  'tender reference number': 'tenderNumber',
  'tender reference no': 'tenderNumber',
  'bid no': 'tenderNumber',
  'bid no.': 'tenderNumber',
  'bid number': 'tenderNumber',
  'bid reference': 'tenderNumber',
  'bid reference no': 'tenderNumber',
  'bid reference no.': 'tenderNumber',
  'bid reference number': 'tenderNumber',
  'nit no': 'nitNumber',
  'nit no.': 'nitNumber',
  'nit number': 'nitNumber',
  'estimated cost': 'estimatedCost',
  'tender value': 'tenderValue',
  'estimated tender value': 'tenderValue',
  'name of work': 'workName',
  'work name': 'workName',
  'scope of work': 'scopeOfWork',
  'contract period': 'contractPeriod',
  'agreement period': 'contractPeriod',
  organization: 'organization',
  organisation: 'organization',
  email: 'contactEmail',
  'e-mail': 'contactEmail',
  telephone: 'contactPhone',
  phone: 'contactPhone',
  mobile: 'contactPhone',
  'website address': 'contactEmail',
  website: 'contactEmail',
};

/** Extra aliases beyond master registry (OCR variants). */
const PARAMETER_ALIAS_EXTRAS: Partial<Record<MasterDatasetKey, string[]>> = {
  tenderNumber: [
    'tender no',
    'tender number',
    'tender id',
    'bid no',
    'bid number',
    'bid reference',
    'bid reference no',
    'bid reference number',
    'reference number',
    'ref no',
    'nit no',
    'nit number',
  ],
  nitNumber: ['nit no', 'nit number', 'notice inviting tender no', 'notice inviting tender'],
  bidReferenceNumber: ['rfp reference', 'procurement reference'],
  emdAmount: ['em', 'emd', 'emd amount', 'earnest money deposit', 'earnest money', 'bid security amount'],
  tenderValue: [
    'estimated tender value',
    'tender value',
    'estimated cost',
    'contract value',
    'project cost',
    'approximate cost',
  ],
  estimatedCost: ['estimated cost', 'approximate value of work'],
  documentFee: ['tender fee', 'document fee', 'cost of tender document', 'tender document fee'],
  manpowerRequirement: [
    'total number of manpower required',
    'manpower requirement',
    'manpower required',
    'total manpower',
    'number of manpower',
  ],
  contractPeriod: ['contract period', 'agreement period', 'period of agreement', 'period of contract'],
  completionPeriod: ['completion period', 'period of completion', 'time for completion'],
  tenderTitle: ['tender name', 'name of tender', 'tender title', 'title of tender'],
  organization: [
    'tender authority',
    'issuing authority',
    'name of authority',
    'organization',
    'organisation',
    'name of organization',
  ],
  workName: ['name of work', 'work name', 'title of work', 'nature of work', 'subject of tender'],
  scopeOfWork: ['scope of work', 'scope of the work', 'description of work', 'work description'],
  contactPhone: ['telephone', 'phone no', 'phone number', 'mobile no', 'mobile number', 'contact phone'],
  contactEmail: ['email', 'e-mail', 'email id', 'mail id', 'contact email', 'website address', 'website'],
  publishingDate: ['publish date', 'publishing date', 'date of publication', 'nit date', 'tender publish date'],
  bidEndDate: ['last date', 'last date of submission', 'bid submission date', 'submission end date'],
  bidStartDate: ['bid start date', 'submission start date'],
};

function normalizeParameterName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[:–\-=]+$/g, '')
    .replace(/[.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildRules(): BusinessFieldMappingRule[] {
  const rules: BusinessFieldMappingRule[] = [];
  let priority = 1;

  for (const masterKey of Object.keys(MASTER_FIELD_SOURCE_ALIASES) as MasterDatasetKey[]) {
    const aliases = MASTER_FIELD_SOURCE_ALIASES[masterKey];
    const extras = PARAMETER_ALIAS_EXTRAS[masterKey] || [];
    const merged = new Set<string>();

    for (const a of [...aliases, ...extras]) {
      merged.add(normalizeParameterName(a));
    }

    for (const [exact, key] of Object.entries(EXACT_PARAMETER_TO_MASTER)) {
      if (key === masterKey) merged.add(exact);
    }

    rules.push({
      masterKey,
      sourceParameters: Array.from(merged),
      businessFieldName: aliases[0],
      priority: priority++,
    });
  }

  return rules.sort((a, b) => {
    const maxA = Math.max(...a.sourceParameters.map((s) => s.length));
    const maxB = Math.max(...b.sourceParameters.map((s) => s.length));
    return maxB - maxA;
  });
}

export const BUSINESS_FIELD_MAPPING_RULES = buildRules();

export function normalizeParameterNameForMapping(name: string): string {
  return normalizeParameterName(name);
}

export function getMappingTableForDisplay(): Array<{
  sourceParameter: string;
  businessFieldName: string;
  masterKey: MasterDatasetKey;
}> {
  const rows: Array<{ sourceParameter: string; businessFieldName: string; masterKey: MasterDatasetKey }> =
    [];

  for (const [source, masterKey] of Object.entries(EXACT_PARAMETER_TO_MASTER)) {
    const rule = BUSINESS_FIELD_MAPPING_RULES.find((r) => r.masterKey === masterKey);
    rows.push({
      sourceParameter: source.replace(/\b\w/g, (c) => c.toUpperCase()),
      businessFieldName: rule?.businessFieldName ?? masterKey,
      masterKey,
    });
  }

  for (const rule of BUSINESS_FIELD_MAPPING_RULES) {
    for (const param of rule.sourceParameters) {
      if (EXACT_PARAMETER_TO_MASTER[param]) continue;
      rows.push({
        sourceParameter: param.replace(/\b\w/g, (c) => c.toUpperCase()),
        businessFieldName: rule.businessFieldName,
        masterKey: rule.masterKey,
      });
    }
  }

  return rows;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function aliasInParameterName(alias: string, name: string): boolean {
  if (name === alias) return true;
  if (name.startsWith(alias + ' ') || name.startsWith(alias + ':')) return true;
  if (alias.length >= 2) {
    const re = new RegExp(`(?:^|[\\s:–\\-])${escapeRegex(alias)}(?:\\s|:|$)`, 'i');
    return re.test(name);
  }
  return false;
}

export function resolveRuleForParameter(
  normalizedParameterName: string
): BusinessFieldMappingRule | null {
  const exactKey = EXACT_PARAMETER_TO_MASTER[normalizedParameterName];
  if (exactKey) {
    const rule = BUSINESS_FIELD_MAPPING_RULES.find((r) => r.masterKey === exactKey);
    if (rule) return rule;
  }

  for (const rule of BUSINESS_FIELD_MAPPING_RULES) {
    for (const alias of rule.sourceParameters) {
      if (aliasInParameterName(alias, normalizedParameterName)) return rule;
    }
  }

  return null;
}

/** Human-readable mapping examples for docs / debug UI */
export const MAPPING_ENGINE_EXAMPLES: Array<{
  sourceParameters: string[];
  masterField: string;
  masterKey: MasterDatasetKey;
}> = [
  {
    sourceParameters: ['Tender No', 'Tender Number', 'Bid Reference Number'],
    masterField: 'Tender Number',
    masterKey: 'tenderNumber',
  },
  {
    sourceParameters: ['EM', 'EMD', 'Earnest Money Deposit'],
    masterField: 'EMD',
    masterKey: 'emdAmount',
  },
  {
    sourceParameters: ['Estimated Cost', 'Tender Value'],
    masterField: 'Tender Value',
    masterKey: 'tenderValue',
  },
  {
    sourceParameters: ['Name of Work', 'Scope of Work'],
    masterField: 'Name of Work',
    masterKey: 'workName',
  },
];
