import { TenderParameterAliasDefinition } from '../../types/tenderParameterAlias';
import { toLegacyAliasCatalogDefinitions } from './masterAliasRegistry';

/** Re-exported from Enterprise Master Alias Registry for backward compatibility. */
export const TENDER_PARAMETER_ALIAS_CATALOG: TenderParameterAliasDefinition[] =
  toLegacyAliasCatalogDefinitions();
