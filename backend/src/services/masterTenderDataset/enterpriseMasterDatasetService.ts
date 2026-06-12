import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderDocument } from '../../models/TenderDocument';
import { TenderParameterCandidate } from '../../models/TenderParameterCandidate';
import { DocumentMasterTenderDataset } from '../../models/DocumentMasterTenderDataset';
import { TenderMasterDataset } from '../../models/TenderMasterDataset';
import { EnterpriseMasterDatasetParameter } from '../../models/EnterpriseMasterDatasetParameter';
import { EnterpriseMasterDatasetVersion } from '../../models/EnterpriseMasterDatasetVersion';
import {
  EnterpriseMasterDatasetDebugView,
  EnterpriseMasterDatasetEntry,
  EnterpriseMasterDatasetResult,
} from '../../types/enterpriseMasterDataset';
import { ValidatedMasterDatasetResult } from '../../types/validatedMasterDataset';
import { MasterDatasetBuildResult, MasterTenderDataset } from '../../types/masterDataset';
import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import {
  buildEnterpriseMasterDatasetEntries,
  computeEnterpriseStatistics,
  diffVersions,
  ENTERPRISE_MASTER_DATASET_SCHEMA_VERSION,
  toValidatedMasterDatasetParameters,
} from './enterpriseMasterDatasetBuilder';
import { validatedParametersToLegacyDataset } from './validatedMasterDatasetBuilder';
import { normalizeMasterDatasetResult } from './masterDatasetNormalizer';
import { tenderParameterCandidatePostProcessingService } from '../tenderParameter/tenderParameterCandidatePostProcessingService';
import {
  buildValidatedCandidateRowsFromOcr,
  ensureCandidatesFromOcrFallback,
} from '../tenderParameter/ocrMasterDatasetFallback';
import { tenderServiceClassificationService } from '../tenderClassification/tenderServiceClassificationService';
import { discoverAllParameters } from '../parameterDiscovery/dynamicParameterDiscoveryEngine';
import { ocrNormalizationService } from '../ocr/ocrNormalizationService';
import { normalizeCandidatesWithAliasDictionary } from '../tenderParameter/enterpriseAliasDictionaryEngine';
import {
  isExtractableCandidateRow,
  rowResolvesAsCoreParameter,
} from '../tenderParameter/tenderParameterQualityEngine';
import { qualifiesForAdditionalTenderParameters } from '../tenderParameter/enterpriseDynamicParameterFilteringEngine';
import { verifyEnterpriseMasterDatasetEntries } from './enterpriseAiVerificationMasterDatasetEngine';
import { TenderIntelligenceLayer } from '../../models/TenderIntelligenceLayer';

class EnterpriseMasterDatasetService {
  private mapCandidate(row: {
    parameter: string;
    originalLabel?: string;
    normalizedParameter?: string;
    canonicalKey?: string;
    category?: string;
    isCoreParameter?: boolean;
    value: string;
    pageNumber: number;
    confidence: number;
    sourceText: string;
    rankScore?: number;
    rankReason?: string;
    rankBreakdown?: Record<string, unknown>;
    rankWinner?: boolean | null;
    validationPassed?: boolean | null;
    validationStatus?: string;
    validationReason?: string;
    validationConfidence?: number;
  }): TenderParameterCandidateRow {
    return {
      parameter: row.parameter,
      originalLabel: row.originalLabel || row.parameter,
      normalizedParameter: row.normalizedParameter,
      canonicalKey: row.canonicalKey,
      category: row.category,
      isCoreParameter: row.isCoreParameter,
      value: row.value,
      page: row.pageNumber,
      confidence: row.confidence,
      sourceText: row.sourceText,
      rankScore: row.rankScore,
      rankReason: row.rankReason,
      rankBreakdown: row.rankBreakdown,
      rankWinner: row.rankWinner ?? undefined,
      validationPassed: row.validationPassed ?? undefined,
      validationStatus: row.validationStatus as TenderParameterCandidateRow['validationStatus'],
      validationReason: row.validationReason,
      validationConfidence: row.validationConfidence,
    };
  }

