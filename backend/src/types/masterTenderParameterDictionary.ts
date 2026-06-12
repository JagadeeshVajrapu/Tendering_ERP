import { MasterDatasetKey } from './masterDataset';

export type MasterParameterGroup =
  | 'Identity'
  | 'Financial'
  | 'Timeline'
  | 'Eligibility'
  | 'Compliance'
  | 'Experience'
  | 'Scope'
  | 'Tender Specific';

export interface MasterTenderParameterDefinition {
  canonical: string;
  canonicalKey: MasterDatasetKey;
  group: MasterParameterGroup;
}
