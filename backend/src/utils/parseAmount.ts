export function parseAmount(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  const multiplier = /crore|cr/i.test(String(value)) ? 10000000 : /lakh|lac/i.test(String(value)) ? 100000 : 1;
  return isNaN(num) ? 0 : num * multiplier;
}

export function parseExperienceYears(value: string | undefined): number {
  if (!value) return 0;
  const match = value.match(/(\d+)\s*(year|yr)/i);
  return match ? parseInt(match[1], 10) : 0;
}
