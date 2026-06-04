import {

  ExtractedField,

  IntelligenceFieldKey,

  MergedIntelligence,

  PageText,

} from '../../types/intelligence';

import { buildEmptyMerged, LIST_FIELDS } from './fields';

import { PRODUCTION_FIELDS, ProductionFieldDefinition } from './fieldDefinitions';

import { DocumentMap } from './documentMapBuilder';
import { ExtractedTable } from './tableExtractionService';

import { isVerifiedField } from './fieldVerification';

import { validateMergedField } from './valueValidator';

import {
  productionFieldPipeline,
  VERIFICATION_STORE_THRESHOLD,
} from './productionFieldPipeline';

import { RECOVERY_PRIORITY_FIELD_IDS } from './recoveryFieldIds';



export type { ExtractedProductionField } from './extractedProductionField';

export { RECOVERY_PRIORITY_FIELD_IDS } from './recoveryFieldIds';



import type { ExtractedProductionField } from './extractedProductionField';



export interface ExtractAllOptions {
  recoveryOnly?: boolean;
  structuredTables?: ExtractedTable[];
}



class FieldExtractionEngine {

  /**

   * Stages 3–5: Rule extraction → candidate scoring → context + AI verification per field.

   */

  async extractAll(

    pages: PageText[],

    documentMap?: DocumentMap,

    options?: ExtractAllOptions

  ): Promise<{

    productionFields: ExtractedProductionField[];

    merged: MergedIntelligence;

  }> {

    const fieldIds = options?.recoveryOnly ? RECOVERY_PRIORITY_FIELD_IDS : PRODUCTION_FIELDS.map((f) => f.id);

    const byId = new Map<string, ExtractedProductionField>();

    const extractOpts = { documentMap, structuredTables: options?.structuredTables };



    for (const id of fieldIds) {

      const def = this.getFieldDefinition(id);

      if (!def) continue;

      const field = await this.extractOne(def, pages, extractOpts);

      if (field) byId.set(id, field);

    }



    if (!options?.recoveryOnly) {

      for (const id of RECOVERY_PRIORITY_FIELD_IDS) {

        if (byId.has(id)) continue;

        const def = this.getFieldDefinition(id);

        if (!def) continue;

        const field = await this.extractOne(def, pages, { ...extractOpts, recoveryPass: true });

        if (field) byId.set(id, field);

      }

    }



    const productionFields: ExtractedProductionField[] = [];

    for (const def of PRODUCTION_FIELDS) {

      const field = byId.get(def.id);

      if (field) productionFields.push(field);

    }



    return { productionFields, merged: this.buildMerged(productionFields) };

  }



  private async extractOne(

    def: ProductionFieldDefinition,

    pages: PageText[],

    options?: {

      recoveryPass?: boolean;

      lowConfidenceRecovery?: boolean;

      excludePages?: number[];

      documentMap?: DocumentMap;
      structuredTables?: ExtractedTable[];
    }

  ): Promise<ExtractedProductionField | null> {

    let verified = await productionFieldPipeline.processField(def, pages, options);



    if (!verified && !options?.recoveryPass) {

      verified = await productionFieldPipeline.processField(def, pages, {

        ...options,

        recoveryPass: true,

      });

    }



    if (!verified || verified.confidence < VERIFICATION_STORE_THRESHOLD) {
      return null;
    }

    return {
      id: def.id,
      label: def.label,
      mergeKey: def.mergeKey,
      section: def.section,
      value: verified.value,
      sourcePage: verified.sourcePage,
      sourceText: verified.sourceText,
      confidence: verified.confidence,
      validated: true,
      needsReview: verified.needsReview,
    };

  }



  private buildMerged(productionFields: ExtractedProductionField[]): MergedIntelligence {

    const mergeMap = new Map<IntelligenceFieldKey, ExtractedField[]>();



    for (const pf of productionFields) {

      const extraction: ExtractedField = {

        value: pf.value,

        page: pf.sourcePage,

        confidence: pf.confidence,

        sourceText: pf.sourceText,

      };

      const existing = mergeMap.get(pf.mergeKey) || [];

      existing.push(extraction);

      mergeMap.set(pf.mergeKey, existing);

    }



    const merged = buildEmptyMerged() as MergedIntelligence;



    for (const [key, extractions] of mergeMap.entries()) {

      const fieldKey = key as IntelligenceFieldKey;

      const best = extractions.sort((a, b) => b.confidence - a.confidence)[0];



      let value: string | string[] | null = best.value;

      if (LIST_FIELDS.includes(fieldKey) || extractions.length > 1) {

        const all = extractions.flatMap((e) =>

          Array.isArray(e.value) ? e.value.map(String) : [String(e.value)]

        );

        value = [...new Set(all)].filter(Boolean);

      }



      merged[fieldKey] = validateMergedField(fieldKey, {

        value,

        sourcePages: [...new Set(extractions.map((e) => e.page))].sort((a, b) => a - b),

        confidence: Math.max(...extractions.map((e) => e.confidence)),

        validated: true,

        allExtractions: extractions,

      });

    }



    return merged;

  }



  getFieldDefinition(id: string): ProductionFieldDefinition | undefined {

    return PRODUCTION_FIELDS.find((f) => f.id === id);

  }



  async supplementFromMerged(

    productionFields: ExtractedProductionField[],

    merged: MergedIntelligence,

    pages: PageText[],

    documentMap?: DocumentMap,
    structuredTables?: ExtractedTable[]

  ): Promise<ExtractedProductionField[]> {

    const byId = new Map(productionFields.map((f) => [f.id, f]));



    for (const id of RECOVERY_PRIORITY_FIELD_IDS) {

      if (byId.has(id)) continue;

      const def = this.getFieldDefinition(id);

      if (!def) continue;



      const fromPass = await this.extractOne(def, pages, {
        recoveryPass: true,
        documentMap,
        structuredTables,
      });

      if (fromPass) {

        byId.set(id, fromPass);

        continue;

      }



      const mf = merged[def.mergeKey];

      if (!isVerifiedField(mf) || !mf.value || mf.confidence < VERIFICATION_STORE_THRESHOLD) {

        continue;

      }



      byId.set(id, {

        id: def.id,

        label: def.label,

        mergeKey: def.mergeKey,

        section: def.section,

        value: mf.value,

        sourcePage: mf.sourcePages?.[0] ?? 1,

        confidence: mf.confidence,

        validated: true,

        needsReview: false,

      });

    }



    const ordered: ExtractedProductionField[] = [];

    for (const def of PRODUCTION_FIELDS) {

      const f = byId.get(def.id);

      if (f) ordered.push(f);

    }

    return ordered;

  }

}



export const fieldExtractionEngine = new FieldExtractionEngine();