  async loadValidatedCandidates(documentId: Types.ObjectId): Promise<TenderParameterCandidateRow[]> {
    const stored = await TenderParameterCandidate.find({
      documentId,
      validationPassed: true,
    })
      .sort({ pageNumber: 1, parameter: 1 })
      .lean();
    return stored.map((s) => this.mapCandidate(s));
  }

  async loadAllCandidates(documentId: Types.ObjectId): Promise<TenderParameterCandidateRow[]> {
    const stored = await TenderParameterCandidate.find({ documentId })
      .sort({ pageNumber: 1, parameter: 1 })
      .lean();
    return stored.map((s) => this.mapCandidate(s));
  }

  private async ensurePostProcessing(documentId: Types.ObjectId): Promise<void> {
    const [pending, validated, total] = await Promise.all([
      TenderParameterCandidate.countDocuments({ documentId, validationPassed: null }),
      TenderParameterCandidate.countDocuments({ documentId, validationPassed: true }),
      TenderParameterCandidate.countDocuments({ documentId }),
    ]);
    if (pending > 0 || (total > 0 && validated === 0)) {
      await tenderParameterCandidatePostProcessingService.rankAndValidate(documentId);
    }
  }

  private entryToDoc(
    entry: EnterpriseMasterDatasetEntry,
    version: number
  ): Record<string, unknown> {
    return {
      documentId: new Types.ObjectId(entry.documentId),
      tenderId: new Types.ObjectId(entry.tenderId),
      parameter: entry.parameter,
      normalizedParameter: entry.normalizedParameter,
      value: entry.value,
      category: entry.category,
      serviceCategory: entry.serviceCategory,
      pageNumber: entry.pageNumber,
      pagePriority: entry.pagePriority ?? 0,
      confidence: entry.confidence,
      validationStatus: entry.validationStatus,
      isCoreParameter: entry.isCoreParameter,
      sourceText: entry.sourceText,
      sourceSection: entry.sourceSection,
      rankingScore: entry.rankingScore,
      validationReason: entry.validationReason,
      rankingReason: entry.rankingReason,
      canonicalKey: entry.canonicalKey || '',
      parameterType: entry.parameterType,
      duplicateHistory: entry.duplicateHistory,
      tenderType: entry.tenderType || '',
      source: entry.source || '',
      verificationStatus: entry.verificationStatus || 'VERIFIED',
      verificationConfidence: entry.verificationConfidence ?? entry.confidence,
      verificationReason: entry.verificationReason || '',
      verificationScores: entry.verificationScores || null,
      verificationAiEvaluated: entry.verificationAiEvaluated ?? false,
      datasetVersion: version,
      schemaVersion: ENTERPRISE_MASTER_DATASET_SCHEMA_VERSION,
    };
  }

