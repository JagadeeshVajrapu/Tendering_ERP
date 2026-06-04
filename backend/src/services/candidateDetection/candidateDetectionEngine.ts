import { PageText } from '../../types/intelligence';
import {
  CandidateDetectionResult,
  CandidateDetectionStatistics,
  DetectedFieldCandidate,
} from '../../types/candidateDetection';
import { FIELD_BY_ID, PRODUCTION_FIELDS } from '../intelligence/fieldDefinitions';
import { collectAllFieldCandidates } from '../intelligence/fieldLevelExtractor';
import {
  CANDIDATE_DETECTION_FIELD_DEFS,
  CANDIDATE_DETECTION_PROFILES,
} from './candidateDetectionFields';
import { ProductionFieldDefinition } from '../intelligence/fieldDefinitions';

const SUPPLEMENTARY_BY_ID = Object.fromEntries(
  CANDIDATE_DETECTION_FIELD_DEFS.map((f) => [f.id, f])
) as Record<string, ProductionFieldDefinition>;

class CandidateDetectionEngine {
  /**
   * Scan OCR pages for all configured field candidates (before OpenAI / rule extraction).
   */
  detect(pages: PageText[]): CandidateDetectionResult {
    const started = Date.now();
    const candidates: DetectedFieldCandidate[] = [];
    const byField: Record<string, number> = {};

    console.log('[CandidateDetection] Start', { pages: pages.length, fields: CANDIDATE_DETECTION_PROFILES.length });

    for (const profile of CANDIDATE_DETECTION_PROFILES) {
      const def = this.resolveFieldDef(profile.fieldId);
      if (!def) {
        console.warn('[CandidateDetection] Unknown field id', profile.fieldId);
        continue;
      }

      const raw = collectAllFieldCandidates(def, pages);
      const mapped = raw.map((c) => this.toDetectedCandidate(profile.fieldName, c));

      for (const candidate of mapped) {
        if (this.isDuplicate(candidates, candidate)) continue;
        candidates.push(candidate);
        byField[profile.fieldName] = (byField[profile.fieldName] || 0) + 1;
      }
    }

    const statistics: CandidateDetectionStatistics = {
      totalCandidates: candidates.length,
      byField,
      pagesScanned: pages.length,
      processingTimeMs: Date.now() - started,
    };

    console.log('[CandidateDetection] End', {
      totalCandidates: statistics.totalCandidates,
      pagesScanned: statistics.pagesScanned,
      processingTimeMs: statistics.processingTimeMs,
      byField: statistics.byField,
    });

    return { candidates, statistics };
  }

  private resolveFieldDef(fieldId: string): ProductionFieldDefinition | undefined {
    return SUPPLEMENTARY_BY_ID[fieldId] || FIELD_BY_ID[fieldId] || PRODUCTION_FIELDS.find((f) => f.id === fieldId);
  }

  private toDetectedCandidate(
    fieldName: string,
    c: { value: string; page: number; sourceText?: string; source?: string; score?: number }
  ): DetectedFieldCandidate {
    return {
      fieldName,
      candidateValue: c.value,
      sourcePage: c.page,
      sourceText: c.sourceText || c.value,
      detectionMethod: c.source || 'pattern',
      confidence: c.score ? Math.min(1, c.score / 25) : undefined,
    };
  }

  private isDuplicate(existing: DetectedFieldCandidate[], next: DetectedFieldCandidate): boolean {
    const key = `${next.fieldName}|${next.candidateValue.toLowerCase()}|${next.sourcePage}`;
    return existing.some(
      (c) => `${c.fieldName}|${c.candidateValue.toLowerCase()}|${c.sourcePage}` === key
    );
  }
}

export const candidateDetectionEngine = new CandidateDetectionEngine();
