import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import {
  DynamicMasterDatasetParameter,
  DynamicMasterDatasetResult,
} from '../../types/dynamicMasterDataset';
import { EnterpriseMasterDatasetEntry } from '../../types/enterpriseMasterDataset';
import { enterpriseMasterDatasetService } from './enterpriseMasterDatasetService';

function toDynamicParameter(entry: EnterpriseMasterDatasetEntry): DynamicMasterDatasetParameter {
  return {
    parameter: entry.parameter,
    value: entry.value,
    page: entry.pageNumber,
    confidence: entry.confidence,
    category: entry.category,
    validationStatus: entry.validationStatus,
    sourceText: entry.sourceText,
    parameterType: entry.parameterType,
    canonicalKey: entry.canonicalKey,
    originalLabel: entry.normalizedParameter !== entry.parameter ? entry.normalizedParameter : undefined,
  };
}

class DynamicMasterDatasetService {
  private toResult(enterprise: Awaited<ReturnType<typeof enterpriseMasterDatasetService.getOrBuild>>): DynamicMasterDatasetResult {
    const parameters = enterprise.parameters.map(toDynamicParameter);
    const coreParameters = parameters.filter((p) => p.parameterType === 'core');
    const dynamicParameters = parameters.filter((p) => p.parameterType === 'dynamic');

    return {
      documentId: enterprise.documentId,
      tenderId: enterprise.tenderId,
      serviceCategory: enterprise.serviceCategory,
      schemaVersion: enterprise.schemaVersion,
      currentVersion: enterprise.currentVersion,
      coreParameters,
      dynamicParameters,
      parameters,
      statistics: {
        totalParameters: enterprise.statistics.totalParameters,
        coreCount: enterprise.statistics.coreCount,
        dynamicCount: enterprise.statistics.dynamicCount,
        reviewCount: enterprise.statistics.reviewCount,
        validatedCount: enterprise.statistics.validatedCount,
        categoryCounts: enterprise.statistics.categoryCounts,
        averageConfidence: enterprise.statistics.averageConfidence,
      },
      builtAt: enterprise.builtAt,
      dataSource: 'dynamic_master_dataset',
    };
  }

  async buildAndStore(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: { refresh?: boolean }
  ): Promise<DynamicMasterDatasetResult> {
    const enterprise = await enterpriseMasterDatasetService.buildAndStore(documentId, tenderId, opts);
    return this.toResult(enterprise);
  }

  async getForDocument(documentId: string, refresh = false): Promise<DynamicMasterDatasetResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    const enterprise = await enterpriseMasterDatasetService.getOrBuild(document._id, document.tenderId, {
      refresh,
    });
    return this.toResult(enterprise);
  }
}

export const dynamicMasterDatasetService = new DynamicMasterDatasetService();
