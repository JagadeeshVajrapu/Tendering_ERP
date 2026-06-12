import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { TenderParameterCandidate } from '../../models/TenderParameterCandidate';
import { DocumentDynamicParameterDiscovery } from '../../models/DocumentDynamicParameterDiscovery';
import { EnterpriseDynamicDiscoveryResult } from '../../types/enterpriseDynamicParameterDiscovery';
import { EnterpriseValidatedCandidate } from '../../types/enterpriseTenderValidation';
import { discoverEnterpriseDynamicParameters } from './enterpriseDynamicParameterDiscoveryEngine';
import { getLearningRegistrySummary, getPromotedParameters } from './dynamicParameterLearningRegistry';
import { isAllowedMasterParameter } from './masterTenderParameterDictionaryEngine';
import { TenderServiceCategory } from '../../types/tenderServiceClassification';

class DynamicParameterDiscoveryService {
  async discoverFromValidatedCandidates(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    validatedCandidates: EnterpriseValidatedCandidate[],
    opts?: { serviceCategory?: TenderServiceCategory | ''; persist?: boolean; tenderType?: string }
  ): Promise<EnterpriseDynamicDiscoveryResult> {
    const document = await TenderDocument.findById(documentId);
    const serviceCategory = opts?.serviceCategory || document?.serviceCategory || '';

    const result = await discoverEnterpriseDynamicParameters(validatedCandidates, {
      documentId: String(documentId),
      tenderId: String(tenderId),
      serviceCategory: serviceCategory as TenderServiceCategory,
      tenderType: opts?.tenderType,
    });

    if (opts?.persist !== false) {
      await DocumentDynamicParameterDiscovery.findOneAndUpdate(
        { documentId },
        {
          documentId,
          tenderId,
          serviceCategory,
          discovered: result.discovered,
          rejected: result.rejected,
          promoted: result.promoted,
          stats: result.stats,
          discoveredAt: new Date(result.discoveredAt),
        },
        { upsert: true, new: true }
      );

      await Promise.all(
        [...result.discovered, ...result.rejected].map((row) =>
          TenderParameterCandidate.updateOne(
            {
              documentId,
              pageNumber: row.page,
              parameter: row.parameter,
              value: row.value,
            },
            {
              $set: {
                category: row.category,
                isCoreParameter: false,
                validationStatus: row.validationStatus,
                validationPassed: row.validationPassed,
                validationReason: row.aiReason || row.validationReason || '',
              },
            }
          )
        )
      );
    }

    console.log('[DynamicParameterDiscovery] Complete', {
      documentId: String(documentId),
      discovered: result.stats.discoveredCount,
      rejected: result.stats.rejectedCount,
      aiEvaluated: result.stats.aiEvaluatedCount,
    });

    return result;
  }

  async getDiscoveryDashboard(documentId: string) {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    const stored = await DocumentDynamicParameterDiscovery.findOne({ documentId: document._id }).lean();
    const promoted = await getPromotedParameters();
    const learning = await getLearningRegistrySummary(50);

    const candidates = await TenderParameterCandidate.find({ documentId: document._id })
      .sort({ pageNumber: 1, parameter: 1 })
      .lean();

    const coreCount = candidates.filter((c) =>
      isAllowedMasterParameter(c.parameter, c.canonicalKey)
    ).length;

    return {
      documentId,
      serviceCategory: document.serviceCategory || stored?.serviceCategory || '',
      stats: stored?.stats ?? {},
      newParametersDiscovered: stored?.discovered ?? [],
      rejectedDynamicParameters: stored?.rejected ?? [],
      promotedParameters: promoted,
      learningRegistry: learning,
      summary: {
        totalCandidates: candidates.length,
        coreParameters: coreCount,
        discoveredDynamic: stored?.discovered?.length ?? 0,
        rejectedDynamic: stored?.rejected?.length ?? 0,
        promotedGlobal: promoted.length,
      },
    };
  }

  async getStoredDiscovery(documentId: Types.ObjectId): Promise<EnterpriseDynamicDiscoveryResult | null> {
    const stored = await DocumentDynamicParameterDiscovery.findOne({ documentId }).lean();
    if (!stored) return null;

    const candidates = await TenderParameterCandidate.find({
      documentId,
      validationPassed: true,
    }).lean();

    const coreParameters = candidates
      .filter((c) => isAllowedMasterParameter(c.parameter, c.canonicalKey))
      .map((c) => ({
        parameter: c.parameter,
        originalLabel: c.originalLabel || c.parameter,
        value: c.value,
        page: c.pageNumber,
        confidence: c.confidence,
        sourceText: c.sourceText,
        validationPassed: true as const,
        validationStatus: (c.validationStatus as EnterpriseValidatedCandidate['validationStatus']) || 'VALID',
        canonicalKey: c.canonicalKey,
      }));

    return {
      documentId: String(documentId),
      tenderId: String(stored.tenderId),
      serviceCategory: stored.serviceCategory,
      coreParameters: coreParameters as EnterpriseValidatedCandidate[],
      discovered: stored.discovered as unknown as EnterpriseDynamicDiscoveryResult['discovered'],
      rejected: stored.rejected as unknown as EnterpriseDynamicDiscoveryResult['rejected'],
      promoted: stored.promoted as unknown as EnterpriseDynamicDiscoveryResult['promoted'],
      stats: stored.stats as EnterpriseDynamicDiscoveryResult['stats'],
      discoveredAt: stored.discoveredAt.toISOString(),
    };
  }
}

export const dynamicParameterDiscoveryService = new DynamicParameterDiscoveryService();
