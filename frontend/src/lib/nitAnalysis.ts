import type { NitAnalysisSheet, TenderIntelligence, IntelligenceRecommendation } from '@/types';

/** Use server-built dynamic NIT tables (only verified fields). */
export function getNitAnalysisSheet(intelligence: TenderIntelligence): NitAnalysisSheet {
  if (intelligence.nitTables) return intelligence.nitTables;

  return {
    generalInformation: [],
    financialInformation: [],
    timelineInformation: [],
    eligibilityInformation: [],
    requiredDocuments: [],
    complianceRequirements: [],
    riskAnalysis: [],
    executiveSummary: intelligence.executiveBullets?.slice(0, 10) ?? [
      `Recommendation: ${intelligence.recommendation}`,
    ],
  };
}

export function getRecommendation(intelligence: TenderIntelligence): IntelligenceRecommendation {
  return intelligence.mdReport?.recommendation ?? intelligence.recommendation;
}

export function countFoundFields(sheet: NitAnalysisSheet): number {
  if (sheet.executiveSheet?.sections?.length) {
    let n = 0;
    for (const s of sheet.executiveSheet.sections) {
      n += s.rows.length;
      n += s.scopeLines?.length ?? 0;
      n += s.documentItems?.length ?? 0;
      n += s.technicalItems?.length ?? 0;
      n += s.riskItems?.length ?? 0;
    }
    if (n > 0) return n;
  }
  if (sheet.executiveSheet?.rows?.length) {
    return sheet.executiveSheet.rows.length;
  }
  if (sheet.executiveSheet?.verifiedFieldCount != null) {
    return sheet.executiveSheet.verifiedFieldCount;
  }
  return (
    sheet.generalInformation.length +
    sheet.financialInformation.length +
    sheet.timelineInformation.length +
    sheet.eligibilityInformation.length +
    sheet.requiredDocuments.length +
    sheet.complianceRequirements.length +
    sheet.riskAnalysis.length
  );
}

export function getExecutiveNitSheet(intelligence: TenderIntelligence) {
  const sheet = getNitAnalysisSheet(intelligence);
  return sheet.executiveSheet ?? null;
}