  private docToEntry(doc: {
    _id: Types.ObjectId;
    documentId: Types.ObjectId;
    tenderId: Types.ObjectId;
    parameter: string;
    normalizedParameter: string;
    value: string;
    category: string;
    serviceCategory: string;
    pageNumber: number;
    pagePriority?: number;
    confidence: number;
    validationStatus: string;
    isCoreParameter: boolean;
    sourceText: string;
    sourceSection: string;
    rankingScore: number;
    validationReason: string;
    rankingReason: string;
    canonicalKey?: string;
    parameterType: 'core' | 'dynamic';
    duplicateHistory?: EnterpriseMasterDatasetEntry['duplicateHistory'];
    tenderType?: string;
    source?: string;
    verificationStatus?: string;
    verificationConfidence?: number;
    verificationReason?: string;
    verificationScores?: EnterpriseMasterDatasetEntry['verificationScores'];
    verificationAiEvaluated?: boolean;
    schemaVersion?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }): EnterpriseMasterDatasetEntry {
    return {
      id: String(doc._id),
      documentId: String(doc.documentId),
      tenderId: String(doc.tenderId),
      parameter: doc.parameter,
      normalizedParameter: doc.normalizedParameter,
      value: doc.value,
      category: doc.category,
      serviceCategory: doc.serviceCategory,
      pageNumber: doc.pageNumber,
      pagePriority: (doc as { pagePriority?: number }).pagePriority ?? 0,
      confidence: doc.confidence,
      validationStatus: doc.validationStatus as EnterpriseMasterDatasetEntry['validationStatus'],
      isCoreParameter: doc.isCoreParameter,
      sourceText: doc.sourceText,
      sourceSection: doc.sourceSection,
      rankingScore: doc.rankingScore,
      validationReason: doc.validationReason,
      rankingReason: doc.rankingReason,
      canonicalKey: doc.canonicalKey,
      parameterType: doc.parameterType,
      duplicateHistory: doc.duplicateHistory || [],
      tenderType: doc.tenderType,
      source: doc.source,
      verificationStatus: doc.verificationStatus as EnterpriseMasterDatasetEntry['verificationStatus'],
      verificationConfidence: doc.verificationConfidence,
      verificationReason: doc.verificationReason,
      verificationScores: doc.verificationScores as EnterpriseMasterDatasetEntry['verificationScores'],
      verificationAiEvaluated: doc.verificationAiEvaluated,
      schemaVersion: doc.schemaVersion ?? ENTERPRISE_MASTER_DATASET_SCHEMA_VERSION,
      createdAt: doc.createdAt?.toISOString(),
      updatedAt: doc.updatedAt?.toISOString(),
    };
  }

