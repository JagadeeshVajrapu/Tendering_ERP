import { MasterDatasetKey } from '../../types/masterDataset';

/** Field Locator output labels → master dataset keys */
export const LOCATOR_TO_MASTER_KEY: Record<string, MasterDatasetKey> = {
  'Tender Number': 'tenderNumber',
  Organization: 'organization',
  EMD: 'emdAmount',
  'Tender Value': 'tenderValue',
  'Name of Work': 'workName',
};

export type DatasetSelectionReason =
  | 'field_locator'
  | 'validated_rule'
  | 'openai_verification'
  | 'rule_extraction'
  | 'none';
