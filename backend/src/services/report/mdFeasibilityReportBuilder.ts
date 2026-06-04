import { ITenderIntelligence } from '../../models/TenderIntelligence';
import {
  buildExecutiveFeasibilityReport,
  ExecutiveFeasibilityReport,
} from './executiveFeasibilityReportBuilder';
import { FeasibilityReportContent } from './pdfService';

export type { ExecutiveFeasibilityReport } from './executiveFeasibilityReportBuilder';

export interface MdFeasibilityContent extends FeasibilityReportContent {
  executive: ExecutiveFeasibilityReport;
  tenderTitle: string;
  tenderNumber: string;
  organization: string;
}

function mapLegacyRecommendation(
  rec: ExecutiveFeasibilityReport['recommendation']
): 'Suitable' | 'Not Suitable' {
  return rec === 'APPLY' ? 'Suitable' : 'Not Suitable';
}

export function buildMdFeasibilityContent(intelligence: ITenderIntelligence): MdFeasibilityContent {
  const executive = buildExecutiveFeasibilityReport(intelligence);
  const tables = intelligence.nitTables;

  const tenderNumber =
    intelligence.productionFields?.find((f) => f.id === 'tenderNumber' && f.validated)?.value ||
    tables?.generalInformation.find((r) => r.parameter === 'Tender Number')?.value ||
    '';

  const tenderNumberStr = Array.isArray(tenderNumber) ? tenderNumber[0] : String(tenderNumber || '');

  return {
    tenderTitle: executive.tenderName,
    tenderNumber: tenderNumberStr,
    organization: executive.organization,
    executive,
    scopeSummary: executive.scopeBullets.map((b) => `• ${b}`).join('\n'),
    eligibilitySummary: [
      ...executive.eligibilityBullets.map((b) => `• ${b}`),
      '',
      `Eligibility Status: ${executive.eligibilityStatus}`,
    ].join('\n'),
    timelineSummary: executive.timelineRows.map((r) => `${r.milestone}: ${r.date}`).join('\n'),
    financialSummary: executive.tenderValue
      ? `Estimated tender value: ${executive.tenderValue}`
      : '',
    keyRisks: executive.keyRisks,
    recommendation: mapLegacyRecommendation(executive.recommendation),
    intelligenceRecommendation: executive.recommendation,
    recommendationJustification: executive.recommendationJustification,
  };
}
