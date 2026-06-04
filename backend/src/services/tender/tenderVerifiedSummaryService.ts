import { Types } from 'mongoose';

import { AppError } from '../../middleware/errorHandler';

import { Tender } from '../../models/Tender';

import { TenderDocument } from '../../models/TenderDocument';

import { TenderMasterDataset } from '../../models/TenderMasterDataset';

import { TenderExecutiveRecommendation } from '../../models/TenderExecutiveRecommendation';

import { MASTER_DATASET_KEYS, MasterTenderDataset } from '../../types/masterDataset';

import { NOT_FOUND_VALUE } from '../../types/nitAnalysisReport';

import { ExecutiveRecommendation } from '../../types/executiveRecommendation';

import { NIT_FIELD_LABELS } from '../nit/nitAnalysisSectionRegistry';

import { masterDatasetService } from '../masterDataset/masterDatasetService';



export interface VerifiedTableRow {

  parameter: string;

  value: string;

  confidence: number | null;

  sourcePage: number | null;

  found: boolean;

  extractionMethod?: string;

}



export interface TenderVerifiedSummary {

  tenderId: string;

  documentId: string;

  originalName?: string;

  rows: VerifiedTableRow[];

  statistics: {

    totalParameters: number;

    foundParameters: number;

    missingParameters: number;

    averageConfidence: number;

  };

  recommendation: ExecutiveRecommendation | null;

  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | null;

}



class TenderVerifiedSummaryService {

  buildRowsFromDataset(

    dataset: MasterTenderDataset

  ): { rows: VerifiedTableRow[]; statistics: TenderVerifiedSummary['statistics'] } {

    const rows: VerifiedTableRow[] = MASTER_DATASET_KEYS.map((key) => {

      const field = dataset[key];

      const found = !!field.value?.trim();

      return {

        parameter: NIT_FIELD_LABELS[key],

        value: found ? field.value.trim() : NOT_FOUND_VALUE,

        confidence: found ? field.confidence : null,

        sourcePage: found && field.sourcePage > 0 ? field.sourcePage : null,

        found,

        extractionMethod: field.extractionMethod,

      };

    });



    const foundRows = rows.filter((r) => r.found);

    const confidences = foundRows.map((r) => r.confidence!);

    const averageConfidence =

      confidences.length > 0

        ? Math.round(confidences.reduce((s, c) => s + c, 0) / confidences.length)

        : 0;



    return {

      rows,

      statistics: {

        totalParameters: rows.length,

        foundParameters: foundRows.length,

        missingParameters: rows.length - foundRows.length,

        averageConfidence,

      },

    };

  }



  async getForTender(tenderId: Types.ObjectId): Promise<TenderVerifiedSummary> {

    const tender = await Tender.findById(tenderId);

    if (!tender) throw new AppError('Tender not found', 404);



    const document = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });

    if (!document) throw new AppError('No document found for this tender.', 404);



    await masterDatasetService.buildAndStore({

      tenderId: tender._id,

      documentId: document._id,

    });



    const [masterRecord, recommendationRecord] = await Promise.all([

      TenderMasterDataset.findOne({ documentId: document._id }).lean(),

      TenderExecutiveRecommendation.findOne({ documentId: document._id }).lean(),

    ]);



    if (!masterRecord) {

      throw new AppError(

        'Master Tender Dataset not ready. Run Field Locator or wait for analysis to complete.',

        400

      );

    }



    const { rows, statistics } = this.buildRowsFromDataset(masterRecord.dataset);



    return {

      tenderId: String(tender._id),

      documentId: String(document._id),

      originalName: document.originalName,

      rows,

      statistics,

      recommendation: recommendationRecord?.recommendation ?? null,

      overallRiskLevel: recommendationRecord?.overallRiskLevel ?? null,

    };

  }



  async getForTenderWithRegenerate(tenderId: Types.ObjectId): Promise<TenderVerifiedSummary> {

    return this.getForTender(tenderId);

  }

}



export const tenderVerifiedSummaryService = new TenderVerifiedSummaryService();


