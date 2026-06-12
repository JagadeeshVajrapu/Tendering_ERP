/** Indian financial year helpers — auto-generates FY labels without code changes each year. */

export interface FinancialYear {
  id: string;
  label: string;
  startYear: number;
  endYear: number;
}

/** Current Indian FY start year (April–March). */
export function getCurrentFinancialYearStart(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 4 ? year : year - 1;
}

export function formatFinancialYearLabel(startYear: number): string {
  const end = startYear + 1;
  const endShort = String(end).slice(-2);
  return `FY ${startYear}-${endShort}`;
}

/** ITR / compliance format: FY21-22 */
export function formatItrFyLabel(startYear: number): string {
  const endShort = String(startYear + 1).slice(-2);
  const startShort = String(startYear).slice(-2);
  return `FY${startShort}-${endShort}`;
}

/** Experience year format: 2001-02, 2002-03, … 2025-26 */
export function formatExperienceFyLabel(startYear: number): string {
  const endShort = String(startYear + 1).slice(-2);
  return `${startYear}-${endShort}`;
}

export function formatFinancialYearId(startYear: number): string {
  const end = startYear + 1;
  return `fy_${startYear}_${String(end).slice(-2)}`;
}

/** FY 2001-02 through current FY (inclusive), ascending. */
export function generateFinancialYears(fromStartYear = 2001): FinancialYear[] {
  const currentStart = getCurrentFinancialYearStart();
  const years: FinancialYear[] = [];
  for (let y = fromStartYear; y <= currentStart; y++) {
    years.push({
      id: formatFinancialYearId(y),
      label: formatExperienceFyLabel(y),
      startYear: y,
      endYear: y + 1,
    });
  }
  return years;
}

/** FY 2001-02 through current FY, newest first (for experience selection). */
export function generateFinancialYearsDescending(fromStartYear = 2001): FinancialYear[] {
  return [...generateFinancialYears(fromStartYear)].reverse();
}

/** Rolling window ending at current FY — used for ITR / compliance returns (ascending). */
export function generateRecentFinancialYears(count = 5, fromStartYear = 2021): FinancialYear[] {
  const all = generateFinancialYears(fromStartYear);
  return all.slice(-count);
}

/** Recent FY window, newest first (FY25-26 at top). */
export function generateRecentFinancialYearsDescending(count = 5, fromStartYear = 2021): FinancialYear[] {
  return generateRecentFinancialYears(count, fromStartYear).reverse();
}

/** Suggest the last N financial years for experience proof. */
export function suggestExperienceYears(requiredYears: number): FinancialYear[] {
  if (requiredYears <= 0) return [];
  const all = generateFinancialYears(2001);
  return all.slice(-requiredYears);
}
