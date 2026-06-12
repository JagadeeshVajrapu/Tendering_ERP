import { RequirementCategoryDefinition } from '../../types/requirementDiscovery';

export const REQUIREMENT_DISCOVERY_CATALOG: RequirementCategoryDefinition[] = [
  {
    id: 'company_documents',
    title: 'Company Documents',
    items: [
      { id: 'moa', name: 'MOA', keywords: ['memorandum of association', 'moa'] },
      { id: 'aoa', name: 'AOA', keywords: ['articles of association', 'aoa'] },
      { id: 'gst', name: 'GST', keywords: ['gst certificate', 'gst registration', 'gstin'] },
      { id: 'cin', name: 'CIN', keywords: ['cin', 'corporate identity number'] },
      { id: 'msme', name: 'MSME', keywords: ['msme', 'udyam', 'udyog aadhaar'] },
      { id: 'iso', name: 'ISO', keywords: ['iso certificate', 'iso 9001', 'iso certification'] },
      { id: 'pf', name: 'PF', keywords: ['pf registration', 'epf', 'provident fund'] },
      { id: 'esic', name: 'ESIC', keywords: ['esic', 'esi registration', 'employees state insurance'] },
    ],
  },
  {
    id: 'financial_documents',
    title: 'Financial Documents',
    items: [
      { id: 'itr', name: 'ITR', keywords: ['income tax return', 'itr', 'acknowledgement of itr'] },
      { id: 'balance_sheet', name: 'Balance Sheet', keywords: ['balance sheet', 'audited balance sheet'] },
      { id: 'pl', name: 'P&L', keywords: ['profit and loss', 'p&l', 'profit & loss statement'] },
      {
        id: 'turnover_certificate',
        name: 'Turnover Certificate',
        keywords: ['turnover certificate', 'ca certificate for turnover', 'annual turnover certificate'],
      },
      {
        id: 'bank_solvency',
        name: 'Bank Solvency',
        keywords: ['bank solvency', 'solvency certificate', 'financial solvency'],
      },
      { id: 'emd', name: 'EMD', keywords: ['emd', 'earnest money deposit', 'bid security'] },
      { id: 'bg', name: 'BG', keywords: ['bank guarantee', 'performance guarantee', 'bid bond'] },
    ],
  },
  {
    id: 'experience_documents',
    title: 'Experience Documents',
    items: [
      {
        id: 'security_experience',
        name: 'Security Experience',
        keywords: ['security experience', 'security services experience', 'similar security work'],
        serviceCategories: ['Security Services'],
      },
      {
        id: 'manpower_experience',
        name: 'Manpower Experience',
        keywords: ['manpower experience', 'labour supply experience', 'deployment experience'],
        serviceCategories: ['Manpower Services'],
      },
      {
        id: 'housekeeping_experience',
        name: 'Housekeeping Experience',
        keywords: ['housekeeping experience', 'cleaning services experience', 'janitorial experience'],
        serviceCategories: ['Housekeeping Services'],
      },
      {
        id: 'facility_management_experience',
        name: 'Facility Management Experience',
        keywords: ['facility management experience', 'fm experience', 'integrated facility services experience'],
        serviceCategories: ['Facility Management'],
      },
    ],
  },
  {
    id: 'legal_documents',
    title: 'Legal Documents',
    items: [
      { id: 'affidavit', name: 'Affidavit', keywords: ['affidavit', 'notarized affidavit'] },
      {
        id: 'non_blacklisting',
        name: 'Non Blacklisting',
        keywords: ['non blacklisting', 'not blacklisted', 'blacklisting declaration'],
      },
      {
        id: 'power_of_attorney',
        name: 'Power Of Attorney',
        keywords: ['power of attorney', 'poa'],
      },
      {
        id: 'authority_letter',
        name: 'Authority Letter',
        keywords: ['authority letter', 'authorization letter', 'signatory authority'],
      },
    ],
  },
];
