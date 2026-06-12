import { MasterDatasetKey } from '../../types/masterDataset';
import { NIT_ALLOWED_DATASET_KEYS } from '../tenderParameter/masterTenderParameterDictionary';

/** Primary NIT tender fields — Master Parameter Dictionary order only. */
export const NIT_TENDER_PARAMETER_ORDER: MasterDatasetKey[] = [...NIT_ALLOWED_DATASET_KEYS];
