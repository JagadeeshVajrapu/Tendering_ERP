import {
  FeasibilityRecommendation,
  MdReport,
  MergedIntelligence,
  NitAnalysisSheet,
  NitDocumentRow,
  NitEligibilityRow,
  NitRiskRow,
  NitTableRow,
} from '../../types/intelligence';
import { ExtractedProductionField } from './extractedProductionField';
import { FieldSection } from './fieldDefinitions';
import { buildExecutiveSummaryFromValidated } from './executiveSummaryBuilder';
import { buildExecutiveNitPresentation } from './executiveNitSheetBuilder';
import { VerifiedNitJson } from './verifiedNitJsonBuilder';
import { VERIFICATION_DISPLAY_THRESHOLD } from './fieldVerificationPipeline';
import { RiskAnalysisResult } from '../../types/riskAnalysis';
import { NitRiskItem } from '../../types/intelligence';

function toRow(field: ExtractedProductionField): NitTableRow | NitEligibilityRow | null {
  if (!field.validated || !field.value) return null;
  if (field.confidence < VERIFICATION_DISPLAY_THRESHOLD) return null;
  const value = Array.isArray(field.value) ? field.value.join('; ') : String(field.value);
  if (!value.trim()) return null;

  const sourcePage = `Page ${field.sourcePage}`;
  const confidence = Math.round(field.confidence * 100);
  const needsReview = field.needsReview;

  if (field.section === 'eligibility') {
    return {
      parameter: field.label,
      requirement: value,
      sourcePage,
      confidence,
      needsReview,
    } as NitEligibilityRow;
  }

  return {
    parameter: field.label,
    value,
    sourcePage,
    confidence,
    needsReview,
  } as NitTableRow;
}

function sectionRows(
  fields: ExtractedProductionField[],
  section: FieldSection
): NitTableRow[] {
  return fields
    .filter((f) => f.section === section && f.section !== 'eligibility' && f.section !== 'documents' && f.section !== 'risk')
    .map((f) => toRow(f) as NitTableRow | null)
    .filter((r): r is NitTableRow => r !== null);
}

class NitTableBuilder {
  buildFromProductionFields(
    productionFields: ExtractedProductionField[],
    merged: MergedIntelligence,
    recommendation: FeasibilityRecommendation,
    verifiedNit?: VerifiedNitJson,
    riskItems?: NitRiskItem[],
    engineRiskAnalysis?: RiskAnalysisResult
  ): NitAnalysisSheet {
    const generalInformation = sectionRows(productionFields, 'general');
    const financialInformation = [
      ...sectionRows(productionFields, 'financial'),
      ...productionFields
        .filter((f) => f.section === 'financial' && f.id === 'financialRequirements')
        .map((f) => toRow(f) as NitTableRow | null)
        .filter((r): r is NitTableRow => r !== null),
    ];

    const timelineInformation = sectionRows(productionFields, 'timeline');

    const eligibilityInformation = productionFields
      .filter((f) => f.section === 'eligibility')
      .map((f) => toRow(f) as NitEligibilityRow | null)
      .filter((r): r is NitEligibilityRow => r !== null);

    const requiredDocuments: NitDocumentRow[] = productionFields
      .filter((f) => f.id === 'requiredDocuments' && f.validated && f.value)
      .flatMap((f) => {
        const items = Array.isArray(f.value) ? f.value.map(String) : [String(f.value)];
        return items.slice(0, 15).map((doc) => ({
          document: doc.slice(0, 120),
          sourcePage: `Page ${f.sourcePage}`,
          confidence: Math.round(f.confidence * 100),
          needsReview: f.needsReview,
        }));
      });

    const complianceRequirements = sectionRows(productionFields, 'compliance');

    const technicalRequirements = productionFields
      .filter((f) => f.section === 'technical' && f.validated)
      .map((f) => toRow(f) as NitTableRow | null)
      .filter((r): r is NitTableRow => r !== null);

    const riskAnalysis: NitRiskRow[] = productionFields
      .filter((f) => f.id === 'risks' && f.validated && f.value)
      .flatMap((f) => {
        const items = Array.isArray(f.value) ? f.value.map(String) : [String(f.value)];
        return items.slice(0, 6).map((desc, i) => ({
          risk: i === 0 ? 'Documented Risk / Penalty' : `Risk ${i + 1}`,
          severity: deriveRiskSeverity(desc),
          description: desc.slice(0, 150),
          sourcePage: `Page ${f.sourcePage}`,
          confidence: Math.round(f.confidence * 100),
          needsReview: f.needsReview,
        }));
      });

    const executiveSummary = buildExecutiveSummaryFromValidated(
      productionFields,
      recommendation
    );

    const legacySheet: NitAnalysisSheet = {
      generalInformation: dedupeRows(generalInformation),
      financialInformation: dedupeRows(financialInformation),
      timelineInformation: dedupeRows(timelineInformation),
      eligibilityInformation,
      requiredDocuments,
      technicalRequirements: dedupeRows(technicalRequirements),
      complianceRequirements: dedupeRows(complianceRequirements),
      riskAnalysis,
      executiveSummary,
    };

    const mdReport = this.buildMdReport(
      productionFields,
      merged,
      recommendation,
      engineRiskAnalysis
    );
    legacySheet.executiveSheet = buildExecutiveNitPresentation(
      productionFields,
      recommendation,
      mdReport,
      legacySheet,
      verifiedNit,
      riskItems
    );

    return legacySheet;
  }

