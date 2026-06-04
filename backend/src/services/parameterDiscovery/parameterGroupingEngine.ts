import {
  DiscoveredParameter,
  PARAMETER_GROUP_ORDER,
  ParameterGroup,
} from '../../types/parameterDiscovery';
import { finalizeDiscoveredParameters } from './parameterExtractionValidator';

export { PARAMETER_GROUP_ORDER };

/** Legacy short categories → new display groups. */
const LEGACY_GROUP_MAP: Record<string, ParameterGroup> = {
  General: 'General Information',
  Financial: 'Financial Information',
  Dates: 'Important Dates',
  Eligibility: 'Eligibility Criteria',
  Technical: 'Technical Requirements',
  Compliance: 'Compliance Requirements',
  Contact: 'Contact Information',
  Location: 'General Information',
};

type GroupRule = { group: ParameterGroup; patterns: RegExp[]; weight?: number };

/**
 * Ordered rules: first match wins. More specific groups are listed before General.
 */
const GROUP_RULES: GroupRule[] = [
  {
    group: 'Financial Information',
    patterns: [
      /emd|earnest\s*money|earnest\s*deposit|bid\s*security|security\s*deposit/i,
      /estimated\s*(?:tender\s*)?value|tender\s*value|contract\s*value|project\s*cost/i,
      /tender\s*fee|processing\s*fee|document\s*fee|cost\s*of\s*tender/i,
      /turnover|annual\s*turnover|financial\s*capacity|net\s*worth/i,
      /(?:₹|rs\.?|inr)\b|amount|fee|budget|price|payment|gst\s*amount/i,
      /financial|bank\s*guarantee\s*amount|performance\s*security/i,
    ],
  },
  {
    group: 'Important Dates',
    patterns: [
      /publish\s*date|publication\s*date|issue\s*date|nit\s*date/i,
      /submission\s*date|last\s*date|bid\s*submission|due\s*date|deadline/i,
      /opening\s*date|bid\s*opening|technical\s*opening|financial\s*opening/i,
      /closing\s*date|end\s*date|expiry|validity|valid\s*upto|valid\s*up\s*to/i,
      /pre\s*bid|pre-bid|clarification\s*date|corrigendum/i,
      /\bdate\b|deadline|period\s*of\s*submission|time\s*schedule/i,
    ],
  },
  {
    group: 'Eligibility Criteria',
    patterns: [
      /eligib|qualification|experience|similar\s*work|past\s*performance/i,
      /criteria|requirement|minimum|mandatory\s*requirement/i,
      /oem|manufacturer|authorized\s*dealer|dealer\s*certificate/i,
      /registration|class\s*of\s*contractor|contractor\s*class/i,
      /msme|startup|small\s*enterprise|udyam/i,
      /pan\b|gstin|gst\s*no|income\s*tax/i,
    ],
  },
  {
    group: 'Technical Requirements',
    patterns: [
      /technical|scope\s*of\s*work|specification|spec\b|schedule\s*of\s*items/i,
      /manpower|resource|equipment|machinery|plant|material/i,
      /quantity|unit|nos\.|numbers|capacity|rating|output/i,
      /methodology|approach|deliverable|milestone|completion\s*period/i,
      /name\s*of\s*work|description\s*of\s*work|work\s*description/i,
    ],
  },
  {
    group: 'Compliance Requirements',
    patterns: [
      /compliance|statutory|labour\s*law|labour\s*license/i,
      /epf|esi|pf\b|provident|insurance|wc\s*policy|workmen/i,
      /iso\b|bis\b|certification|quality\s*assurance/i,
      /bg\b|bank\s*guarantee|performance\s*guarantee|security\s*instrument/i,
      /maf|manufacturer\s*authorization|reverse\s*auction/i,
      /affidavit|declaration|undertaking|integrity\s*pact/i,
      /blacklist|debarment|litigation|arbitration/i,
    ],
  },
  {
    group: 'Contact Information',
    patterns: [
      /contact|phone|mobile|telephone|fax|email|e-mail/i,
      /officer|engineer|authority|designation|person\s*responsible/i,
      /address\s*for\s*communication|communication\s*address/i,
      /website|portal|url|gepnic|eproc/i,
    ],
  },
  {
    group: 'General Information',
    patterns: [
      /tender\s*no|tender\s*number|nit\s*no|reference\s*no|bid\s*no/i,
      /tender\s*id|enquiry\s*no|rfp\s*no|e-tender\s*no/i,
      /tender\s*authority|issuing\s*authority|department|organization/i,
      /name\s*of\s*tender|title|subject|project\s*name/i,
      /location|site|place\s*of\s*work|city|state|pin\s*code|pincode/i,
      /type\s*of\s*tender|mode\s*of\s*tender|procurement\s*type/i,
      /division|zone|circle|region|unit/i,
    ],
  },
];

/** Classify a parameter name (and optional value) into a display group. */
export function classifyParameterGroup(
  parameterName: string,
  parameterValue?: string
): ParameterGroup {
  const text = `${parameterName} ${parameterValue ?? ''}`.trim();

  for (const { group, patterns } of GROUP_RULES) {
    if (patterns.some((p) => p.test(parameterName) || p.test(text))) {
      return group;
    }
  }

  return 'General Information';
}

/** Normalize stored category from DB (legacy or current). */
export function normalizeParameterGroup(stored: string): ParameterGroup {
  if (PARAMETER_GROUP_ORDER.includes(stored as ParameterGroup)) {
    return stored as ParameterGroup;
  }
  return LEGACY_GROUP_MAP[stored] ?? 'General Information';
}

export function emptyGroupedParameters(): Record<ParameterGroup, DiscoveredParameter[]> {
  return PARAMETER_GROUP_ORDER.reduce(
    (acc, group) => {
      acc[group] = [];
      return acc;
    },
    {} as Record<ParameterGroup, DiscoveredParameter[]>
  );
}

/** Group discovered parameters by automatic classification. */
export function groupDiscoveredParameters(
  parameters: DiscoveredParameter[]
): Record<ParameterGroup, DiscoveredParameter[]> {
  const groups = emptyGroupedParameters();

  for (const p of parameters) {
    const group = normalizeParameterGroup(p.category);
    const normalized = { ...p, category: group };
    groups[group].push(normalized);
  }

  for (const group of PARAMETER_GROUP_ORDER) {
    groups[group].sort(
      (a, b) =>
        a.pageNumber - b.pageNumber ||
        a.parameterName.localeCompare(b.parameterName)
    );
  }

  return groups;
}

/** Apply grouping to raw parameters (re-classify from names). */
export function applyParameterGrouping(
  parameters: Omit<DiscoveredParameter, 'category'>[]
): DiscoveredParameter[] {
  return parameters.map((p) => ({
    ...p,
    category: classifyParameterGroup(p.parameterName, p.parameterValue),
  }));
}

export function buildGroupedDiscoveryPayload(
  parameters: DiscoveredParameter[],
  opts?: { skipValidation?: boolean }
): {
  parameters: DiscoveredParameter[];
  grouped: Record<ParameterGroup, DiscoveredParameter[]>;
} {
  let list = parameters.map((p) => ({
    ...p,
    category: classifyParameterGroup(p.parameterName, p.parameterValue),
  }));

  if (!opts?.skipValidation) {
    list = finalizeDiscoveredParameters(list);
    list = list.map((p) => ({
      ...p,
      category: classifyParameterGroup(p.parameterName, p.parameterValue),
    }));
  }

  return {
    parameters: list,
    grouped: groupDiscoveredParameters(list),
  };
}
