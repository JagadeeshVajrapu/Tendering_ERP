export enum UserRole {
  EXECUTIVE = 'executive',
  MD = 'md',
  FINANCE = 'finance',
  MANAGER = 'manager',
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
  SYSTEM = 'SYSTEM',
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.EXECUTIVE]: [
    'tender:create',
    'tender:read',
    'tender:update',
    'document:upload',
    'nit:analyze',
    'nit:view',
    'summary:generate',
    'approval:submit_md',
    'finance:request',
    'compliance:request',
    'tender:track',
  ],
  [UserRole.MD]: [
    'tender:read',
    'summary:view',
    'nit:view',
    'approval:md',
  ],
  [UserRole.FINANCE]: [
    'finance:read',
    'finance:approve',
    'finance:upload_proof',
    'finance:update_payment',
  ],
  [UserRole.MANAGER]: [
    'compliance:read',
    'compliance:upload',
    'compliance:approve',
  ],
};
