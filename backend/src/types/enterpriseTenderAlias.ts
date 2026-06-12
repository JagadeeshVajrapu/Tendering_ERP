import { MasterDatasetKey } from './masterDataset';
import { TenderServiceCategory } from './tenderServiceClassification';

export type AliasRegistryCategory =
  | 'Identity'
  | 'Financial'
  | 'Timeline'
  | 'Eligibility'
  | 'Compliance'
  | 'Experience'
  | 'Scope'
  | 'Technical'
  | 'Tender Specific';

export type AliasMatchMethod = 'exact_canonical' | 'exact_alias' | 'pattern' | 'semantic' | 'none';

export interface MasterAliasRegistryEntry {
  standardParameter: string;
  /** Omitted for dynamic service-specific parameters without a dictionary key */
  canonicalKey?: MasterDatasetKey;
  category: AliasRegistryCategory;
  aliases: string[];
  patterns?: RegExp[];
  /** Tokens used for semantic / fuzzy discovery (e.g. employer, purchaser → Organization) */
  semanticTokens?: string[];
  /** Tender types where this alias set applies (empty = all types) */
  tenderTypes?: string[];
  serviceCategories?: TenderServiceCategory[];
  priority: number;
}

export interface EnterpriseAliasMatchResult {
  originalParameter: string;
  normalizedParameter: string;
  canonicalKey: string;
  aliasMatched: boolean;
  confidence: number;
  matchMethod: AliasMatchMethod;
  aliasMatchScore: number;
  category?: AliasRegistryCategory;
}

export interface EnterpriseAliasNormalizationStats {
  inputCount: number;
  aliasMatchedCount: number;
  exactAliasCount: number;
  semanticMatchCount: number;
  unmappedCount: number;
}
