import { ITenderAnalysisData, IImportantDate } from '../../models/TenderAnalysis';

const PLACEHOLDER_PATTERNS = [
  /^not specified$/i,
  /^n\/a$/i,
  /^na$/i,
  /^—$/,
  /^-$/,
  /^as per tender document\.?$/i,
  /^see tender document\.?$/i,
  /^refer to tender document\.?$/i,
  /^tender opportunity$/i,
];

export function isMissingValue(value?: string | null): boolean {
  if (!value?.trim()) return true;
  const trimmed = value.trim();
  if (trimmed.length < 2) return true;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(trimmed));
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeYesNo(value?: string): string {
  if (isMissingValue(value)) return '';
  const lower = value!.toLowerCase().trim();
  if (/^(yes|y|true|required|applicable|mandatory)$/i.test(lower)) return 'Yes';
  if (/^(no|n|false|not required|not applicable|na|n\/a)$/i.test(lower)) return 'No';
  if (/\byes\b/i.test(lower) && !/\bno\b/i.test(lower)) return 'Yes';
  if (/\bno\b/i.test(lower) && !/\byes\b/i.test(lower)) return 'No';
  return cleanText(value!);
}

/** Case-insensitive dedup; merges comma-separated strings; drops near-duplicate long entries. */
export function dedupeStrings(items: string[], maxItems = 12): string[] {
  const expanded = items.flatMap((item) => {
    if (!item?.trim()) return [];
    if (item.includes(',') && item.length < 120) {
      return item.split(/[,;|•]+/).map((s) => cleanText(s)).filter(Boolean);
    }
    return [cleanText(item)];
  });

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of expanded) {
    if (item.length < 2 || /^[\d.]+$/.test(item)) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;

    const dupIndex = result.findIndex((existing) => {
      const ek = existing.toLowerCase();
      if (ek === key) return true;
      if (item.length <= 25 && ek.length <= 25) return ek.includes(key) || key.includes(ek);
      if (item.length > 40 && ek.length > 40) {
        return ek.includes(key) || key.includes(ek);
      }
      return false;
    });

    if (dupIndex >= 0) {
      if (item.length > result[dupIndex].length) {
        seen.delete(result[dupIndex].toLowerCase());
        seen.add(key);
        result[dupIndex] = item;
      }
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result.slice(0, maxItems);
}

function pickField(primary: string, fallback: string): string {
  return isMissingValue(primary) ? (isMissingValue(fallback) ? '' : cleanText(fallback)) : cleanText(primary);
}

function dedupeDates(dates: IImportantDate[]): IImportantDate[] {
  const seen = new Set<string>();
  return dates
    .filter((d) => d.label?.trim() && d.date?.trim())
    .filter((d) => {
      const key = `${d.label.toLowerCase()}|${d.date.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

function inferSubmissionDate(data: ITenderAnalysisData): string {
  if (!isMissingValue(data.bidSubmissionDate)) return data.bidSubmissionDate;
  const fromDates = data.importantDates.find((d) =>
    /submission|last date|bid due|closing date/i.test(d.label)
  );
  return fromDates?.date || '';
}

function inferOrganization(data: ITenderAnalysisData): string {
  if (!isMissingValue(data.organization)) return data.organization;
  if (!isMissingValue(data.department)) return data.department;
  return '';
}

/** Merge AI output with regex-based extraction; AI wins when present, local fills gaps. */
export function mergeAnalysisResults(
  primary: ITenderAnalysisData,
  supplement: ITenderAnalysisData
): ITenderAnalysisData {
  const eligibility = dedupeStrings([
    ...(primary.eligibilityCriteria || []),
    ...(supplement.eligibilityCriteria || []),
  ]);
  const technical = dedupeStrings([
    ...(primary.technicalRequirements || []),
    ...(supplement.technicalRequirements || []),
  ]);
  const documents = dedupeStrings([
    ...(primary.requiredDocuments || []),
    ...(supplement.requiredDocuments || []),
  ]);
  const risks = dedupeStrings([...(primary.riskFactors || []), ...(supplement.riskFactors || [])], 8);
  const dates = dedupeDates([
    ...(primary.importantDates || []),
    ...(supplement.importantDates || []),
  ]);

  const merged: ITenderAnalysisData = {
    tenderName: pickField(primary.tenderName, supplement.tenderName),
    department: pickField(primary.department, supplement.department),
    organization: pickField(primary.organization, supplement.organization),
    tenderNumber: pickField(primary.tenderNumber, supplement.tenderNumber),
    estimatedValue: pickField(primary.estimatedValue, supplement.estimatedValue),
    emdAmount: pickField(primary.emdAmount, supplement.emdAmount),
    bgRequirement: pickField(primary.bgRequirement, supplement.bgRequirement),
    bidSubmissionDate: pickField(primary.bidSubmissionDate, supplement.bidSubmissionDate),
    preBidMeetingDate: pickField(primary.preBidMeetingDate, supplement.preBidMeetingDate),
    contractDuration: pickField(primary.contractDuration, supplement.contractDuration),
    scopeOfWork: pickField(primary.scopeOfWork, supplement.scopeOfWork),
    eligibilityCriteria: eligibility,
    technicalRequirements: technical,
    reverseAuction: pickField(primary.reverseAuction, supplement.reverseAuction),
    mafRequired: pickField(primary.mafRequired, supplement.mafRequired),
    requiredDocuments: documents,
    importantDates: dates,
    paymentTerms: pickField(primary.paymentTerms, supplement.paymentTerms),
    riskFactors: risks,
    aiRecommendation: pickField(primary.aiRecommendation, supplement.aiRecommendation),
  };

  merged.organization = inferOrganization(merged) || merged.organization;
  merged.bidSubmissionDate = inferSubmissionDate(merged) || merged.bidSubmissionDate;

  return merged;
}

export function normalizeTenderAnalysis(data: ITenderAnalysisData): ITenderAnalysisData {
  const reverseAuction = normalizeYesNo(data.reverseAuction);
  const mafRequired = normalizeYesNo(data.mafRequired);

  let bgRequirement = data.bgRequirement?.trim() || '';
  if (/^(yes|required)$/i.test(bgRequirement)) bgRequirement = 'Yes';
  if (/^(no|not required)$/i.test(bgRequirement)) bgRequirement = 'No';

  return {
    ...data,
    tenderName: cleanText(data.tenderName || ''),
    department: cleanText(data.department || ''),
    organization: cleanText(data.organization || ''),
    tenderNumber: cleanText(data.tenderNumber || ''),
    estimatedValue: cleanText(data.estimatedValue || ''),
    emdAmount: cleanText(data.emdAmount || ''),
    bgRequirement: cleanText(bgRequirement),
    bidSubmissionDate: cleanText(data.bidSubmissionDate || ''),
    preBidMeetingDate: cleanText(data.preBidMeetingDate || ''),
    contractDuration: cleanText(data.contractDuration || ''),
    scopeOfWork: cleanText(data.scopeOfWork || ''),
    eligibilityCriteria: dedupeStrings(data.eligibilityCriteria || []),
    technicalRequirements: dedupeStrings(data.technicalRequirements || []),
    reverseAuction: reverseAuction || 'No',
    mafRequired: mafRequired || 'No',
    requiredDocuments: dedupeStrings(data.requiredDocuments || [], 15),
    importantDates: dedupeDates(data.importantDates || []),
    paymentTerms: cleanText(data.paymentTerms || ''),
    riskFactors: dedupeStrings(data.riskFactors || [], 8),
    aiRecommendation: cleanText(data.aiRecommendation || ''),
  };
}

export function finalizeTenderAnalysis(
  primary: ITenderAnalysisData,
  supplement: ITenderAnalysisData
): ITenderAnalysisData {
  return normalizeTenderAnalysis(mergeAnalysisResults(primary, supplement));
}
