import { MasterDatasetKey } from '../../types/masterDataset';

const TENDER_NUMBER_REJECT = [
  'i agree to abide',
  'terms and conditions',
  'specification',
  'specifications',
];

const ORGANIZATION_REJECT = [
  'emd @',
  'emd@',
  'rs.',
  'rs ',
  '₹',
  'inr ',
  'money deposit',
  'earnest money',
  'bid security',
];

export function validateMasterFieldValue(
  key: MasterDatasetKey,
  value: string
): { valid: boolean; reason?: string } {
  const v = value.trim();
  if (!v) return { valid: false, reason: 'Empty' };

  const lower = v.toLowerCase();

  if (key === 'tenderNumber' || key === 'nitNumber' || key === 'bidReferenceNumber') {
    for (const phrase of TENDER_NUMBER_REJECT) {
      if (lower.includes(phrase)) {
        return { valid: false, reason: `Tender number rejected: contains "${phrase}"` };
      }
    }
    if (v.length > 150) return { valid: false, reason: 'Tender number too long' };
    if (v.split(/\s+/).length > 20) return { valid: false, reason: 'Tender number has too many words' };
  }

  if (key === 'organization' || key === 'department') {
    for (const phrase of ORGANIZATION_REJECT) {
      if (lower.includes(phrase)) {
        return { valid: false, reason: `Organization rejected: contains "${phrase}"` };
      }
    }
    if (v.length > 150) return { valid: false, reason: 'Organization too long' };
  }

  if (v.length > 500) return { valid: false, reason: 'Value too long' };

  return { valid: true };
}