  /** Persists parameters + version row; retries on concurrent version duplicate (E11000). */
  private async persistVersionedDataset(input: {
    documentId: Types.ObjectId;
    tenderId: Types.ObjectId;
    stored: EnterpriseMasterDatasetEntry[];
    statistics: ReturnType<typeof computeEnterpriseStatistics>;
    changeSummary: ReturnType<typeof diffVersions>;
    builtAt: Date;
  }): Promise<number> {
    const { documentId, tenderId, stored, statistics, changeSummary, builtAt } = input;
    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const lastVersion = await EnterpriseMasterDatasetVersion.findOne({ documentId })
        .sort({ version: -1 })
        .lean();
      const nextVersion = (lastVersion?.version ?? 0) + 1;

      try {
        await EnterpriseMasterDatasetParameter.deleteMany({ documentId });
        if (stored.length) {
          await EnterpriseMasterDatasetParameter.insertMany(
            stored.map((e) => this.entryToDoc(e, nextVersion))
          );
        }

        await EnterpriseMasterDatasetVersion.create({
          documentId,
          tenderId,
          version: nextVersion,
          parameterCount: stored.length,
          parameters: stored,
          statistics,
          changeSummary,
          builtAt,
        });

        return nextVersion;
      } catch (err: unknown) {
        const code = (err as { code?: number }).code;
        if (code === 11000 && attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }

    throw new AppError('Failed to persist master dataset version', 500);
  }

  async buildAndStore(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: { refresh?: boolean }
  ): Promise<EnterpriseMasterDatasetResult> {
    await this.ensurePostProcessing(documentId);

    let allCandidates = await this.loadAllCandidates(documentId);
    if (!allCandidates.length) {
      await ensureCandidatesFromOcrFallback(documentId, tenderId);
      allCandidates = await this.loadAllCandidates(documentId);
    }

    const classification = await tenderServiceClassificationService.classifyAndStore(
      documentId,
      tenderId,
      undefined,
      { refresh: false }
    );
    const serviceCategory = classification.serviceCategory || 'unclassified';

    let tenderType = '';
    try {
      const intel = await TenderIntelligenceLayer.findOne({ documentId }).sort({ createdAt: -1 }).lean();
      tenderType = intel?.tenderType || '';
    } catch {
      tenderType = '';
    }

    let { stored, rejected } = buildEnterpriseMasterDatasetEntries(allCandidates, {
      documentId: String(documentId),
      tenderId: String(tenderId),
      serviceCategory,
    });

    if (!stored.length) {
      await ensureCandidatesFromOcrFallback(documentId, tenderId, { force: true });
      await tenderParameterCandidatePostProcessingService.rankAndValidate(documentId);
      allCandidates = await this.loadAllCandidates(documentId);
      ({ stored, rejected } = buildEnterpriseMasterDatasetEntries(allCandidates, {
        documentId: String(documentId),
        tenderId: String(tenderId),
        serviceCategory,
      }));
    }

    if (!stored.length) {
      const ocrRows = await buildValidatedCandidateRowsFromOcr(documentId);
      if (ocrRows.length) {
        console.log('[EnterpriseMasterDataset] Direct OCR build', {
          documentId: String(documentId),
          rows: ocrRows.length,
        });
        ({ stored, rejected } = buildEnterpriseMasterDatasetEntries(ocrRows, {
          documentId: String(documentId),
          tenderId: String(tenderId),
          serviceCategory,
        }));
        await ensureCandidatesFromOcrFallback(documentId, tenderId, { force: true });
      }
    }

    if (!stored.length) {
      const pages = await ocrNormalizationService.loadPages(documentId);
      const discovered = discoverAllParameters(pages);
      const rawRows: TenderParameterCandidateRow[] = discovered.map((d) => ({
        parameter: d.parameterName,
        originalLabel: d.parameterName,
        value: d.parameterValue,
        page: d.pageNumber,
        confidence: d.confidence,
        sourceText: d.sourceText,
        category: d.category,
      }));
      const { candidates: aliasMapped } = normalizeCandidatesWithAliasDictionary(rawRows, {});
      const discoveryRows = aliasMapped
        .filter((row) => {
          if (rowResolvesAsCoreParameter(row)) return isExtractableCandidateRow({ ...row, originalLabel: row.originalLabel || row.parameter });
          return qualifiesForAdditionalTenderParameters({
            parameter: row.parameter,
            originalLabel: row.originalLabel,
            value: row.value,
            validationStatus: 'VALID_DYNAMIC_PARAMETER',
            sourceText: row.sourceText,
            page: row.page,
          });
        })
        .map((row) => ({
          ...row,
          validationPassed: true as const,
          validationStatus: (rowResolvesAsCoreParameter(row)
            ? 'VALID'
            : 'REVIEW') as TenderParameterCandidateRow['validationStatus'],
          validationReason: 'Built from parameter discovery fallback',
          rankWinner: true,
        }));

      if (discoveryRows.length) {
        console.log('[EnterpriseMasterDataset] Discovery fallback build', {
          documentId: String(documentId),
          rows: discoveryRows.length,
        });
        ({ stored, rejected } = buildEnterpriseMasterDatasetEntries(discoveryRows, {
          documentId: String(documentId),
          tenderId: String(tenderId),
          serviceCategory,
        }));
      }
    }

    const verificationRejected: EnterpriseMasterDatasetEntry[] = [];
    if (stored.length) {
      const verification = await verifyEnterpriseMasterDatasetEntries(stored, {
        tenderType,
        candidateRows: allCandidates,
      });
      verificationRejected.push(...verification.rejected);
      stored = verification.stored;
      console.log('[EnterpriseMasterDataset] AI verification complete', {
        documentId: String(documentId),
        verified: verification.stats.verifiedCount,
        review: verification.stats.reviewCount,
        rejected: verification.stats.rejectedCount,
        aiEvaluated: verification.stats.aiEvaluatedCount,
      });
    }
    rejected = [...rejected, ...verificationRejected];

    const previousDocs = await EnterpriseMasterDatasetParameter.find({ documentId }).lean();
    const previousEntries = previousDocs.map((d) => this.docToEntry(d as Parameters<typeof this.docToEntry>[0]));

    const changeSummary = diffVersions(previousEntries, stored);
    const statistics = computeEnterpriseStatistics(stored, rejected.length);
    statistics.verificationRejectedCount = verificationRejected.length;
    const builtAt = new Date();

    const nextVersion = await this.persistVersionedDataset({
      documentId,
      tenderId,
      stored,
      statistics,
      changeSummary,
      builtAt,
    });

    const validatedParams = toValidatedMasterDatasetParameters(stored);
    await DocumentMasterTenderDataset.findOneAndUpdate(
      { documentId },
      {
        documentId,
        tenderId,
        parameters: validatedParams,
        statistics: {
          totalParameters: statistics.totalParameters,
          validatedCount: statistics.validatedCount,
          coreCount: statistics.coreCount,
          dynamicCount: statistics.dynamicCount,
          averageConfidence: statistics.averageConfidence,
          categoryCounts: statistics.categoryCounts,
        },
        builtAt,
        schemaVersion: ENTERPRISE_MASTER_DATASET_SCHEMA_VERSION,
      },
      { upsert: true, new: true }
    );

    await this.syncLegacyKeyedDataset(documentId, tenderId, stored, statistics);

    const versions = await EnterpriseMasterDatasetVersion.find({ documentId })
      .sort({ version: -1 })
      .limit(10)
      .lean();

    console.log('[EnterpriseMasterDataset] Stored', {
      documentId: String(documentId),
      version: nextVersion,
      parameters: stored.length,
      rejected: rejected.length,
    });

    return {
      documentId: String(documentId),
      tenderId: String(tenderId),
      serviceCategory,
      schemaVersion: ENTERPRISE_MASTER_DATASET_SCHEMA_VERSION,
      currentVersion: nextVersion,
      parameters: stored,
      rejected,
      statistics,
      versions: versions.map((v) => ({
        version: v.version,
        parameterCount: v.parameterCount,
        builtAt: v.builtAt.toISOString(),
        changeSummary: v.changeSummary,
      })),
      builtAt: builtAt.toISOString(),
      dataSource: 'enterprise_master_dataset',
    };
  }

  private async syncLegacyKeyedDataset(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    stored: EnterpriseMasterDatasetEntry[],
    statistics: ReturnType<typeof computeEnterpriseStatistics>
  ): Promise<void> {
    const validatedParams = toValidatedMasterDatasetParameters(stored);
    const dataset = validatedParametersToLegacyDataset(validatedParams);

    await TenderMasterDataset.findOneAndUpdate(
      { documentId },
      {
        $set: {
          tenderId,
          documentId,
          dataset,
          statistics: {
            totalFields: statistics.totalParameters,
            populatedFields: statistics.validatedCount,
            averageConfidence: statistics.averageConfidence,
            lowConfidenceFields: stored.filter((p) => p.confidence < 70).length,
            processingTimeMs: 0,
          },
          provenance: {
            ocrPageCount: 0,
            ruleExtractedCount: 0,
            validatedCount: statistics.validatedCount,
            aiVerifiedCount: 0,
            confidenceScoredCount: stored.length,
            fieldLocatorCount: 0,
          },
          schemaVersion: ENTERPRISE_MASTER_DATASET_SCHEMA_VERSION,
        },
      },
      { upsert: true, new: true }
    );
  }

  async getByDocumentId(documentId: Types.ObjectId): Promise<EnterpriseMasterDatasetResult | null> {
    const docs = await EnterpriseMasterDatasetParameter.find({ documentId })
      .sort({ pageNumber: 1, parameter: 1 })
      .lean();
    if (!docs.length) return null;

    const meta = await DocumentMasterTenderDataset.findOne({ documentId }).lean();
    const versions = await EnterpriseMasterDatasetVersion.find({ documentId })
      .sort({ version: -1 })
      .limit(10)
      .lean();
    const lastVersion = versions[0];

    const parameters = docs.map((d) => this.docToEntry(d as Parameters<typeof this.docToEntry>[0]));
    const statistics = computeEnterpriseStatistics(parameters, 0);

    return {
      documentId: String(documentId),
      tenderId: String(docs[0].tenderId),
      serviceCategory: docs[0].serviceCategory || meta?.parameters?.length ? 'unclassified' : 'unclassified',
      schemaVersion: ENTERPRISE_MASTER_DATASET_SCHEMA_VERSION,
      currentVersion: lastVersion?.version ?? docs[0].datasetVersion ?? 1,
      parameters,
      rejected: [],
      statistics,
      versions: versions.map((v) => ({
        version: v.version,
        parameterCount: v.parameterCount,
        builtAt: v.builtAt.toISOString(),
        changeSummary: v.changeSummary,
      })),
      builtAt: meta?.builtAt?.toISOString() || new Date().toISOString(),
      dataSource: 'enterprise_master_dataset',
    };
  }

  async getOrBuild(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    opts?: { refresh?: boolean }
  ): Promise<EnterpriseMasterDatasetResult> {
    if (!opts?.refresh) {
      const existing = await this.getByDocumentId(documentId);
      if (existing?.parameters?.length) return existing;
    }
    return this.buildAndStore(documentId, tenderId, opts);
  }

  async getForDocument(documentId: string, refresh = false): Promise<EnterpriseMasterDatasetResult> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);
    return this.getOrBuild(document._id, document.tenderId, { refresh });
  }

  async getDebugView(documentId: string, refresh = false): Promise<EnterpriseMasterDatasetDebugView> {
    const document = await TenderDocument.findById(documentId);
    if (!document) throw new AppError('Document not found', 404);

    if (refresh) {
      await this.buildAndStore(document._id, document.tenderId, { refresh: true });
    } else {
      const existing = await EnterpriseMasterDatasetParameter.countDocuments({ documentId: document._id });
      if (!existing) {
        await this.buildAndStore(document._id, document.tenderId);
      }
    }

    const allCandidates = await this.loadAllCandidates(document._id);
    const result = await this.getByDocumentId(document._id);
    const stored = result?.parameters ?? [];

    const { rejected } = buildEnterpriseMasterDatasetEntries(allCandidates, {
      documentId: String(document._id),
      tenderId: String(document.tenderId),
      serviceCategory: result?.serviceCategory || 'unclassified',
    });

    return {
      documentId: String(document._id),
      extractedParameters: allCandidates.length,
      validatedParameters: stored.filter((p) => p.validationStatus !== 'REVIEW'),
      rejectedParameters: rejected,
      storedParameters: stored,
      acceptanceReasons: stored.map((p) => ({
        parameter: p.parameter,
        reason: p.validationReason || p.rankingReason || 'Passed validation',
      })),
      rejectionReasons: rejected.map((p) => ({
        parameter: p.parameter,
        value: p.value,
        reason: p.validationReason || 'Rejected by validation engine',
      })),
    };
  }

  toValidatedResult(enterprise: EnterpriseMasterDatasetResult): ValidatedMasterDatasetResult {
    const parameters = toValidatedMasterDatasetParameters(enterprise.parameters);
    return normalizeMasterDatasetResult({
      documentId: enterprise.documentId,
      tenderId: enterprise.tenderId,
      parameters,
      statistics: {
        totalParameters: enterprise.statistics.totalParameters,
        validatedCount: enterprise.statistics.validatedCount,
        coreCount: enterprise.statistics.coreCount,
        dynamicCount: enterprise.statistics.dynamicCount,
        averageConfidence: enterprise.statistics.averageConfidence,
        categoryCounts: enterprise.statistics.categoryCounts,
      },
      builtAt: enterprise.builtAt,
    });
  }

  async getLegacyDatasetForReports(documentId: Types.ObjectId): Promise<{
    dataset: MasterTenderDataset;
    statistics: MasterDatasetBuildResult['statistics'];
    validated: ValidatedMasterDatasetResult;
    enterprise: EnterpriseMasterDatasetResult;
  }> {
    const enterprise = await this.getByDocumentId(documentId);
    if (!enterprise?.parameters?.length) {
      throw new AppError('Enterprise master dataset not found. Run extraction pipeline first.', 400);
    }

    const validated = this.toValidatedResult(enterprise);
    return {
      dataset: validatedParametersToLegacyDataset(validated.parameters),
      statistics: {
        totalFields: enterprise.statistics.totalParameters,
        populatedFields: enterprise.statistics.validatedCount,
        averageConfidence: enterprise.statistics.averageConfidence,
        lowConfidenceFields: enterprise.parameters.filter((p) => p.confidence < 70).length,
        processingTimeMs: 0,
      },
      validated,
      enterprise,
    };
  }
}

export const enterpriseMasterDatasetService = new EnterpriseMasterDatasetService();
