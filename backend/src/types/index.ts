export enum UserRole {
  EXECUTIVE = 'executive',
  MD = 'md',
  FINANCE = 'finance',
  MANAGER = 'manager',
  ADMIN = 'admin',
}

export enum TenderStatus {
  DRAFT = 'DRAFT',
  NIT_ANALYZED = 'NIT_ANALYZED',
  SUMMARY_GENERATED = 'SUMMARY_GENERATED',
  PENDING_MD_APPROVAL = 'PENDING_MD_APPROVAL',
  APPROVED_BY_MD = 'APPROVED_BY_MD',
  REJECTED_BY_MD = 'REJECTED_BY_MD',
  FINANCE_PENDING = 'FINANCE_PENDING',
  FINANCE_APPROVED = 'FINANCE_APPROVED',
  FINANCE_REJECTED = 'FINANCE_REJECTED',
  MANAGER_PENDING = 'MANAGER_PENDING',
  MANAGER_APPROVED = 'MANAGER_APPROVED',
  READY_FOR_BID = 'READY_FOR_BID',
  SUBMITTED = 'SUBMITTED',
  AWARDED = 'AWARDED',
}

export enum EligibilityStatus {
  ELIGIBLE = 'ELIGIBLE',
  PARTIALLY_ELIGIBLE = 'PARTIALLY_ELIGIBLE',
  NOT_ELIGIBLE = 'NOT_ELIGIBLE',
}

export enum RiskLevel {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low',
}

export enum FinanceRequestType {
  EMD = 'EMD',
  BG = 'BG',
  DD = 'DD',
}

export enum FinanceRequestStatus {
  PENDING = 'FINANCE_PENDING',
  APPROVED = 'FINANCE_APPROVED',
  REJECTED = 'FINANCE_REJECTED',
}

export enum ApprovalType {
  MD = 'MD',
  FINANCE = 'FINANCE',
  COMPLIANCE = 'COMPLIANCE',
}

export enum ApprovalDecision {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum NotificationType {
  TENDER_STATUS = 'TENDER_STATUS',
  APPROVAL_REQUEST = 'APPROVAL_REQUEST',
  FINANCE_REQUEST = 'FINANCE_REQUEST',
  COMPLIANCE_REQUEST = 'COMPLIANCE_REQUEST',
  DOCUMENT_SIGNING = 'DOCUMENT_SIGNING',
  SUBMISSION_ALERT = 'SUBMISSION_ALERT',
  POST_AWARD_ALERT = 'POST_AWARD_ALERT',
  SYSTEM = 'SYSTEM',
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.EXECUTIVE]: [
    'tender:create',
    'tender:read',
    'tender:update',
    'document:upload',
    'document:sign',
    'document:workflow',
    'nit:analyze',
    'nit:view',
    'summary:generate',
    'approval:submit_md',
    'finance:request',
    'compliance:request',
    'tender:track',
    'finance:track',
    'finance:comment',
    'postaward:read',
    'postaward:write',
  ],
  [UserRole.MD]: [
    'tender:read',
    'summary:view',
    'nit:view',
    'approval:md',
    'document:sign',
    'postaward:read',
    'postaward:admin',
    'mis:read',
    'mis:full',
    'mis:finance',
    'mis:contracts',
    'mis:export',
  ],
  [UserRole.FINANCE]: [
    'tender:read',
    'finance:read',
    'finance:approve',
    'finance:upload_proof',
    'finance:update_payment',
    'finance:track',
    'finance:comment',
    'postaward:read',
    'mis:read',
    'mis:finance',
  ],
  [UserRole.MANAGER]: [
    'compliance:read',
    'compliance:upload',
    'compliance:approve',
    'tender:read',
    'tender:update',
    'document:upload',
    'document:sign',
    'document:workflow',
    'finance:track',
    'finance:comment',
    'postaward:read',
    'postaward:approve',
    'postaward:renewal',
    'mis:read',
    'mis:contracts',
  ],
  [UserRole.ADMIN]: [
    'tender:read',
    'nit:view',
    'summary:view',
    'finance:read',
    'finance:track',
    'postaward:read',
    'postaward:admin',
    'mis:read',
    'mis:full',
    'mis:finance',
    'mis:contracts',
    'mis:export',
    'admin:read',
    'admin:users',
    'admin:manage',
  ],
};
