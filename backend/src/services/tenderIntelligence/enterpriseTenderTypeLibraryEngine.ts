import {
  TenderTypeIntelligenceType,
  TenderTypeLibrary,
  TenderTypeLibraryMatchOutput,
  TenderTypeProfile,
} from '../../types/tenderTypeIntelligence';
import {
  getTenderTypeProfile,
  getTenderTypeProfileDefinitions,
  TENDER_TYPE_PROFILE_KNOWLEDGE_BASE,
} from './tenderTypeIntelligenceKnowledgeBase';
import { normalizeAliasKey } from '../tenderParameter/enterpriseTenderAliasEngine';

export const TYPE_LIBRARY_CONFIDENCE_BOOST = 20;

function libraryNameFor(tenderType: string): string {
  return tenderType ? `${tenderType} Library` : 'General Tender Library';
}

function normalizeLabel(label: string): string {
  return normalizeAliasKey(label);
}

function profileToLibrary(profile: TenderTypeProfile, searchParameters?: string[]): TenderTypeLibrary {
  const tenderType = profile.tenderType;
  return {
    tenderType,
    libraryLoaded: libraryNameFor(tenderType || 'General'),
    focusParameters: profile.parameters,
    aliases: profile.aliases,
    extractionRules: profile.rules,
    searchParameters: searchParameters?.length ? searchParameters : profile.parameters,
  };
}

/** Load category-specific parameter library after tender type detection. */
export function loadTenderTypeLibrary(tenderType: string): TenderTypeLibrary {
  const profile = getTenderTypeProfile(tenderType);
  const def = TENDER_TYPE_PROFILE_KNOWLEDGE_BASE.find((d) => d.type === tenderType);
  return profileToLibrary(profile, def?.searchParameters ?? profile.parameters);
}

export function getSupportedTenderTypeLibraries(): string[] {
  return getTenderTypeProfileDefinitions().map((d) => libraryNameFor(d.type));
}

export function matchesTenderTypeLibraryParameter(parameter: string, tenderType: string): boolean {
  if (!tenderType || !parameter?.trim()) return false;
  const library = loadTenderTypeLibrary(tenderType);
  const norm = normalizeLabel(parameter);

  for (const focus of library.focusParameters) {
    if (normalizeLabel(focus) === norm) return true;
    if (norm.includes(normalizeLabel(focus)) || normalizeLabel(focus).includes(norm)) return true;
  }

  for (const alias of library.aliases) {
    if (normalizeLabel(alias.to) === norm) return true;
    if (alias.from.some((a) => normalizeLabel(a) === norm)) return true;
  }

  return false;
}

export function resolveTenderTypeLibraryParameter(
  parameter: string,
  tenderType: string
): { standardParameter: string; matched: boolean; libraryLoaded: string } {
  const library = loadTenderTypeLibrary(tenderType);
  const norm = normalizeLabel(parameter);

  for (const alias of library.aliases) {
    if (alias.from.some((a) => normalizeLabel(a) === norm)) {
      return { standardParameter: alias.to, matched: true, libraryLoaded: library.libraryLoaded };
    }
    if (normalizeLabel(alias.to) === norm) {
      return { standardParameter: alias.to, matched: true, libraryLoaded: library.libraryLoaded };
    }
  }

  for (const focus of library.focusParameters) {
    if (normalizeLabel(focus) === norm) {
      return { standardParameter: focus, matched: true, libraryLoaded: library.libraryLoaded };
    }
  }

  return { standardParameter: parameter, matched: false, libraryLoaded: library.libraryLoaded };
}

export function applyTenderTypeLibraryConfidenceBoost(
  confidence: number,
  parameter: string,
  tenderType: string
): number {
  if (!tenderType || !matchesTenderTypeLibraryParameter(parameter, tenderType)) return confidence;
  return Math.min(100, confidence + TYPE_LIBRARY_CONFIDENCE_BOOST);
}

export function formatTenderTypeLibraryAliasHints(library: TenderTypeLibrary): string {
  if (!library.aliases.length) return '';
  const lines = library.aliases.map(
    (a) => `- [${library.tenderType}] ${a.from.join(' | ')} → ${a.to}`
  );
  return `TENDER-TYPE LIBRARY ALIASES (${library.libraryLoaded}):\n${lines.join('\n')}`;
}

export function formatTenderTypeLibraryExtractionPrompt(library: TenderTypeLibrary): string {
  if (!library.tenderType) return '';

  const searchList = library.searchParameters.map((p) => `- ${p}`).join('\n');
  const ruleList = library.extractionRules.map((r) => `- ${r}`).join('\n');

  return `ENTERPRISE TENDER-TYPE LIBRARY ENGINE
Library Loaded: ${library.libraryLoaded}
Detected Tender Type: ${library.tenderType}

TYPE-SPECIFIC SEARCH — when tender type = ${library.tenderType}, prioritize ONLY these parameters:
${searchList}

Do NOT extract type-specific fields from other categories unless explicitly present.
Example: GeM → search ePBG, MSE, Make In India; Manpower → search EPF, ESIC, Payroll Strength; Security → search PSARA, Armed Guards.

EXTRACTION RULES (${library.libraryLoaded}):
${ruleList}`;
}

export function buildTenderTypeLibraryOutput(
  tenderType: string,
  parameter: string,
  value: string
): TenderTypeLibraryMatchOutput {
  const library = loadTenderTypeLibrary(tenderType);
  const resolved = resolveTenderTypeLibraryParameter(parameter, tenderType);
  const typeLibraryMatch = matchesTenderTypeLibraryParameter(resolved.standardParameter, tenderType);

  return {
    tenderType: tenderType || '',
    libraryLoaded: library.libraryLoaded,
    parameter: resolved.standardParameter,
    value,
    typeLibraryMatch,
    confidenceBoost: typeLibraryMatch ? TYPE_LIBRARY_CONFIDENCE_BOOST : 0,
  };
}

export function buildTenderTypeLibraryContext(tenderType: string, confidence: number): string {
  const library = loadTenderTypeLibrary(tenderType);
  if (!library.tenderType) {
    return 'TENDER-TYPE LIBRARY: Unclassified — apply general government tender parameter extraction.';
  }

  return `${formatTenderTypeLibraryExtractionPrompt(library)}

Detection Confidence: ${confidence}%
Scoring: parameters matching ${library.libraryLoaded} receive +${TYPE_LIBRARY_CONFIDENCE_BOOST} confidence boost.`;
}

export function getEnterpriseTenderTypeLibrarySummary() {
  return {
    engine: 'enterprise_tender_type_library',
    confidenceBoost: TYPE_LIBRARY_CONFIDENCE_BOOST,
    supportedTypes: TENDER_TYPE_PROFILE_KNOWLEDGE_BASE.map((d) => d.type),
    libraries: TENDER_TYPE_PROFILE_KNOWLEDGE_BASE.map((d) => ({
      tenderType: d.type,
      libraryLoaded: libraryNameFor(d.type),
      focusParameterCount: d.parameters.length,
      aliasCount: d.aliases.length,
      ruleCount: d.rules.length,
      searchParameterCount: (d.searchParameters ?? d.parameters).length,
      focusParameters: d.parameters,
      aliases: d.aliases,
      extractionRules: d.rules,
    })),
    extractionLogic:
      'After tender type detection → load type library → search type-specific parameters → apply +20 confidence on match',
    outputExample: buildTenderTypeLibraryOutput('GeM', 'ePBG Percentage', '3%'),
  };
}