  build(
    merged: MergedIntelligence,
    recommendation: FeasibilityRecommendation,
    productionFields?: ExtractedProductionField[],
    verifiedNit?: VerifiedNitJson,
    riskItems?: NitRiskItem[],
    engineRiskAnalysis?: RiskAnalysisResult
  ): NitAnalysisSheet {
    if (productionFields?.length) {
      return this.buildFromProductionFields(
        productionFields,
        merged,
        recommendation,
        verifiedNit,
        riskItems,
        engineRiskAnalysis
      );
    }
    return this.buildFromProductionFields(
      [],
      merged,
      recommendation,
      verifiedNit,
      riskItems,
      engineRiskAnalysis
    );
  }

  buildMdReport(
    productionFields: ExtractedProductionField[],
    _merged: MergedIntelligence,
    recommendation: FeasibilityRecommendation,
    riskAnalysis?: RiskAnalysisResult
  ): MdReport {
    const validatedOnly = productionFields.filter(
      (f) => f.validated && f.confidence >= VERIFICATION_DISPLAY_THRESHOLD
    );

    const scope = validatedOnly.find((f) => f.id === 'scopeOfWork');
    const eligibilityParts = validatedOnly
      .filter((f) => f.section === 'eligibility')
      .map((f) => `${f.label}: ${Array.isArray(f.value) ? f.value.join('; ') : f.value}`);
    const timelineParts = validatedOnly
      .filter((f) => f.section === 'timeline')
      .map((f) => `${f.label}: ${f.value}`);
    const financialParts = validatedOnly
      .filter(
        (f) =>
          f.section === 'financial' &&
          ['estimatedTenderValue', 'emdAmount', 'tenderFee', 'performanceSecurity', 'bankGuarantee', 'financialRequirements'].includes(
            f.id
          )
      )
      .map((f) => `${f.label}: ${Array.isArray(f.value) ? f.value.join('; ') : f.value}`);

    const riskParts = validatedOnly
      .filter((f) => f.id === 'risks')
      .flatMap((f) => (Array.isArray(f.value) ? f.value.map(String) : [String(f.value)]))
      .slice(0, 5);

    const engineRiskSummary = riskAnalysis
      ? riskAnalysis.items.map((r) => `${r.category}: ${r.explanation}`).join(' ')
      : '';

    const complianceParts = validatedOnly
      .filter((f) => f.section === 'compliance')
      .map((f) => (Array.isArray(f.value) ? f.value.join('; ') : String(f.value)));

    const technical = validatedOnly.find((f) => f.id === 'technicalRequirements');
    const documents = validatedOnly.find((f) => f.id === 'requiredDocuments');

    return {
      scopeSummary: scope
        ? String(Array.isArray(scope.value) ? scope.value[0] : scope.value).slice(0, 500)
        : '',
      eligibilitySummary: eligibilityParts.join('. ').slice(0, 600) || '',
      timelineSummary: timelineParts.join('. ').slice(0, 500) || '',
      financialSummary: financialParts.join('. ').slice(0, 600) || '',
      riskAssessment:
        engineRiskSummary.slice(0, 600) ||
        riskParts.join('. ').slice(0, 500) ||
        (complianceParts.length ? complianceParts.join('. ').slice(0, 400) : ''),
      recommendation,
      criticalRequirements: buildCriticalChecklist(validatedOnly, technical, documents),
    };
  }
}

function buildCriticalChecklist(
  fields: ExtractedProductionField[],
  technical?: ExtractedProductionField,
  documents?: ExtractedProductionField
): string[] {
  const critical = [
    'tenderName',
    'tenderNumber',
    'emdAmount',
    'estimatedTenderValue',
    'bidSubmissionDate',
    'experienceRequirements',
    'turnoverRequirements',
    'requiredDocuments',
  ];
  const lines: string[] = [];
  for (const id of critical) {
    const f = fields.find((x) => x.id === id);
    if (f) {
      const v = Array.isArray(f.value) ? f.value[0] : f.value;
      lines.push(`✓ ${f.label}: ${String(v).slice(0, 80)}`);
    }
  }
  if (technical?.validated) {
    lines.push(`✓ Technical requirements captured (Page ${technical.sourcePage})`);
  }
  if (documents?.validated) {
    const n = Array.isArray(documents.value) ? documents.value.length : 1;
    lines.push(`✓ Required documents: ${n} item(s)`);
  }
  return lines;
}

function dedupeRows(rows: NitTableRow[]): NitTableRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = r.parameter.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function deriveRiskSeverity(desc: string): 'Low' | 'Medium' | 'High' {
  const lower = desc.toLowerCase();
  if (/disqualif|forfeit|termination|penalty|liquidated|blacklist/i.test(lower)) return 'High';
  if (/compliance|document|deadline|emd|guarantee/i.test(lower)) return 'Medium';
  return 'Low';
}

export const nitTableBuilder = new NitTableBuilder();
