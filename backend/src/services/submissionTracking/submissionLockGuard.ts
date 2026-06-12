import { AppError } from '../../middleware/errorHandler';
import { TenderSubmissionTracking } from '../../models/TenderSubmissionTracking';

export async function isSubmissionLocked(tenderId: string): Promise<boolean> {
  const tracking = await TenderSubmissionTracking.findOne({ tenderId }).lean();
  return tracking?.status === 'locked' || tracking?.status === 'submitted';
}

export async function assertSubmissionWritable(tenderId: string): Promise<void> {
  const tracking = await TenderSubmissionTracking.findOne({ tenderId }).lean();
  if (!tracking) return;
  if (tracking.status === 'locked') {
    throw new AppError(
      'Submission is locked. Unlock is not permitted — contact an administrator if changes are required.',
      423
    );
  }
  if (tracking.status === 'submitted') {
    throw new AppError('Tender has been submitted. Document modifications are not allowed.', 423);
  }
}
