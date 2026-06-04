import { DiscoveredParameter } from '../../types/parameterDiscovery';

const SCIENTIFIC_OR_BROKEN_NUM = /e[+\-]?\d{10,}/i;

const NEXT_LABEL_IN_VALUE =
  /\s+(?=[A-Za-z][A-Za-z0-9\s\/\(\)\.&,'°#%/\-]{2,65}?\s*[:=\u2013\u2014\-–]\s*)/;

const SHORT_VALUE_LABELS =
  /^(?:tender\s*no|nit\s*no|bid\s*no|reference\s*no|email|phone|mobile|fax|pin\s*code|pincode|gstin|pan)$/i;

function truncateAtNextLabel(value: string): string {
  const m = value.match(NEXT_LABEL_IN_VALUE);
  if (m?.index != null && m.index > 0 && m.index < value.length * 0.9) {
    return value.slice(0, m.index).trim();
  }
  return value.trim();
}

function isBrokenNumeric(value: string): boolean {
  if (SCIENTIFIC_OR_BROKEN_NUM.test(value)) return true;
  const stripped = value.replace(/[,\s₹Rs.INR/-]/gi, '');
  if (!/^\d+\.?\d*$/.test(stripped)) return false;
  const n = Number(stripped);
  return !Number.isNaN(n) && n > 1e14;
}

function normalizeValue(parameterName: string, rawValue: string): string | null {
  let value = rawValue.replace(/\s+/g, ' ').trim();
  if (!value) return null;

  if (SHORT_VALUE_LABELS.test(parameterName.replace(/\s+/g, ' ').trim())) {
    value = truncateAtNextLabel(value);
  }

  if (isBrokenNumeric(value)) return null;
  if (value.toLowerCase() === parameterName.toLowerCase()) return null;

  return value;
}

/**
 * Lenient finalize — keep all real pairs; drop only empty, broken numbers, exact duplicates.
 */
export function finalizeDiscoveredParameters(
  parameters: DiscoveredParameter[]
): DiscoveredParameter[] {
  const out: DiscoveredParameter[] = [];
  const seen = new Set<string>();

  for (const p of parameters) {
    const parameterValue = normalizeValue(p.parameterName, p.parameterValue);
    if (!parameterValue) continue;

    const key = `${p.pageNumber}|${p.parameterName.toLowerCase()}|${parameterValue.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ ...p, parameterValue });
  }

  return out.sort(
    (a, b) =>
      a.pageNumber - b.pageNumber ||
      a.parameterName.localeCompare(b.parameterName) ||
      a.parameterValue.localeCompare(b.parameterValue)
  );
}

/** @deprecated Use finalizeDiscoveredParameters */
export function validateParametersForDisplay(
  parameters: DiscoveredParameter[]
): DiscoveredParameter[] {
  return finalizeDiscoveredParameters(parameters);
}

export function validateParameterValue(parameterName: string, rawValue: string): string | null {
  return normalizeValue(parameterName, rawValue);
}

export function validateDiscoveredParameter(p: DiscoveredParameter): DiscoveredParameter | null {
  const parameterValue = normalizeValue(p.parameterName, p.parameterValue);
  if (!parameterValue) return null;
  return { ...p, parameterValue };
}
