const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function parseFlexibleDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const monthMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (monthMatch) {
    const month = MONTH_MAP[monthMatch[2].slice(0, 3).toLowerCase()];
    if (month !== undefined) {
      return new Date(parseInt(monthMatch[3], 10), month, parseInt(monthMatch[1], 10));
    }
  }

  const parts = trimmed.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (day > 12 && month <= 12) {
      // likely DD/MM/YYYY
    } else if (month > 12) {
      [day, month] = [month, day];
      month -= 1;
    }
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const iso = new Date(trimmed);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export function daysUntil(date: Date, from = new Date()): number {
  const ms = date.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function extractExpiryDates(text: string): Date[] {
  const found: Date[] = [];
  for (const pattern of [
    /\b(?:valid\s+(?:up\s*to|till|until|upto)|expir(?:y|es|ed)\s*(?:on|date)?|validity)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/gi,
    /\b(?:valid\s+(?:up\s*to|till|until|upto)|expir(?:y|es|ed)\s*(?:on|date)?)\s*[:\-]?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/gi,
  ]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const parsed = parseFlexibleDate(match[1]);
      if (parsed) found.push(parsed);
    }
  }
  return found;
}
