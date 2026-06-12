import { RequirementKnowledgeEntry } from '../types/foundationLayer';
import { TenderServiceCategory } from '../types/tenderServiceClassification';
import { REQUIREMENT_DISCOVERY_CATALOG } from '../services/requirementDiscovery/requirementDiscoveryCatalog';

/**
 * Part 7 — Requirement Knowledge Base.
 * Company, Financial, Experience, Compliance, Tender, Legal documents.
 */
export function buildRequirementKnowledgeBase(): RequirementKnowledgeEntry[] {
  const entries: RequirementKnowledgeEntry[] = [];

  for (const cat of REQUIREMENT_DISCOVERY_CATALOG) {
    for (const item of cat.items) {
      entries.push({
        id: item.id,
        name: item.name,
        category: cat.title,
        keywords: item.keywords,
        serviceCategories: item.serviceCategories as TenderServiceCategory[] | undefined,
        mandatory: false,
      });
    }
  }

  const tenderDocuments: RequirementKnowledgeEntry[] = [
    { id: 'technical_bid', name: 'Technical Bid', category: 'Tender Documents', keywords: ['technical bid', 'technical proposal'], mandatory: true },
    { id: 'financial_bid', name: 'Financial Bid', category: 'Tender Documents', keywords: ['financial bid', 'price bid', 'commercial bid'], mandatory: true },
    { id: 'emd_receipt', name: 'EMD Receipt', category: 'Tender Documents', keywords: ['emd receipt', 'bid security receipt'], mandatory: true },
    { id: 'tender_fee', name: 'Tender Fee Receipt', category: 'Tender Documents', keywords: ['tender fee', 'document fee'], mandatory: false },
    { id: 'integrity_pact', name: 'Integrity Pact', category: 'Tender Documents', keywords: ['integrity pact'], mandatory: false },
  ];

  const complianceDocuments: RequirementKnowledgeEntry[] = [
    { id: 'gst_reg', name: 'GST Registration', category: 'Compliance Documents', keywords: ['gst registration', 'gstin'], mandatory: true },
    { id: 'pan_card', name: 'PAN Card', category: 'Compliance Documents', keywords: ['pan card', 'permanent account number'], mandatory: true },
    { id: 'pf_reg', name: 'PF Registration', category: 'Compliance Documents', keywords: ['pf registration', 'epf'], mandatory: false },
    { id: 'esic_reg', name: 'ESIC Registration', category: 'Compliance Documents', keywords: ['esic registration', 'esi'], mandatory: false },
    { id: 'labour_license', name: 'Labour License', category: 'Compliance Documents', keywords: ['labour license', 'shop act'], mandatory: false },
  ];

  return [...entries, ...tenderDocuments, ...complianceDocuments];
}

export const REQUIREMENT_KNOWLEDGE_BASE = buildRequirementKnowledgeBase();

export function formatRequirementKnowledgeForPrompt(): string {
  const byCategory = new Map<string, RequirementKnowledgeEntry[]>();
  for (const r of REQUIREMENT_KNOWLEDGE_BASE) {
    const list = byCategory.get(r.category) || [];
    list.push(r);
    byCategory.set(r.category, list);
  }

  const lines: string[] = [];
  for (const [cat, items] of byCategory) {
    lines.push(`${cat}: ${items.map((i) => i.name).join(', ')}`);
  }
  return lines.join('\n');
}
