export type SubmissionTrackingStatus = 'draft' | 'ready' | 'locked' | 'submitted';

export type SubmissionDeadlineAlertLevel =
  | '7_days'
  | '3_days'
  | '24_hours'
  | '6_hours'
  | '1_hour'
  | 'expired'
  | 'none';

export interface SubmissionChecklistItem {
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

export interface SubmissionTrackingDashboard {
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
  checklistItems: SubmissionChecklistItem[];
  checklistSummary: {
    required: number;
    completed: number;
    missing: number;
    criticalMissing: number;
  };
  documents: {
    preparationDocumentCount: number;
    preparationTotalSize: number;
    validationComplete: number;
    validationWarning: number;
    validationError: number;
  };
  deadline: {
    deadlineAt?: string;
    deadlineLabel?: string;
    remainingMs?: number;
    remainingLabel?: string;
    alertLevel: SubmissionDeadlineAlertLevel;
    alertMessage?: string;
  };
  activeAlerts: Array<{ level: SubmissionDeadlineAlertLevel; message: string }>;
  screenshots: SubmissionScreenshot[];
  canLock: boolean;
  canSubmit: boolean;
  lockReasons: string[];
}

export interface SubmissionScreenshot {
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

export interface SubmissionLogEntry {
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
