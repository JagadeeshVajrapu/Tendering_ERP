/**
 * Single read API for downstream modules.
 * All tender intelligence consumers must use this layer — never OCR, raw AI, or candidate tables.
 */
import { Types } from 'mongoose';
import { MasterTenderDataset } from '../../types/masterDataset';
import { EnterpriseMasterDatasetEntry, EnterpriseMasterDatasetResult } from '../../types/enterpriseMasterDataset';
import { ValidatedMasterDatasetResult } from '../../types/validatedMasterDataset';
import { enterpriseMasterDatasetService } from './enterpriseMasterDatasetService';
import { validatedParametersToLegacyDataset } from './validatedMasterDatasetBuilder';

class EnterpriseMasterDatasetAccess {
  async getMasterDataset(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: { refresh?: boolean }
  ): Promise<EnterpriseMasterDatasetResult> {
    return enterpriseMasterDatasetService.getOrBuild(documentId, tenderId, opts);
  }

  async getParameters(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: { refresh?: boolean }
  ): Promise<EnterpriseMasterDatasetEntry[]> {
    const result = await this.getMasterDataset(documentId, tenderId, opts);
    return result.parameters;
  }

  async getValidatedView(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: { refresh?: boolean }
  ): Promise<ValidatedMasterDatasetResult> {
    const enterprise = await this.getMasterDataset(documentId, tenderId, opts);
    return enterpriseMasterDatasetService.toValidatedResult(enterprise);
  }

  async getKeyedDataset(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: { refresh?: boolean }
  ): Promise<MasterTenderDataset> {
    const validated = await this.getValidatedView(documentId, tenderId, opts);
    return validatedParametersToLegacyDataset(validated.parameters);
  }

  findParameter(
    parameters: EnterpriseMasterDatasetEntry[],
    ...searchTerms: string[]
  ): EnterpriseMasterDatasetEntry | undefined {
    const norms = searchTerms.map((t) => t.toLowerCase());
    return parameters.find((p) => {
      const hay = `${p.parameter} ${p.normalizedParameter} ${p.canonicalKey || ''}`.toLowerCase();
      return norms.some((term) => hay.includes(term));
    });
  }

  pickValue(
    parameters: EnterpriseMasterDatasetEntry[],
    ...searchTerms: string[]
  ): string {
    return this.findParameter(parameters, ...searchTerms)?.value || '';
  }
}

export const enterpriseMasterDatasetAccess = new EnterpriseMasterDatasetAccess();
