export type SubmissionTrackingStatus = 'draft' | 'ready' | 'locked' | 'submitted';

export type SubmissionDeadlineAlertLevel =
  | '7_days'
  | '3_days'
  | '24_hours'
  | '6_hours'
  | '1_hour'
  | 'expired'
  | 'none';

export interface SubmissionChecklistItemDto {
  id: string;
  name: string;
  categoryTitle: string;
  required: boolean;
  uploaded: boolean;
  missing: boolean;
  critical: boolean;
  status: string;
  matchedFileName?: string;
}

export interface SubmissionDocumentSummaryDto {
  preparationDocumentCount: number;
  preparationTotalSize: number;
  validationComplete: number;
  validationWarning: number;
  validationError: number;
}

export interface SubmissionDeadlineDto {
  deadlineAt?: string;
  deadlineLabel?: string;
  remainingMs?: number;
  remainingLabel?: string;
  alertLevel: SubmissionDeadlineAlertLevel;
  alertMessage?: string;
}

export interface SubmissionScreenshotDto {
  id: string;
  tenderId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  caption?: string;
  downloadUrl: string;
  previewUrl: string;
  uploadedBy: { id: string; name: string };
  uploadedAt: string;
}

export interface SubmissionLogDto {
  id: string;
  tenderId: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  message: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface SubmissionTrackingDashboardDto {
  tenderId: string;
  tenderTitle: string;
  tenderStatus: string;
  submissionStatus: SubmissionTrackingStatus;
  completionPercentage: number;
  readinessLabel: string;
  mandatoryComplete: boolean;
  locked: boolean;
  lockedAt?: string;
  lockedBy?: { id: string; name: string };
  submittedAt?: string;
  submittedBy?: { id: string; name: string };
  checklistItems: SubmissionChecklistItemDto[];
  checklistSummary: {
    required: number;
    completed: number;
    missing: number;
    criticalMissing: number;
  };
  documents: SubmissionDocumentSummaryDto;
  deadline: SubmissionDeadlineDto;
  activeAlerts: Array<{ level: SubmissionDeadlineAlertLevel; message: string }>;
  screenshots: SubmissionScreenshotDto[];
  canLock: boolean;
  canSubmit: boolean;
  lockReasons: string[];
}
