import { TenderParameterCandidateRow } from '../../types/tenderParameterCandidateExtraction';
import { TenderDocumentSectionType } from '../../types/tenderIntelligenceLayer';
import {
  PageSectionClassification,
  isPagePrimarilyAnnexure,
  pageHasSection,
} from './enterpriseSectionDetectionEngine';
import {
  getAllowedSectionsForParameter,
  getPrimarySectionForParameter,
} from './enterpriseSectionParameterRegistry';

export interface CandidateSectionValidation {
  allowed: boolean;
  sectionName: string;
  sectionConfidence: number;
  matchType: 'primary' | 'fallback' | 'unrestricted' | 'annexure_rejected' | 'section_mismatch';
  reason: string;
}

export function validateCandidateSectionAssignment(
  row: TenderParameterCandidateRow,
  pageClassifications: PageSectionClassification[]
): CandidateSectionValidation {
  const primarySection = getPrimarySectionForParameter(row.parameter, row.canonicalKey);
  const pageInfo = pageClassifications.find((p) => p.page === row.page);

  if (!primarySection) {
    const sectionName = pageInfo?.primarySection || 'General';
    const sectionConfidence = pageInfo?.primaryConfidence || 50;
    const annexurePage = isPagePrimarilyAnnexure(pageClassifications, row.page);
    return {
      allowed: !annexurePage,
      sectionName: String(sectionName),
      sectionConfidence,
      matchType: annexurePage ? 'annexure_rejected' : 'unrestricted',
      reason: annexurePage
        ? 'Dynamic parameter on annexure-only page'
        : 'No section rule — page section applied',
    };
  }

  const allowedSections = getAllowedSectionsForParameter(row.parameter, row.canonicalKey);

  if (isPagePrimarilyAnnexure(pageClassifications, row.page)) {
    const annexureOk = primarySection === 'Tender Specific' || primarySection === 'Compliance';
    if (!annexureOk) {
      return {
        allowed: false,
        sectionName: 'Annexures',
        sectionConfidence: pageInfo?.sections.find((s) => s.section === 'Annexures')?.confidence || 80,
        matchType: 'annexure_rejected',
        reason: `${primarySection} parameter must not come from Annexures section`,
      };
    }
  }

  if (pageHasSection(pageClassifications, row.page, primarySection)) {
    const hit = pageInfo?.sections.find((s) => s.section === primarySection);
    return {
      allowed: true,
      sectionName: primarySection,
      sectionConfidence: hit?.confidence || pageInfo?.primaryConfidence || 85,
      matchType: 'primary',
      reason: `Matched primary section ${primarySection}`,
    };
  }

  for (const fallback of allowedSections.slice(1)) {
    if (pageHasSection(pageClassifications, row.page, fallback as TenderDocumentSectionType)) {
      const hit = pageInfo?.sections.find((s) => s.section === fallback);
      return {
        allowed: true,
        sectionName: fallback,
        sectionConfidence: hit?.confidence || 70,
        matchType: 'fallback',
        reason: `Fallback section ${fallback} (primary ${primarySection} not on page)`,
      };
    }
  }

  return {
    allowed: false,
    sectionName: pageInfo?.primarySection || primarySection,
    sectionConfidence: pageInfo?.primaryConfidence || 40,
    matchType: 'section_mismatch',
    reason: `Page ${row.page} sections [${pageInfo?.sections.map((s) => s.section).join(', ') || 'unknown'}] do not match required ${primarySection}`,
  };
}

export function filterCandidatesBySection(
  candidates: TenderParameterCandidateRow[],
  pageClassifications: PageSectionClassification[]
): {
  accepted: TenderParameterCandidateRow[];
  rejected: Array<TenderParameterCandidateRow & { sectionRejectReason: string }>;
} {
  const accepted: TenderParameterCandidateRow[] = [];
  const rejected: Array<TenderParameterCandidateRow & { sectionRejectReason: string }> = [];

  for (const row of candidates) {
    const validation = validateCandidateSectionAssignment(row, pageClassifications);
    const enriched = {
      ...row,
      sectionName: validation.sectionName,
      sectionConfidence: validation.sectionConfidence,
    };

    if (validation.allowed) {
      accepted.push(enriched);
    } else {
      rejected.push({ ...enriched, sectionRejectReason: validation.reason });
    }
  }

  return { accepted, rejected };
}
