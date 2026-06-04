import {

  ALL_INTELLIGENCE_FIELDS,

  CONFIDENCE_THRESHOLD,

  LIST_FIELDS,

} from './fields';

import {

  ChunkExtractionResult,

  ExtractedField,

  IntelligenceFieldKey,

  MergedField,

  MergedIntelligence,

} from '../../types/intelligence';

import { filterValidExtractions } from './valueValidator';



function normalizeKey(value: string): string {

  return value.toLowerCase().replace(/\s+/g, ' ').trim();

}



function fieldValuesEqual(a: string, b: string): boolean {

  const ka = normalizeKey(a);

  const kb = normalizeKey(b);

  if (ka === kb) return true;

  if (ka.length > 30 && kb.length > 30) {

    return ka.includes(kb) || kb.includes(ka);

  }

  return false;

}



function dedupeExtractions(items: ExtractedField[]): ExtractedField[] {

  const result: ExtractedField[] = [];



  for (const item of items) {

    if (item.value === null) continue;



    const values = Array.isArray(item.value) ? item.value : [item.value];

    for (const v of values) {

      if (!v?.trim()) continue;

      const trimmed = v.trim();



      const existing = result.find((e) => {

        const ev = Array.isArray(e.value) ? e.value.join(', ') : String(e.value ?? '');

        return fieldValuesEqual(trimmed, ev);

      });



      if (!existing) {

        result.push({ value: trimmed, page: item.page, confidence: item.confidence });

      } else if (item.confidence > existing.confidence) {

        existing.confidence = item.confidence;

        existing.page = item.page;

      }

    }

  }



  return result.sort((a, b) => b.confidence - a.confidence);

}



function pickBestValue(field: IntelligenceFieldKey, extractions: ExtractedField[]): MergedField {

  const empty: MergedField = {

    value: null,

    sourcePages: [],

    confidence: 0,

    validated: false,

    allExtractions: [],

  };



  if (!extractions.length) return empty;



  const deduped = dedupeExtractions(extractions);

  if (!deduped.length) return empty;



  const sourcePages = [...new Set(deduped.map((e) => e.page))].sort((a, b) => a - b);



  if (LIST_FIELDS.includes(field)) {

    const allValues = deduped.map((e) => String(e.value));

    const avgConf = deduped.reduce((s, e) => s + e.confidence, 0) / deduped.length;

    return {

      value: allValues.length ? allValues : null,

      sourcePages,

      confidence: avgConf,

      validated: avgConf >= CONFIDENCE_THRESHOLD,

      allExtractions: deduped,

    };

  }



  const best = deduped[0];

  return {

    value: best.value,

    sourcePages,

    confidence: best.confidence,

    validated: best.confidence >= CONFIDENCE_THRESHOLD,

    allExtractions: deduped,

  };

}



class MergeEngine {

  merge(chunkResults: ChunkExtractionResult[]): MergedIntelligence {

    const fieldMap = new Map<IntelligenceFieldKey, ExtractedField[]>();



    for (const field of ALL_INTELLIGENCE_FIELDS) {

      fieldMap.set(field, []);

    }



    for (const chunkResult of chunkResults) {

      for (const [field, extractions] of Object.entries(chunkResult.fields)) {

        const key = field as IntelligenceFieldKey;

        if (!fieldMap.has(key) || !extractions?.length) continue;

        const valid = filterValidExtractions(key, extractions);

        fieldMap.get(key)!.push(...valid);

      }

    }



    const merged = {} as MergedIntelligence;

    for (const field of ALL_INTELLIGENCE_FIELDS) {

      merged[field] = pickBestValue(field, fieldMap.get(field) || []);

    }



    return merged;

  }



  appendRequeryResults(

    merged: MergedIntelligence,

    requeryFields: Partial<Record<IntelligenceFieldKey, ExtractedField[]>>

  ): MergedIntelligence {

    const updated = { ...merged };



    for (const [field, extractions] of Object.entries(requeryFields)) {

      const key = field as IntelligenceFieldKey;

      if (!extractions?.length) continue;



      const valid = filterValidExtractions(key, extractions);

      if (!valid.length) continue;



      const existing = updated[key]?.allExtractions || [];

      updated[key] = pickBestValue(key, [...existing, ...valid]);

    }



    return updated;

  }

}



export const mergeEngine = new MergeEngine();

