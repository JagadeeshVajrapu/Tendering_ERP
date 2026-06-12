import { ServiceCategoryRegistryEntry } from '../types/foundationLayer';
import { TenderServiceCategory } from '../types/tenderServiceClassification';

/**
 * Part 2 — Service Classification Registry.
 * Data-driven: add categories/keywords here without code changes.
 */
export const SERVICE_CATEGORY_REGISTRY: ServiceCategoryRegistryEntry[] = [
  {
    category: 'Security Services',
    keywords: [
      'security guard', 'armed guard', 'unarmed guard', 'watch and ward', 'psara',
      'cctv', 'access control', 'security services', 'security agency', 'patrolling', 'surveillance',
    ],
    typicalDynamicParameters: ['PSARA License', 'Security Guard Count', 'Drone Surveillance Requirement'],
  },
  {
    category: 'Manpower Services',
    keywords: [
      'manpower', 'labour supply', 'contract labour', 'skilled labour', 'unskilled labour',
      'driver', 'operator', 'helper', 'technician', 'workforce deployment',
    ],
    typicalDynamicParameters: ['Housekeeping Staff Count', 'Supervisor Count'],
  },
  {
    category: 'Housekeeping Services',
    keywords: [
      'housekeeping', 'cleaning', 'sanitation', 'janitorial', 'waste management', 'deep cleaning',
    ],
    typicalDynamicParameters: ['Housekeeping Staff Count', 'Cleaning Material Requirement'],
  },
  {
    category: 'Facility Management',
    keywords: [
      'facility management', 'building maintenance', 'operations and maintenance', 'o&m',
      'estate management', 'integrated facility', 'fm services',
    ],
    typicalDynamicParameters: ['AMC Duration', 'Response Time SLA'],
  },
  {
    category: 'Horticulture',
    keywords: ['horticulture', 'landscaping', 'gardening', 'lawn maintenance', 'green belt', 'nursery'],
    typicalDynamicParameters: ['Gardener Count', 'Plantation Requirement'],
  },
  {
    category: 'Civil Works',
    keywords: ['civil works', 'construction', 'building work', 'structural work', 'road work', 'cpwd'],
    typicalDynamicParameters: ['Concrete Grade', 'Defect Liability Period'],
  },
  {
    category: 'Electrical Works',
    keywords: ['electrical works', 'wiring', 'substation', 'transformer', 'lt panel', 'electrical installation'],
    typicalDynamicParameters: ['Load Requirement', 'Transformer Capacity'],
  },
  {
    category: 'Mechanical Works',
    keywords: ['mechanical works', 'fabrication', 'erection', 'piping', 'mechanical installation', 'hvac'],
    typicalDynamicParameters: ['Machinery Requirement', 'Equipment Specification'],
  },
  {
    category: 'IT Services',
    keywords: [
      'it services', 'software', 'hardware', 'network', 'cloud', 'erp', 'data center', 'system integration',
    ],
    typicalDynamicParameters: ['Cloud Certification', 'Data Center Requirement', 'SLA Uptime'],
  },
  {
    category: 'Supply Tenders',
    keywords: ['supply of', 'procurement of', 'purchase of', 'rate contract', 'goods supply', 'material supply'],
    typicalDynamicParameters: ['OEM Authorization', 'Make and Model', 'Delivery Period'],
  },
  {
    category: 'Consultancy',
    keywords: ['consultancy', 'consulting', 'advisory', 'feasibility study', 'project management consultant'],
    typicalDynamicParameters: ['Consultant Qualification', 'Key Personnel CV'],
  },
  {
    category: 'Healthcare',
    keywords: ['hospital', 'medical', 'healthcare', 'diagnostic', 'pharmacy', 'biomedical'],
    typicalDynamicParameters: ['Medical Equipment Specification', 'Bio Medical Waste Handling'],
  },
  {
    category: 'Education',
    keywords: ['school', 'college', 'education', 'training', 'academic', 'e-learning'],
    typicalDynamicParameters: ['Faculty Requirement', 'Course Content'],
  },
  {
    category: 'Transportation',
    keywords: ['transport', 'vehicle hire', 'logistics', 'fleet', 'bus service', 'railways'],
    typicalDynamicParameters: ['Vehicle Requirement', 'Fuel Requirement', 'Fleet Size'],
  },
  {
    category: 'Mixed Services',
    keywords: ['composite bid', 'multiple services', 'combined tender', 'integrated services', 'turnkey'],
    typicalDynamicParameters: [],
  },
];

export const TENDER_CONCEPTS = [
  { id: 'gem', label: 'GeM Portal', keywords: ['gem', 'government e marketplace', 'eprocurement gem'] },
  { id: 'cpwd', label: 'CPWD', keywords: ['cpwd', 'central public works department'] },
  { id: 'railways', label: 'Railways', keywords: ['railway', 'indian railways', 'irctc', 'rly'] },
  { id: 'psu', label: 'PSU', keywords: ['psu', 'public sector undertaking', 'maharatna', 'navratna'] },
  { id: 'private', label: 'Private Sector', keywords: ['private limited', 'ltd company', 'corporate tender'] },
  { id: 'nit', label: 'NIT', keywords: ['notice inviting tender', 'nit', 'tender notice'] },
  { id: 'emd', label: 'EMD', keywords: ['emd', 'earnest money', 'bid security'] },
  { id: 'maf', label: 'MAF', keywords: ['manufacturer authorization', 'maf', 'oem authorization'] },
];

export const TENDER_TERMINOLOGY: Array<{ term: string; meaning: string; aliases?: string[] }> = [
  { term: 'EMD', meaning: 'Earnest Money Deposit — bid security amount', aliases: ['Bid Security', 'Earnest Money'] },
  { term: 'NIT', meaning: 'Notice Inviting Tender', aliases: ['Tender Notice', 'Invitation to Bid'] },
  { term: 'GeM', meaning: 'Government e-Marketplace procurement portal' },
  { term: 'CPWD', meaning: 'Central Public Works Department' },
  { term: 'PSARA', meaning: 'Private Security Agencies Regulation Act license' },
  { term: 'MAF', meaning: 'Manufacturer Authorization Form', aliases: ['OEM Authorization'] },
  { term: 'PBG', meaning: 'Performance Bank Guarantee', aliases: ['Performance Security'] },
  { term: 'RA', meaning: 'Reverse Auction', aliases: ['Reverse Bidding'] },
];

export const SUPPORTED_FOUNDATION_CATEGORIES: TenderServiceCategory[] =
  SERVICE_CATEGORY_REGISTRY.map((e) => e.category);

export function getServiceCategoryEntry(
  category: TenderServiceCategory
): ServiceCategoryRegistryEntry | undefined {
  return SERVICE_CATEGORY_REGISTRY.find((e) => e.category === category);
}
