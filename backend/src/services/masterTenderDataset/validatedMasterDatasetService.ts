import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { ValidatedMasterDatasetResult } from '../../types/validatedMasterDataset';
import { MasterDatasetBuildResult, MasterTenderDataset } from '../../types/masterDataset';
import { enterpriseMasterDatasetService } from './enterpriseMasterDatasetService';

class ValidatedMasterDatasetService {
  async loadValidatedCandidates(documentId: Types.ObjectId) {
    return enterpriseMasterDatasetService.loadValidatedCandidates(documentId);
  }

  async buildAndStore(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: { refresh?: boolean }
  ): Promise<ValidatedMasterDatasetResult> {
    const enterprise = await enterpriseMasterDatasetService.buildAndStore(documentId, tenderId, opts);
    return enterpriseMasterDatasetService.toValidatedResult(enterprise);
  }

  async getByDocumentId(documentId: Types.ObjectId): Promise<ValidatedMasterDatasetResult | null> {
    const enterprise = await enterpriseMasterDatasetService.getByDocumentId(documentId);
    if (!enterprise) return null;
    return enterpriseMasterDatasetService.toValidatedResult(enterprise);
  }

  async getOrBuild(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: { refresh?: boolean }
  ): Promise<ValidatedMasterDatasetResult> {
    const enterprise = await enterpriseMasterDatasetService.getOrBuild(documentId, tenderId, opts);
    return enterpriseMasterDatasetService.toValidatedResult(enterprise);
  }

  async getLegacyDatasetForReports(documentId: Types.ObjectId): Promise<{
    dataset: MasterTenderDataset;
    statistics: MasterDatasetBuildResult['statistics'];
    validated: ValidatedMasterDatasetResult;
  }> {
    const { dataset, statistics, validated } =
      await enterpriseMasterDatasetService.getLegacyDatasetForReports(documentId);
    return { dataset, statistics, validated };
  }

  async getForDocument(documentId: string, refresh = false): Promise<ValidatedMasterDatasetResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);
    return this.getOrBuild(document._id, document.tenderId, { refresh });
  }
}

export const validatedMasterDatasetService = new ValidatedMasterDatasetService();
