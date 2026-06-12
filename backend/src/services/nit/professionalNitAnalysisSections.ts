/** Dynamic tender-specific parameters discovered beyond the master dictionary. */
export const ADDITIONAL_TENDER_PARAMETERS_CATEGORY = 'Additional Tender Parameters' as const;

/** Core NIT display groups including business-relevant dynamic categories. */
export const PROFESSIONAL_NIT_DISPLAY_CATEGORIES = [
  'Identity',
  'Financial',
  'Timeline',
  'Eligibility',
  'Compliance',
  'Experience',
  'Scope',
  'Technical',
  'Tender Specific',
] as const;

export const DYNAMIC_NIT_DISPLAY_CATEGORIES = [
  ...PROFESSIONAL_NIT_DISPLAY_CATEGORIES,
  ADDITIONAL_TENDER_PARAMETERS_CATEGORY,
] as const;

export const PROFESSIONAL_NIT_CATEGORY_ORDER = [
  ...PROFESSIONAL_NIT_DISPLAY_CATEGORIES,
  ADDITIONAL_TENDER_PARAMETERS_CATEGORY,
  'Risk',
] as const;

export type ProfessionalNitCategory = (typeof PROFESSIONAL_NIT_CATEGORY_ORDER)[number];
export type NitDisplayCategory = (typeof DYNAMIC_NIT_DISPLAY_CATEGORIES)[number];

export const PROFESSIONAL_NIT_SECTION_META: Record<
  ProfessionalNitCategory,
  { id: string; title: string; intelligenceLabel: string; description: string }
> = {
  Identity: {
    id: 'identity',
    title: 'Identity',
    intelligenceLabel: 'Tender Intelligence',
    description: 'Tender number, organization, department, work title, and location.',
  },
  Financial: {
    id: 'financial',
    title: 'Financial',
    intelligenceLabel: 'Financial Intelligence',
    description: 'Tender value, EMD, fees, performance security, and bank guarantees.',
  },
  Timeline: {
    id: 'timeline',
    title: 'Timeline',
    intelligenceLabel: 'Timeline Intelligence',
    description: 'Publishing, pre-bid, submission, opening dates, and contract period.',
  },
  Eligibility: {
    id: 'eligibility',
    title: 'Eligibility',
    intelligenceLabel: 'Eligibility Intelligence',
    description: 'Turnover, experience, net worth, and bid capacity requirements.',
  },
  Compliance: {
    id: 'compliance',
    title: 'Compliance',
    intelligenceLabel: 'Compliance Intelligence',
    description: 'GST, PAN, MSME, PF, ESIC, ISO, labour license, and bank solvency.',
  },
  Experience: {
    id: 'experience',
    title: 'Experience',
    intelligenceLabel: 'Experience Intelligence',
    description: 'Work orders, completion certificates, and client references.',
  },
  Scope: {
    id: 'scope',
    title: 'Scope',
    intelligenceLabel: 'Scope Intelligence',
    description: 'Scope of work, deployment, manpower, and service delivery requirements.',
  },
  Technical: {
    id: 'technical',
    title: 'Technical',
    intelligenceLabel: 'Technical Intelligence',
    description: 'Technical specifications, materials, equipment ratings, and performance standards.',
  },
  'Tender Specific': {
    id: 'tender_specific',
    title: 'Tender Specific',
    intelligenceLabel: 'Tender Specific Intelligence',
    description: 'BG, MAF, reverse auction, and other tender-specific requirements.',
  },
  [ADDITIONAL_TENDER_PARAMETERS_CATEGORY]: {
    id: 'additional_tender_parameters',
    title: ADDITIONAL_TENDER_PARAMETERS_CATEGORY,
    intelligenceLabel: 'Dynamic Tender Intelligence',
    description:
      'All validated dynamic parameters — PSARA, OEM authorization, SLA, warranty, manpower counts, and future tender-specific fields.',
  },
  Risk: {
    id: 'risk',
    title: 'Risk',
    intelligenceLabel: 'Risk Intelligence',
    description: 'Risk assessment derived from validated tender parameters.',
  },
};
