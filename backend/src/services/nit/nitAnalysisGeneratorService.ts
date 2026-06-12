import { Types } from 'mongoose';
import { Tender } from '../../models/Tender';
import { TenderDocument } from '../../models/TenderDocument';
import { DocumentPage } from '../../models/DocumentPage';
import { EnterpriseMasterDatasetParameter } from '../../models/EnterpriseMasterDatasetParameter';
import { AppError } from '../../middleware/errorHandler';
import { enterpriseMasterDatasetAccess } from '../masterTenderDataset/enterpriseMasterDatasetAccess';
import { enterpriseMasterDatasetService } from '../masterTenderDataset/enterpriseMasterDatasetService';
import { buildEnterpriseDynamicNitAnalysis } from './enterpriseDynamicNitAnalysisEngine';
import { MASTER_DICTIONARY_PARAMETER_COUNT } from '../tenderParameter/masterTenderParameterDictionary';
import { NitAnalysisReport } from '../../types/nitAnalysisReport';

class NitAnalysisGeneratorService {
  private buildPendingReport(
    tenderId: string,
    documentId: string,
    originalName: string | undefined,
    steps: string[]
  ): NitAnalysisReport {
    return {
      tenderId,
      documentId,
      originalName,
      generatedAt: new Date().toISOString(),
      reportType: 'enterprise_dynamic',
      dataSource: 'enterprise_master_dataset',
      pipeline: { steps },
      tenderParameters: [],
      sections: [],
      statistics: {
        totalDiscovered: 0,
        totalParametersExtracted: 0,
        mappedCount: 0,
        populatedFields: 0,
        visibleByDefault: 0,
        totalMasterFields: MASTER_DICTIONARY_PARAMETER_COUNT,
        pagesScanned: 0,
        averageConfidence: 0,
        categoryCounts: {},
        confidenceTierCounts: {},
        coreCount: 0,
        dynamicCount: 0,
        reviewCount: 0,
      },
    };
  }

  async generateForTender(
    tenderId: Types.ObjectId,
    opts?: { refresh?: boolean }
  ): Promise<NitAnalysisReport> {
    const tender = await Tender.findById(tenderId);
    if (!tender) throw new AppError('Tender not found', 404);

    const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });
    if (!document) throw new AppError('No document found for this tender. Upload a PDF first.', 404);

    const pageCount = await DocumentPage.countDocuments({ documentId: document._id });
    if (!pageCount) {
      return this.buildPendingReport(
        String(tender._id),
        String(document._id),
        document.originalName,
        ['awaiting_ocr']
      );
    }

    const refresh = !!opts?.refresh;
    const steps: string[] = ['enterprise_master_dataset'];

    const paramCount = await EnterpriseMasterDatasetParameter.countDocuments({
      documentId: document._id,
    });

    if (refresh) {
      await enterpriseMasterDatasetService.buildAndStore(document._id, document.tenderId, {
        refresh: true,
      });
      steps.push('master_dataset_refresh');
    }

    const master = await enterpriseMasterDatasetAccess.getMasterDataset(
      document._id,
      document.tenderId,
      { refresh: false }
    );

    if (!master.parameters.length) {
      if (refresh) {
        const rebuilt = await enterpriseMasterDatasetService.buildAndStore(
          document._id,
          document.tenderId,
          { refresh: true }
        );
        if (rebuilt.parameters.length) {
          steps.push('master_dataset_rebuild');
          return buildEnterpriseDynamicNitAnalysis(
            String(tender._id),
            String(document._id),
            document.originalName,
            rebuilt,
            steps
          );
        }
      }
      return this.buildPendingReport(
        String(tender._id),
        String(document._id),
        document.originalName,
        steps
      );
    }

    const report = buildEnterpriseDynamicNitAnalysis(
      String(tender._id),
      String(document._id),
      document.originalName,
      master,
      steps
    );

    console.log('[EnterpriseNIT] Generated', {
      tenderId: String(tenderId),
      documentId: String(document._id),
      parameters: report.statistics.totalParametersExtracted,
      sections: report.sections.length,
      serviceCategory: master.serviceCategory,
    });

    return report;
  }
}

export const nitAnalysisGeneratorService = new NitAnalysisGeneratorService();
