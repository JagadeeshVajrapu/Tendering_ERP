import { ChunkExtractionResult, PageText } from '../../types/intelligence';
import { localIntelligenceExtractor } from './localIntelligenceExtractor';

/**
 * Stage 2 — Rule-based extraction (deterministic, no AI).
 * Runs before multi-pass AI. Results tagged with pass `rule` for merge provenance.
 */
class RuleExtractionEngine {
  run(pages: PageText[]): ChunkExtractionResult[] {
    const results = localIntelligenceExtractor.extractFromPages(pages);
    return results.map((r) => ({
      ...r,
      pass: 'rule' as const,
      model: 'rule-engine',
    }));
  }
}

export const ruleExtractionEngine = new RuleExtractionEngine();
