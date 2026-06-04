/**
 * Per-field context rules for verification — reject values from wrong sections/clauses.
 */

export interface FieldContextRuleSet {
  /** Heading/section phrases that strengthen acceptance. */
  acceptHeadings: RegExp[];
  /** Surrounding text that confirms the value belongs to this field. */
  acceptContext: RegExp[];
  /** Surrounding text that disqualifies the candidate (wrong clause). */
  rejectContext: RegExp[];
  /** Value shape rejects (e.g. "15 days" for contract duration in bid-validity context). */
  rejectValue?: RegExp[];
  /** Preferred page section tags (from documentPageContext). */
  preferredSections?: string[];
}

export const FIELD_CONTEXT_RULES: Record<string, FieldContextRuleSet> = {
  contractDuration: {
    acceptHeadings: [
      /notice\s+inviting\s+tender/i,
      /nit\b/i,
      /scope\s+of\s+(?:work|contract)/i,
      /contract\s+period/i,
      /period\s+of\s+(?:completion|contract)/i,
      /duration\s+of\s+(?:contract|work)/i,
    ],
    acceptContext: [
      /contract\s+(?:period|duration)/i,
      /period\s+of\s+(?:completion|contract)/i,
      /duration\s+of\s+(?:the\s+)?contract/i,
      /for\s+a\s+period\s+of/i,
      /contract\s+basis/i,
      /engagement\s+period/i,
      /validity\s+of\s+(?:the\s+)?contract/i,
      /(?:two|three|four|five|\d+)\s*\(?\d*\)?\s*(?:years?|months?)/i,
    ],
    rejectContext: [
      /award\s+of\s+contract/i,
      /execution\s+of\s+(?:the\s+)?agreement/i,
      /sign(?:ing|ed)\s+(?:of\s+)?(?:the\s+)?(?:contract|agreement)/i,
      /within\s+\d+\s*days?\s+(?:from|of)\s+(?:date\s+of|signing|award)/i,
      /bid\s+valid(?:ity)?/i,
      /tender\s+valid(?:ity)?/i,
      /submission\s+within/i,
      /acceptance\s+within/i,
      /performance\s+(?:security|guarantee)/i,
      /earnest\s+money/i,
      /defect\s+liability/i,
      /warranty\s+period/i,
    ],
    rejectValue: [/^\d{1,2}\s*days?$/i],
    preferredSections: ['timeline', 'main'],
  },
  emdAmount: {
    acceptHeadings: [/financial/i, /instruction\s+to\s+bidder/i, /earnest/i, /emd/i],
    acceptContext: [
      /earnest\s+money/i,
      /\bemd\b/i,
      /bid\s+security/i,
      /tender\s+security/i,
    ],
    rejectContext: [
      /performance\s+security/i,
      /performance\s+guarantee/i,
      /tender\s+fee/i,
      /document\s+fee/i,
      /turnover/i,
      /annual\s+turnover/i,
      /contract\s+value/i,
      /estimated\s+(?:cost|value)/i,
    ],
    preferredSections: ['financial'],
  },
  tenderFee: {
    acceptHeadings: [/tender\s+fee/i, /cost\s+of\s+tender/i, /document\s+fee/i],
    acceptContext: [/tender\s+fee/i, /cost\s+of\s+(?:tender\s+)?document/i, /non-?refundable\s+fee/i],
    rejectContext: [/earnest\s+money/i, /\bemd\b/i, /performance\s+security/i, /turnover/i],
    preferredSections: ['financial'],
  },
  performanceSecurity: {
    acceptHeadings: [/performance\s+security/i, /performance\s+guarantee/i, /security\s+deposit/i],
    acceptContext: [/performance\s+security/i, /performance\s+guarantee/i, /contract\s+performance/i],
    rejectContext: [/earnest\s+money/i, /\bemd\b/i, /tender\s+fee/i, /bid\s+valid/i],
    preferredSections: ['financial'],
  },
  bankGuarantee: {
    acceptHeadings: [/bank\s+guarantee/i, /\bpbg\b/i],
    acceptContext: [/bank\s+guarantee/i, /performance\s+bank\s+guarantee/i, /\bpbg\b/i],
    rejectContext: [/earnest\s+money/i, /tender\s+fee/i],
    preferredSections: ['financial'],
  },
  estimatedTenderValue: {
    acceptHeadings: [/estimated/i, /tender\s+value/i, /cost\s+of\s+work/i],
    acceptContext: [
      /estimated\s+(?:contract\s+)?value/i,
      /tender\s+value/i,
      /cost\s+of\s+work/i,
      /approximate\s+value/i,
    ],
    rejectContext: [/turnover/i, /earnest\s+money/i, /emd/i, /tender\s+fee/i],
    preferredSections: ['financial'],
  },
  bidOpeningDate: {
    acceptHeadings: [/important\s+dates/i, /bid\s+schedule/i],
    acceptContext: [/bid\s+opening/i, /opening\s+of\s+(?:technical|financial)\s+bid/i],
    rejectContext: [/submission\s+date/i, /last\s+date\s+for\s+submission/i],
    preferredSections: ['timeline'],
  },
  preBidMeetingDate: {
    acceptHeadings: [/pre-?bid/i, /important\s+dates/i],
    acceptContext: [/pre-?bid\s+meeting/i, /pre-?bid\s+conference/i],
    rejectContext: [/submission/i, /opening/i],
    preferredSections: ['timeline'],
  },
  bidSecurityAmount: {
    acceptHeadings: [/financial/i, /bid\s+security/i],
    acceptContext: [/bid\s+security/i, /tender\s+security/i],
    rejectContext: [/performance\s+security/i, /earnest\s+money/i, /\bemd\b/i],
    preferredSections: ['financial'],
  },
  bidSubmissionDate: {
    acceptHeadings: [/important\s+dates/i, /date\s+schedule/i, /submission/i],
    acceptContext: [
      /last\s+date/i,
      /bid\s+submission/i,
      /due\s+date/i,
      /closing\s+date/i,
      /submission\s+deadline/i,
    ],
    rejectContext: [/opening\s+date/i, /pre-?bid/i, /publish/i, /signing/i],
    preferredSections: ['timeline'],
  },
  workLocation: {
    acceptHeadings: [/place\s+of\s+work/i, /work\s+location/i, /site/i, /location/i],
    acceptContext: [
      /work\s+location/i,
      /place\s+of\s+(?:work|service)/i,
      /project\s+location/i,
      /site\s+location/i,
      /location\s+of\s+(?:work|service)/i,
    ],
    rejectContext: [
      /mode\s+of\s+submission/i,
      /online\s+submission/i,
      /registered\s+office/i,
      /correspondence\s+address/i,
    ],
    preferredSections: ['main', 'general'],
  },
  submissionMode: {
    acceptHeadings: [/submission/i, /e-?tender/i, /portal/i, /bidding/i],
    acceptContext: [
      /mode\s+of\s+submission/i,
      /online\s+(?:bid|submission|tender)/i,
      /electronic\s+submission/i,
      /e-?tender/i,
      /nic\s+portal/i,
      /gem\s+portal/i,
    ],
    rejectContext: [
      /work\s+location/i,
      /place\s+of\s+work/i,
      /site\s+of/i,
      /technical\s+requirement/i,
      /technical\s+specification/i,
      /cctv/i,
      /camera/i,
      /supply\s+of/i,
      /scope\s+of\s+work/i,
      /equipment/i,
    ],
    rejectValue: [/technical\s+requirement/i, /cctv/i, /specification/i, /camera/i],
    preferredSections: ['main'],
  },
  turnoverRequirements: {
    acceptHeadings: [/eligibility/i, /qualification/i, /financial\s+capacity/i],
    acceptContext: [/turnover/i, /annual\s+turnover/i, /average\s+turnover/i, /revenue/i],
    rejectContext: [/tender\s+value/i, /estimated\s+value/i, /emd/i, /experience\s+only/i],
    preferredSections: ['eligibility', 'financial'],
  },
  experienceRequirements: {
    acceptHeadings: [/eligibility/i, /qualification/i, /experience/i, /technical/i],
    acceptContext: [
      /experience/i,
      /similar\s+(?:work|nature)/i,
      /completed\s+(?:work|projects)/i,
      /past\s+performance/i,
    ],
    rejectContext: [/turnover/i, /annual\s+turnover/i, /tender\s+fee/i],
    preferredSections: ['eligibility', 'technical'],
  },
  tenderName: {
    acceptHeadings: [/notice\s+inviting/i, /nit\b/i, /tender\s+for/i, /name\s+of\s+work/i],
    acceptContext: [/name\s+of\s+(?:work|tender)/i, /tender\s+for/i, /invitation\s+for/i],
    rejectContext: [/the bidder shall/i, /hereinafter/i, /terms\s+and\s+conditions/i],
    preferredSections: ['main'],
  },
  tenderNumber: {
    acceptHeadings: [/nit\b/i, /tender\s+no/i, /reference/i],
    acceptContext: [/tender\s*(?:no|number|id)/i, /nit\s*(?:no|number)/i, /e-?tender\s*(?:no|id)/i],
    rejectContext: [/page\s+no/i, /serial\s+no/i, /item\s+no/i],
    preferredSections: ['main'],
  },
  gstRequirement: {
    acceptHeadings: [/statutory/i, /eligibility/i, /registration/i],
    acceptContext: [/\bgst\b/i, /gstin/i, /goods\s+and\s+services\s+tax/i],
    rejectContext: [/turnover/i, /experience/i],
    preferredSections: ['eligibility', 'compliance'],
  },
  epfRequirement: {
    acceptHeadings: [/statutory/i, /eligibility/i],
    acceptContext: [/\bepf\b/i, /provident\s+fund/i],
    rejectContext: [/esi\s+only/i],
    preferredSections: ['eligibility', 'compliance'],
  },
  esiRequirement: {
    acceptHeadings: [/statutory/i, /eligibility/i],
    acceptContext: [/\besi\b/i, /employees?\s+state\s+insurance/i],
    rejectContext: [/epf\s+only/i],
    preferredSections: ['eligibility', 'compliance'],
  },
  labourLicense: {
    acceptHeadings: [/statutory/i, /license/i, /labour/i],
    acceptContext: [/labou?r\s+license/i, /contract\s+labou?r/i],
    rejectContext: [/experience/i, /turnover/i],
    preferredSections: ['eligibility', 'compliance'],
  },
  scopeOfWork: {
    acceptHeadings: [/scope/i, /nature\s+of\s+work/i, /description\s+of\s+work/i],
    acceptContext: [/scope\s+of\s+work/i, /nature\s+of\s+work/i, /description\s+of\s+(?:work|services)/i],
    rejectContext: [/the bidder shall/i, /penalty/i, /disqualification/i],
    preferredSections: ['main', 'technical'],
  },
  requiredDocuments: {
    acceptHeadings: [/document/i, /enclosure/i, /checklist/i, /annexure/i],
    acceptContext: [/required\s+documents/i, /documents?\s+to\s+be\s+submitted/i, /enclosures?/i],
    rejectContext: [/technical\s+specification\s+only/i],
    preferredSections: ['documents', 'annexure'],
  },
  technicalRequirements: {
    acceptHeadings: [/technical/i, /specification/i],
    acceptContext: [/technical\s+(?:requirement|specification)/i, /schedule\s+of\s+work/i],
    rejectContext: [/financial\s+requirement/i, /turnover/i],
    preferredSections: ['technical'],
  },
  financialRequirements: {
    acceptHeadings: [/financial/i, /qualification/i],
    acceptContext: [/financial\s+(?:requirement|criteria|qualification)/i],
    rejectContext: [/technical\s+specification/i],
    preferredSections: ['financial', 'eligibility'],
  },
  complianceRequirements: {
    acceptHeadings: [/compliance/i, /statutory/i, /legal/i],
    acceptContext: [/compliance/i, /statutory\s+requirement/i, /legal\s+requirement/i],
    rejectContext: [/scope\s+of\s+work/i],
    preferredSections: ['compliance', 'eligibility'],
  },
};

export const DEFAULT_CONTEXT_RULE: FieldContextRuleSet = {
  acceptHeadings: [],
  acceptContext: [],
  rejectContext: [
    /the bidder shall/i,
    /the tenderer shall/i,
    /hereinafter/i,
    /notwithstanding/i,
    /shall\s+not\s+be\s+responsible/i,
  ],
  rejectValue: [],
};

export function getContextRules(fieldId: string): FieldContextRuleSet {
  return FIELD_CONTEXT_RULES[fieldId] || DEFAULT_CONTEXT_RULE;
}
