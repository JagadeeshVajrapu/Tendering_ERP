import { Types } from 'mongoose';

import { DocumentPage } from '../../models/DocumentPage';

import { DocumentNitExtractedField } from '../../models/DocumentNitExtractedField';

import { DocumentFieldValidation } from '../../models/DocumentFieldValidation';

import { DocumentOpenAiVerification } from '../../models/DocumentOpenAiVerification';

import { DocumentLocatorField } from '../../models/DocumentLocatorField';

import { TenderMasterDataset } from '../../models/TenderMasterDataset';

import { TenderDocument } from '../../models/TenderDocument';

import { MasterDatasetBuildResult } from '../../types/masterDataset';

import { masterDatasetBuilder } from './masterDatasetBuilder';

import { documentPageService } from '../ocr/documentPageService';
import { tenderProductionPipeline } from '../production/tenderProductionPipeline';



export interface MasterDatasetStoreContext {

  tenderId: Types.ObjectId;

  documentId: Types.ObjectId;

  jobId?: Types.ObjectId;

}



class MasterDatasetService {

  async loadSourceRecords(documentId: Types.ObjectId) {

    const [pages, extracted, validations, aiVerifications, locator] = await Promise.all([
      DocumentPage.find({ documentId }).sort({ pageNumber: 1 }),
      DocumentNitExtractedField.find({ documentId }),
      DocumentFieldValidation.find({ documentId }),
      DocumentOpenAiVerification.find({ documentId }),
      DocumentLocatorField.find({ documentId }),
    ]);



    let fieldLocatorFields = locator.map((f) => ({

      fieldName: f.fieldName,

      value: f.value,

      confidence: f.confidence ?? 98,

      sourcePage: f.sourcePage,

      sourceText: f.sourceText,

      extractionMethod: `field_locator:${f.extractionMethod}`,

    }));



    if (!fieldLocatorFields.length && pages.length) {
      const pageTexts = documentPageService.toPageText(pages);
      const doc = await TenderDocument.findById(documentId);
      if (doc) {
        const production = await tenderProductionPipeline.run({
          documentId,
          tenderId: doc.tenderId,
          pages: pageTexts,
        });
        fieldLocatorFields = production.fields.map((f) => ({
          fieldName: f.fieldName,
          value: f.value,
          confidence: f.confidence,
          sourcePage: f.sourcePage,
          sourceText: f.sourceText,
          extractionMethod: `label_value_map:${f.extractionMethod}`,
        }));
      }
    }



    return {

      pages,

      fieldLocatorFields,

      extractedFields: extracted.map((e) => ({

        fieldName: e.fieldName,

        value: e.extractedValue,

        confidence: 70,

        sourcePage: e.sourcePage,

        sourceText: e.sourceText,

        extractionMethod: e.extractionMethod,

      })),

      validatedFields: validations.map((v) => ({

        fieldName: v.fieldName,

        value: v.value,

        confidence: v.valid ? 85 : 30,

        sourcePage: 0,

        sourceText: v.rawValue || v.value,

        valid: v.valid,

        extractionMethod: 'validated_rule',

      })),

      aiVerifiedFields: aiVerifications.map((a) => ({

        fieldName: a.fieldName,

        value: a.verifiedValue,

        confidence: a.confidence,

        sourcePage: a.sourcePage || 0,

        sourceText: a.sourceText || '',

        extractionMethod: 'openai_verification',

      })),

      provenance: {

        ocrPageCount: pages.length,

        ruleExtractedCount: extracted.length,

        validatedCount: validations.filter((v) => v.valid).length,

        aiVerifiedCount: aiVerifications.length,

        confidenceScoredCount: 0,

        fieldLocatorCount: fieldLocatorFields.length,

      },

    };

  }



  async buildFromDocument(documentId: Types.ObjectId): Promise<MasterDatasetBuildResult> {

    const sources = await this.loadSourceRecords(documentId);

    return masterDatasetBuilder.build({

      fieldLocatorFields: sources.fieldLocatorFields,

      extractedFields: sources.extractedFields,

      validatedFields: sources.validatedFields,

      aiVerifiedFields: sources.aiVerifiedFields,

      provenance: sources.provenance,

    });

  }



  async buildAndStore(ctx: MasterDatasetStoreContext): Promise<MasterDatasetBuildResult> {

    console.log('[MasterDataset] Start', { tenderId: String(ctx.tenderId), documentId: String(ctx.documentId) });

    const result = await this.buildFromDocument(ctx.documentId);

    const sources = await this.loadSourceRecords(ctx.documentId);



    await TenderMasterDataset.findOneAndUpdate(

      { documentId: ctx.documentId },

      {

        $set: {

          tenderId: ctx.tenderId,

          documentId: ctx.documentId,

          jobId: ctx.jobId,

          dataset: result.dataset,

          statistics: result.statistics,

          provenance: sources.provenance,

          schemaVersion: 2,

        },

      },

      { upsert: true, new: true }

    );



    console.log('[MasterDataset] Stored (field locator priority)', result.statistics);

    return result;

  }



  async getByDocumentId(documentId: Types.ObjectId) {

    return TenderMasterDataset.findOne({ documentId });

  }



  async getByTenderId(tenderId: Types.ObjectId) {

    const doc = await TenderDocument.findOne({ tenderId }).sort({ createdAt: -1 });

    if (!doc) return null;

    return TenderMasterDataset.findOne({ documentId: doc._id });

  }



  async getOrBuildByDocumentId(

    documentId: Types.ObjectId,

    tenderId: Types.ObjectId,

    jobId?: Types.ObjectId

  ) {

    const result = await this.buildAndStore({ tenderId, documentId, jobId });

    const record = await this.getByDocumentId(documentId);

    return {

      dataset: result.dataset,

      statistics: result.statistics,

      provenance: record?.provenance ?? {

        ocrPageCount: 0,

        ruleExtractedCount: 0,

        validatedCount: 0,

        aiVerifiedCount: 0,

        confidenceScoredCount: 0,

        fieldLocatorCount: 0,

      },

      stored: !!record,

    };

  }

}



export const masterDatasetService = new MasterDatasetService();


