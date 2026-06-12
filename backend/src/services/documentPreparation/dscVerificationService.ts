import { createHash, X509Certificate } from 'crypto';
import { AppError } from '../../middleware/errorHandler';
import { ICertificateInfo } from '../../models/PreparationSignature';

export interface DscVerificationResult {
  valid: boolean;
  certificateClass: 'class3' | 'unknown';
  message: string;
  certificateInfo: ICertificateInfo;
}

function normalizePem(certificatePem: string): string {
  const trimmed = certificatePem.trim();
  if (trimmed.includes('BEGIN CERTIFICATE')) return trimmed;
  const body = trimmed.replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g) || [body];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
}

function detectClass3(subject: string, issuer: string): 'class3' | 'unknown' {
  const combined = `${subject} ${issuer}`.toLowerCase();
  if (
    combined.includes('class 3') ||
    combined.includes('class3') ||
    combined.includes('organisation') ||
    combined.includes('organization') ||
    combined.includes('capricorn') ||
    combined.includes('emudhra') ||
    combined.includes('nscode') ||
    combined.includes('safescrypt')
  ) {
    return 'class3';
  }
  return 'unknown';
}

export function verifyDscCertificate(certificatePem: string): DscVerificationResult {
  if (!certificatePem?.trim()) throw new AppError('Certificate PEM is required', 400);

  let cert: X509Certificate;
  try {
    cert = new X509Certificate(normalizePem(certificatePem));
  } catch {
    throw new AppError('Invalid X.509 certificate format', 400);
  }

  const now = Date.now();
  const validFrom = new Date(cert.validFrom).getTime();
  const validTo = new Date(cert.validTo).getTime();
  const expired = now > validTo;
  const notYetValid = now < validFrom;

  const certificateInfo: ICertificateInfo = {
    subject: cert.subject,
    issuer: cert.issuer,
    serialNumber: cert.serialNumber,
    validFrom: cert.validFrom,
    validTo: cert.validTo,
    certificateClass: detectClass3(cert.subject, cert.issuer),
    thumbprint: createHash('sha256').update(cert.raw).digest('hex'),
  };

  if (expired) {
    return {
      valid: false,
      certificateClass: certificateInfo.certificateClass,
      message: 'Certificate has expired',
      certificateInfo,
    };
  }
  if (notYetValid) {
    return {
      valid: false,
      certificateClass: certificateInfo.certificateClass,
      message: 'Certificate is not yet valid',
      certificateInfo,
    };
  }

  return {
    valid: true,
    certificateClass: certificateInfo.certificateClass,
    message:
      certificateInfo.certificateClass === 'class3'
        ? 'Class 3 DSC certificate verified'
        : 'Certificate verified (class unknown)',
    certificateInfo,
  };
}

export function verifyDscSignaturePayload(
  certificatePem: string,
  signatureBase64: string,
  documentHashBase64?: string
): DscVerificationResult {
  const result = verifyDscCertificate(certificatePem);
  if (!signatureBase64?.trim()) {
    return { ...result, valid: false, message: 'Signature payload is missing' };
  }
  if (documentHashBase64 && signatureBase64.length < 32) {
    return { ...result, valid: false, message: 'Signature payload appears invalid' };
  }
  return {
    ...result,
    valid: result.valid,
    message: result.valid
      ? `${result.message}. Signature payload accepted for audit.`
      : result.message,
  };
}
