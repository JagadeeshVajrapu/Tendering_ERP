const REJECT_PHRASES = [
  'i agree to abide',
  'terms and conditions',
  'specifications',
];

export function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function validateFieldValue(value: string): { valid: boolean; reason?: string } {
  const v = value.trim();
  if (!v) return { valid: false, reason: 'Empty value' };
  if (v.length > 150) return { valid: false, reason: 'Value exceeds 150 characters' };
  if (wordCount(v) > 20) return { valid: false, reason: 'Value exceeds 20 words' };

  const lower = v.toLowerCase();
  for (const phrase of REJECT_PHRASES) {
    if (lower.includes(phrase)) {
      return { valid: false, reason: `Value contains rejected phrase: "${phrase}"` };
    }
  }

  return { valid: true };
}
