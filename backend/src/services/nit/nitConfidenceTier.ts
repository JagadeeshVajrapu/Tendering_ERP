export type NitConfidenceTier = 'verified' | 'high' | 'review' | 'low';

export function resolveConfidenceTier(confidence: number): NitConfidenceTier {
  if (confidence >= 95) return 'verified';
  if (confidence >= 85) return 'high';
  if (confidence >= 70) return 'review';
  return 'low';
}

export function resolveConfidenceLabel(tier: NitConfidenceTier): string {
  switch (tier) {
    case 'verified':
      return 'Verified';
    case 'high':
      return 'High Confidence';
    case 'review':
      return 'Review Recommended';
    case 'low':
      return 'Low Confidence';
  }
}

export function isHiddenByDefaultConfidence(confidence: number): boolean {
  return confidence < 70;
}
