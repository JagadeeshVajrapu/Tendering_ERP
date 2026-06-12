import { DynamicChecklistCategoryDefinition } from '../../types/dynamicChecklist';
import { generateRecentFinancialYearsDescending, formatItrFyLabel } from './checklistFinancialYearUtils';

function complianceFyItems(prefix: string, label: string) {
  return generateRecentFinancialYearsDescending(5, 2021).map((fy) => ({
    id: `${prefix}_${fy.id}`,
    name: formatItrFyLabel(fy.startYear),
    keywords: [label.toLowerCase(), fy.label, formatItrFyLabel(fy.startYear).toLowerCase(), prefix, 'epf returns', 'esic returns'],
    defaultRequired: false,
  }));
}

/** Static catalog — state-wise GST/PF/ESIC, ISO, and ITR groups are injected by engines at build time. */
export const DYNAMIC_CHECKLIST_CATALOG: DynamicChecklistCategoryDefinition[] = [
  {
    id: 'company_documents',
    title: 'Company Basic Documents',
    items: [
      { id: 'moa', name: 'MOA', keywords: ['moa', 'memorandum of association'], defaultRequired: false },
      { id: 'aoa', name: 'AOA', keywords: ['aoa', 'articles of association'], defaultRequired: false },
      { id: 'cin', name: 'CIN', keywords: ['cin', 'corporate identity'], defaultRequired: false, critical: true },
      { id: 'msme_certificate', name: 'MSME', keywords: ['msme', 'udyam', 'msme certificate'], defaultRequired: false },
      {
        id: 'shop_establishment',
        name: 'Shop & Establishment License',
        keywords: ['shop and establishment', 'shop & establishment'],
        defaultRequired: false,
      },
      { id: 'pan_company', name: 'PAN Company', keywords: ['company pan', 'pan card company'], defaultRequired: false, critical: true },
      { id: 'pan_director_1', name: 'PAN Director-1', keywords: ['director pan', 'director 1 pan', 'pan director'], defaultRequired: false },
      { id: 'pan_director_2', name: 'PAN Director-2', keywords: ['director 2 pan', 'second director pan'], defaultRequired: false },
    ],
  },
  {
    id: 'financial_documents',
    title: 'Financial Documents',
    items: [
      {
        id: 'balance_sheet',
        name: 'Balance Sheet (CA certified)',
        keywords: ['balance sheet', 'ca certified balance sheet'],
        defaultRequired: false,
        critical: true,
      },
      {
        id: 'pl_statement',
        name: 'Profit/Loss Statement (CA certified)',
        keywords: ['p&l', 'profit and loss', 'profit & loss', 'profit/loss', 'ca certified'],
        defaultRequired: false,
        critical: true,
      },
      {
        id: 'turnover_certificate',
        name: 'Turnover Certificate (CA certified)',
        keywords: ['turnover certificate', 'ca certified turnover'],
        defaultRequired: false,
        critical: true,
      },
      {
        id: 'bank_solvency',
        name: 'Bank Solvency Certificate (Bank Wise)',
        keywords: ['bank solvency', 'solvency certificate'],
        defaultRequired: false,
        critical: true,
      },
      {
        id: 'emd_proof',
        name: 'EMD (Earnest Money Deposit) – DD / Online / FDRI / BG',
        keywords: ['emd', 'earnest money', 'emd proof', 'demand draft', 'fdri', 'fdr'],
        defaultRequired: false,
        critical: true,
      },
      {
        id: 'tender_fee_receipt',
        name: 'Tender Fee Receipt',
        keywords: ['tender fee', 'document fee', 'tender fee receipt'],
        defaultRequired: false,
        critical: true,
      },
      {
        id: 'bank_guarantee',
        name: 'Bank Guarantee (BG)',
        keywords: ['bank guarantee', 'bg', 'bid bond'],
        defaultRequired: false,
        critical: true,
      },
    ],
  },
  {
    id: 'technical_documents',
    title: 'Technical Documents',
    subtitle: 'Experience, Work order & Completion Certificates',
    items: [
      { id: 'work_orders', name: 'Work Orders', keywords: ['work order', 'work orders'], defaultRequired: false, critical: true },
      {
        id: 'completion_certificates',
        name: 'Completion Certificates',
        keywords: ['completion certificate', 'work completion'],
        defaultRequired: false,
        critical: true,
      },
      {
        id: 'experience_certificates',
        name: 'Experience Certificates',
        keywords: ['experience certificate', 'work experience certificate'],
        defaultRequired: false,
      },
    ],
  },
  {
    id: 'compliance_documents',
    title: 'Compliances Documents',
    items: [
      { id: 'epf_header', name: 'EPF', keywords: ['epf', 'epf returns', 'provident fund'], defaultRequired: false },
      ...complianceFyItems('epf', 'EPF'),
      { id: 'esic_header', name: 'ESIC', keywords: ['esic', 'esi returns', 'esic returns'], defaultRequired: false },
      ...complianceFyItems('esic', 'ESIC'),
    ],
  },
  {
    id: 'tender_documents',
    title: 'Tender Specific Documents',
    items: [
      { id: 'nit_copy', name: 'NIT (Notice Inviting Tender)', keywords: ['nit', 'notice inviting tender'], defaultRequired: false, critical: true },
      { id: 'tender_document', name: 'Tender Document', keywords: ['tender document', 'bid document'], defaultRequired: false, critical: true },
      { id: 'boq', name: 'BOQ (Bill of Quantity)', keywords: ['boq', 'bill of quantities', 'bill of quantity'], defaultRequired: false },
      {
        id: 'technical_bid',
        name: 'Technical Bid Documents',
        keywords: ['technical bid', 'technical proposal', 'technical documents'],
        defaultRequired: false,
        critical: true,
      },
      {
        id: 'financial_bid',
        name: 'Financial Bid (Price Bid)',
        keywords: ['financial bid', 'price bid', 'commercial bid'],
        defaultRequired: false,
        critical: true,
      },
      {
        id: 'compliance_sheet',
        name: 'Compliance Sheet according to the T&C',
        keywords: ['compliance sheet', 'compliance matrix', 'compliance statement', 'terms and conditions'],
        defaultRequired: false,
      },
    ],
  },
  {
    id: 'legal_documents',
    title: 'Legal & Declaration Documents',
    items: [
      { id: 'affidavit', name: 'Affidavit (Notarized)', keywords: ['affidavit', 'notarized affidavit'], defaultRequired: false, critical: true },
      {
        id: 'non_blacklisting',
        name: 'Non-Blacklisting Certificate',
        keywords: ['non blacklisting', 'blacklisting declaration', 'non-blacklisting'],
        defaultRequired: false,
        critical: true,
      },
      { id: 'undertaking_letter', name: 'Undertaking Letter', keywords: ['undertaking', 'undertaking letter'], defaultRequired: false },
      {
        id: 'authorization_letter',
        name: 'Authorization Letter (Signatory)',
        keywords: ['authorization letter', 'authority letter', 'authorized signatory', 'signatory'],
        defaultRequired: false,
      },
      { id: 'power_of_attorney', name: 'Power of Attorney', keywords: ['power of attorney', 'poa'], defaultRequired: false },
    ],
  },
];

export const DYNAMIC_CHECKLIST_CATEGORY_ORDER = DYNAMIC_CHECKLIST_CATALOG.map((c) => c.id);
