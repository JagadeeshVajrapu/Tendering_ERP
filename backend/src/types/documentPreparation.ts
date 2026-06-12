export type PreparationDocumentSource =
  | 'upload'
  | 'merge'
  | 'split'
  | 'compress'
  | 'rotate'
  | 'ocr'
  | 'header_footer'
  | 'watermark'
  | 'page_numbers'
  | 'template_fill'
  | 'unlock'
  | 'redact'
  | 'annotate'
  | 'highlight'
  | 'stamp'
  | 'signed'
  | 'dsc_signed';

export interface PreparationDocumentDto {
  id: string;
  tenderId: string;
  displayName: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  pageCount: number;
  localPath: string;
  downloadUrl: string;
  previewUrl: string;
  source: PreparationDocumentSource;
  metadata: Record<string, unknown>;
  uploadedBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface PreparationDocumentListResult {
  tenderId: string;
  documents: PreparationDocumentDto[];
  totalSize: number;
  totalCount: number;
}

export interface BulkRenameItem {
  documentId: string;
  displayName: string;
}

export interface PdfMergeRequest {
  documentIds: string[];
  outputName?: string;
}

export interface PdfSplitRequest {
  documentId: string;
  ranges: Array<{ from: number; to: number; name?: string }>;
}

export interface PdfCompressRequest {
  documentId: string;
  outputName?: string;
}

export interface PdfRotateRequest {
  documentId: string;
  degrees: 90 | 180 | 270;
  pageNumbers?: number[];
  outputName?: string;
  replaceOriginal?: boolean;
}

export interface PreparationOcrPageDto {
  pageNumber: number;
  text: string;
  charCount: number;
  method: 'pdf-parse' | 'tesseract' | 'hybrid';
}

export interface PreparationOcrResultDto {
  id: string;
  tenderId: string;
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  method: 'pdf-parse' | 'tesseract' | 'hybrid';
  fullText: string;
  pages: PreparationOcrPageDto[];
  pageCount: number;
  qualityScore: number;
  processingTimeMs: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyTemplateDataDto {
  id: string;
  companyName: string;
  gst: string;
  pan: string;
  address: string;
  cin: string;
  msme: string;
  email?: string;
  phone?: string;
  updatedAt: string;
}

export interface PdfHeaderFooterRequest {
  documentId: string;
  headerText?: string;
  footerText?: string;
  fontSize?: number;
  outputName?: string;
}

export interface PdfWatermarkRequest {
  documentId: string;
  watermarkText: string;
  fontSize?: number;
  opacity?: number;
  outputName?: string;
}

export interface PdfPageNumbersRequest {
  documentId: string;
  format?: string;
  fontSize?: number;
  position?: 'bottom-center' | 'bottom-right' | 'bottom-left';
  outputName?: string;
}

export interface PdfAutoFillTemplateRequest {
  documentId: string;
  outputName?: string;
  includeCoverPage?: boolean;
}

export type ValidationStatus = 'valid' | 'warning' | 'error';

export interface ValidationCheckDto {
  id: string;
  category: 'file_size' | 'portal_format' | 'blank_page' | 'signature' | 'certificate_expiry';
  status: ValidationStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface CertificateFindingDto {
  type: 'iso' | 'bank_solvency' | 'license' | 'registration';
  name: string;
  status: ValidationStatus | 'unknown';
  expiryDate?: string;
  daysUntilExpiry?: number;
  evidence?: string;
}

export interface DocumentValidationDto {
  id: string;
  tenderId: string;
  documentId: string;
  documentName: string;
  status: ValidationStatus;
  score: number;
  checks: ValidationCheckDto[];
  certificateFindings: CertificateFindingDto[];
  blankPages: number[];
  hasSignature: boolean;
  validatedAt: string;
  updatedAt: string;
}

export interface ValidationDashboardDto {
  tenderId: string;
  totalDocuments: number;
  validDocuments: number;
  warningDocuments: number;
  errorDocuments: number;
  unvalidatedDocuments: number;
  averageScore: number;
  validations: DocumentValidationDto[];
}

export interface MarkupRegion {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  color?: string;
  stampLabel?: string;
}

export interface PdfUnlockRequest {
  documentId: string;
  password: string;
  outputName?: string;
}

export interface PdfMarkupRequest {
  documentId: string;
  markupType: 'annotation' | 'highlight' | 'redaction' | 'stamp';
  regions: MarkupRegion[];
  outputName?: string;
}

export type WorkflowStatus = 'draft' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
export type WorkflowStepStatus = 'pending' | 'active' | 'signed' | 'rejected' | 'skipped';
export type SignerRole = 'executive' | 'manager' | 'md';

export interface WorkflowStepDto {
  order: number;
  role: SignerRole;
  label: string;
  assignedUserId?: string;
  assignedUserName?: string;
  status: WorkflowStepStatus;
  signedAt?: string;
  signatureId?: string;
  rejectionReason?: string;
}

export interface SigningWorkflowDto {
  id: string;
  tenderId: string;
  documentId: string;
  documentName: string;
  title: string;
  status: WorkflowStatus;
  steps: WorkflowStepDto[];
  currentStepIndex: number;
  signedDocumentId?: string;
  createdBy: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSigningWorkflowRequest {
  documentId: string;
  title?: string;
  steps?: Array<{ role: SignerRole; label?: string; assignedUserId?: string }>;
}

export interface ElectronicSignRequest {
  signatureImageBase64: string;
  pageNumber?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface DscSignRequest {
  certificatePem: string;
  signatureBase64: string;
  dscTokenId?: string;
  documentHashBase64?: string;
  signedPdfBase64?: string;
}

export interface DscVerifyRequest {
  certificatePem: string;
}

export interface SignatureHistoryItem {
  id: string;
  workflowId?: string;
  signerName: string;
  signerRole: string;
  signatureType: 'electronic' | 'dsc';
  verificationStatus: string;
  verificationMessage?: string;
  certificateInfo?: Record<string, unknown>;
  dscTokenId?: string;
  signedDocumentId?: string;
  signedAt: string;
}

export interface PreparationAuditLogItem {
  id: string;
  userId: unknown;
  userRole: string;
  action: string;
  documentId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}
