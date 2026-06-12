import { MasterParameterRegistryEntry } from '../types/foundationLayer';
import { MASTER_TENDER_PARAMETER_DICTIONARY } from '../services/tenderParameter/masterTenderParameterDictionary';
import { TENDER_PARAMETER_ALIAS_CATALOG } from '../services/tenderParameter/tenderParameterAliasCatalog';

/** Part 3 — Core parameters from master dictionary. */
function buildCoreRegistry(): MasterParameterRegistryEntry[] {
  return MASTER_TENDER_PARAMETER_DICTIONARY.map((def) => {
    const aliasDef = TENDER_PARAMETER_ALIAS_CATALOG.find((a) => a.canonicalKey === def.canonicalKey);
    const valueType =
      def.group === 'Financial' || def.canonicalKey === 'turnoverRequirement'
        ? 'currency'
        : def.group === 'Timeline' && def.canonicalKey.includes('Date')
          ? 'date'
          : def.canonicalKey === 'completionPeriod' || def.canonicalKey === 'contractPeriod'
            ? 'period'
            : def.canonicalKey === 'bgRequired' ||
                def.canonicalKey === 'mafRequired' ||
                def.canonicalKey === 'reverseAuction'
              ? 'boolean'
              : 'text';

    return {
      name: def.canonical,
      canonicalKey: def.canonicalKey,
      type: 'core',
      category: def.group,
      valueType,
      aliases: aliasDef?.aliases ?? [],
      sourcePriority: 1,
    };
  });
}

/** Part 3 — Dynamic parameters (unlimited, data-driven). */
export const DYNAMIC_PARAMETER_REGISTRY: MasterParameterRegistryEntry[] = [
  { name: 'PSARA License', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'text', aliases: ['psara licence', 'psara registration'], serviceCategories: ['Security Services'], sourcePriority: 2 },
  { name: 'OEM Authorization', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'text', aliases: ['oem authorisation', 'manufacturer authorization', 'maf'], serviceCategories: ['Supply Tenders', 'IT Services'], sourcePriority: 2 },
  { name: 'MAF Requirement', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'text', aliases: ['manufacturer authorization form'], sourcePriority: 2 },
  { name: 'Drone Surveillance Requirement', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'text', aliases: ['drone surveillance', 'uav surveillance'], serviceCategories: ['Security Services'], sourcePriority: 2 },
  { name: 'Warranty Period', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'period', aliases: ['warranty', 'guarantee period'], sourcePriority: 2 },
  { name: 'Defect Liability Period', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'period', aliases: ['dlp', 'defect liability'], serviceCategories: ['Civil Works'], sourcePriority: 2 },
  { name: 'AMC Duration', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'period', aliases: ['amc period', 'maintenance period'], sourcePriority: 2 },
  { name: 'Response Time SLA', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'text', aliases: ['sla', 'response time', 'service level agreement'], serviceCategories: ['Facility Management', 'IT Services'], sourcePriority: 2 },
  { name: 'Cloud Certification', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'text', aliases: ['cloud cert', 'iso 27001'], serviceCategories: ['IT Services'], sourcePriority: 2 },
  { name: 'Data Center Requirement', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'text', aliases: ['data centre', 'dc requirement'], serviceCategories: ['IT Services'], sourcePriority: 2 },
  { name: 'Vehicle Requirement', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'count', aliases: ['vehicle', 'fleet requirement', 'no of vehicles'], serviceCategories: ['Transportation'], sourcePriority: 2 },
  { name: 'Fuel Requirement', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'text', aliases: ['fuel', 'diesel requirement'], serviceCategories: ['Transportation'], sourcePriority: 2 },
  { name: 'Machinery Requirement', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'text', aliases: ['machinery', 'equipment requirement'], serviceCategories: ['Mechanical Works', 'Civil Works'], sourcePriority: 2 },
  { name: 'Concrete Grade', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'text', aliases: ['grade of concrete', 'm25', 'm30'], serviceCategories: ['Civil Works'], sourcePriority: 2 },
  { name: 'Gardener Count', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'count', aliases: ['no of gardeners', 'gardener'], serviceCategories: ['Horticulture'], sourcePriority: 2 },
  { name: 'Security Guard Count', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'count', aliases: ['no of guards', 'security personnel'], serviceCategories: ['Security Services'], sourcePriority: 2 },
  { name: 'Housekeeping Staff Count', type: 'dynamic', category: 'Additional Tender Parameters', valueType: 'count', aliases: ['housekeeping staff', 'cleaning staff'], serviceCategories: ['Housekeeping Services'], sourcePriority: 2 },
];

export const CORE_PARAMETER_REGISTRY = buildCoreRegistry();

export const MASTER_PARAMETER_REGISTRY: MasterParameterRegistryEntry[] = [
  ...CORE_PARAMETER_REGISTRY,
  ...DYNAMIC_PARAMETER_REGISTRY,
];

export function getCoreParameters(): MasterParameterRegistryEntry[] {
  return CORE_PARAMETER_REGISTRY;
}

export function getDynamicParameters(serviceCategory?: string): MasterParameterRegistryEntry[] {
  if (!serviceCategory) return DYNAMIC_PARAMETER_REGISTRY;
  return DYNAMIC_PARAMETER_REGISTRY.filter(
    (p) => !p.serviceCategories?.length || p.serviceCategories.some((c) => c === serviceCategory)
  );
}
