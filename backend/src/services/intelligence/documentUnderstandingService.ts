import { PageText } from '../../types/intelligence';
import { documentMapBuilder, DocumentMap, DocumentSectionType } from './documentMapBuilder';
export type { DocumentMap };

/** Consultant-facing document sections (Step 1). */
export type ConsultantSectionType =
  | 'general_information'
  | 'financial_information'
  | 'eligibility_criteria'
  | 'technical_requirements'
  | 'important_dates'
  | 'scope_of_work'
  | 'required_documents'
  | 'annexures';

export interface ConsultantSection {
  type: ConsultantSectionType;
  label: string;
  startPage: number;
  endPage: number;
  confidence: number;
}

export interface ConsultantDocumentUnderstanding {
  sections: ConsultantSection[];
  /** Raw engine map for page routing */
  documentMap: DocumentMap;
  pageCount: number;
  /** Pages tagged per consultant section */
  pagesBySection: Partial<Record<ConsultantSectionType, number[]>>;
}

const TYPE_MAP: Record<DocumentSectionType, ConsultantSectionType | null> = {
  notice_inviting_tender: 'general_information',
  general: 'general_information',
  financial: 'financial_information',
  eligibility: 'eligibility_criteria',
  technical: 'technical_requirements',
  scope_of_work: 'scope_of_work',
  bid_schedule: 'important_dates',
  annexure: 'annexures',
  compliance: 'eligibility_criteria',
};

const LABELS: Record<ConsultantSectionType, string> = {
  general_information: 'General Information',
  financial_information: 'Financial Information',
  eligibility_criteria: 'Eligibility Criteria',
  technical_requirements: 'Technical Requirements',
  important_dates: 'Important Dates',
  scope_of_work: 'Scope of Work',
  required_documents: 'Required Documents',
  annexures: 'Annexures',
};

function pagesForTypes(map: DocumentMap, types: ConsultantSectionType[]): number[] {
  const pages = new Set<number>();
  for (const [pageStr, sectionTypes] of Object.entries(map.pageSections)) {
    const pageNum = Number(pageStr);
    for (const st of sectionTypes) {
      const consultant = TYPE_MAP[st as DocumentSectionType];
      if (consultant && types.includes(consultant)) pages.add(pageNum);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

class DocumentUnderstandingService {
  /**
   * Step 1 — Classify document into consultant sections (rule-based, no AI extraction).
   */
  understand(pages: PageText[], existingMap?: DocumentMap): ConsultantDocumentUnderstanding {
    const documentMap = existingMap ?? documentMapBuilder.build(pages);
    const byType = new Map<ConsultantSectionType, { start: number; end: number; conf: number }>();

    for (const section of documentMap.sections) {
      const consultantType = TYPE_MAP[section.type];
      if (!consultantType) continue;
      const cur = byType.get(consultantType);
      if (!cur) {
        byType.set(consultantType, {
          start: section.startPage,
          end: section.endPage,
          conf: section.confidence,
        });
      } else {
        cur.start = Math.min(cur.start, section.startPage);
        cur.end = Math.max(cur.end, section.endPage);
        cur.conf = Math.max(cur.conf, section.confidence);
      }
    }

    if (!byType.has('required_documents') && documentMap.annexurePages.length) {
      byType.set('annexures', {
        start: Math.min(...documentMap.annexurePages),
        end: Math.max(...documentMap.annexurePages),
        conf: 0.75,
      });
    }

    const sections: ConsultantSection[] = [];
    for (const [type, range] of byType.entries()) {
      sections.push({
        type,
        label: LABELS[type],
        startPage: range.start,
        endPage: range.end,
        confidence: range.conf,
      });
    }

    sections.sort((a, b) => a.startPage - b.startPage);

    const pagesBySection: Partial<Record<ConsultantSectionType, number[]>> = {
      general_information: pagesForTypes(documentMap, ['general_information']),
      financial_information: pagesForTypes(documentMap, ['financial_information']),
      eligibility_criteria: pagesForTypes(documentMap, ['eligibility_criteria']),
      technical_requirements: pagesForTypes(documentMap, ['technical_requirements']),
      important_dates: pagesForTypes(documentMap, ['important_dates']),
      scope_of_work: pagesForTypes(documentMap, ['scope_of_work']),
      required_documents: pagesForTypes(documentMap, ['required_documents', 'annexures']),
      annexures: documentMap.annexurePages,
    };

    return {
      sections,
      documentMap,
      pageCount: pages.length,
      pagesBySection,
    };
  }
}

export const documentUnderstandingService = new DocumentUnderstandingService();
