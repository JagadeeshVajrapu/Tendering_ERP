import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { PreparationDocument } from '../../models/PreparationDocument';
import { PreparationDocumentMarkup } from '../../models/PreparationDocumentMarkup';
import {
  IPreparationSigningWorkflow,
  PreparationSigningWorkflow,
  SignerRole,
} from '../../models/PreparationSigningWorkflow';
import { PreparationSignature } from '../../models/PreparationSignature';
import { UserRole } from '../../types';
import { PreparationDocumentSource } from '../../types/documentPreparation';
import { fileStorageService } from '../storage/fileStorageService';
import { documentPreparationService } from './documentPreparationService';
import { verifyDscCertificate, verifyDscSignaturePayload } from './dscVerificationService';
import {
  embedSignatureImage,
  MarkupRegionInput,
  toMarkupRegions,
} from './pdfAdvancedEditingService';
import { preparationAuditService } from './preparationAuditService';
import {
  advanceWorkflow,
  assertSignerAuthorized,
  buildWorkflowSteps,
  notifyNextSigner,
} from './preparationWorkflowEngine';

function preparationFolder(tenderId: string): string {
  return `preparation/${tenderId}`;
}

interface RequestContext {
  userId: Types.ObjectId;
  userRole: UserRole;
  userName: string;
  ipAddress?: string;
  userAgent?: string;
}

class PreparationSigningService {
  private async getWorkflowForTender(tenderId: string, workflowId: string) {
    if (!Types.ObjectId.isValid(workflowId)) throw new AppError('Invalid workflow id', 400);
    const workflow = await PreparationSigningWorkflow.findOne({
      _id: new Types.ObjectId(workflowId),
      tenderId: new Types.ObjectId(tenderId),
    });
    if (!workflow) throw new AppError('Signing workflow not found', 404);
    return workflow;
  }

  private toWorkflowDto(workflow: IPreparationSigningWorkflow) {
    return {
      id: String(workflow._id),
      tenderId: String(workflow.tenderId),
      documentId: String(workflow.documentId),
      documentName: workflow.documentName,
      title: workflow.title,
      status: workflow.status,
      steps: workflow.steps.map((s) => ({
        order: s.order,
        role: s.role,
        label: s.label,
        assignedUserId: s.assignedUserId ? String(s.assignedUserId) : undefined,
        assignedUserName: s.assignedUserName,
        status: s.status,
        signedAt: s.signedAt?.toISOString(),
        signatureId: s.signatureId ? String(s.signatureId) : undefined,
        rejectionReason: s.rejectionReason,
      })),
      currentStepIndex: workflow.currentStepIndex,
      signedDocumentId: workflow.signedDocumentId ? String(workflow.signedDocumentId) : undefined,
      createdBy: String(workflow.createdBy),
      startedAt: workflow.startedAt?.toISOString(),
      completedAt: workflow.completedAt?.toISOString(),
      createdAt: workflow.createdAt?.toISOString(),
      updatedAt: workflow.updatedAt?.toISOString(),
    };
  }

  private toSignatureDto(sig: InstanceType<typeof PreparationSignature>) {
    return {
      id: String(sig._id),
      tenderId: String(sig.tenderId),
      documentId: String(sig.documentId),
      workflowId: sig.workflowId ? String(sig.workflowId) : undefined,
      signerUserId: String(sig.signerUserId),
      signerName: sig.signerName,
      signerRole: sig.signerRole,
      signatureType: sig.signatureType,
      signedDocumentId: sig.signedDocumentId ? String(sig.signedDocumentId) : undefined,
      certificateInfo: sig.certificateInfo,
      dscTokenId: sig.dscTokenId,
      verificationStatus: sig.verificationStatus,
      verificationMessage: sig.verificationMessage,
      signedAt: sig.signedAt.toISOString(),
      createdAt: sig.createdAt?.toISOString(),
    };
  }

  async createWorkflow(
    tenderId: string,
    ctx: RequestContext,
    input: {
      documentId: string;
      title?: string;
      steps?: Array<{ role: SignerRole; label?: string; assignedUserId?: string }>;
    }
  ) {
    await documentPreparationService.assertDocumentExists(tenderId, input.documentId);
    const doc = await PreparationDocument.findById(input.documentId);
    if (!doc) throw new AppError('Document not found', 404);

    const steps = await buildWorkflowSteps(input.steps);
    const workflow = await PreparationSigningWorkflow.create({
      tenderId: new Types.ObjectId(tenderId),
      documentId: doc._id,
      documentName: doc.displayName,
      title: input.title?.trim() || `Signing — ${doc.displayName}`,
      status: 'draft',
      steps,
      currentStepIndex: 0,
      createdBy: ctx.userId,
    });

    await preparationAuditService.log({
      userId: ctx.userId,
      userRole: ctx.userRole,
      action: 'workflow_created',
      tenderId,
      documentId: input.documentId,
      workflowId: String(workflow._id),
      ipAddress: ctx.ipAddress,
      metadata: { title: workflow.title, steps: steps.length },
    });

    return this.toWorkflowDto(workflow);
  }

  async listWorkflows(tenderId: string, documentId?: string) {
    const query: Record<string, unknown> = { tenderId: new Types.ObjectId(tenderId) };
    if (documentId) query.documentId = new Types.ObjectId(documentId);
    const workflows = await PreparationSigningWorkflow.find(query).sort({ createdAt: -1 });
    return workflows.map((w) => this.toWorkflowDto(w));
  }

  async getWorkflow(tenderId: string, workflowId: string) {
    const workflow = await this.getWorkflowForTender(tenderId, workflowId);
    return this.toWorkflowDto(workflow);
  }

  async startWorkflow(tenderId: string, workflowId: string, ctx: RequestContext) {
    const workflow = await this.getWorkflowForTender(tenderId, workflowId);
    if (workflow.status !== 'draft') throw new AppError('Workflow has already been started', 400);

    workflow.status = 'in_progress';
    workflow.startedAt = new Date();
    workflow.currentStepIndex = 0;
    workflow.steps.forEach((s, i) => {
      s.status = i === 0 ? 'active' : 'pending';
    });
    await workflow.save();
    await notifyNextSigner(workflow, tenderId);

    await preparationAuditService.log({
      userId: ctx.userId,
      userRole: ctx.userRole,
      action: 'workflow_started',
      tenderId,
      documentId: String(workflow.documentId),
      workflowId: String(workflow._id),
      ipAddress: ctx.ipAddress,
    });

    return this.toWorkflowDto(workflow);
  }

  async cancelWorkflow(tenderId: string, workflowId: string, ctx: RequestContext) {
    const workflow = await this.getWorkflowForTender(tenderId, workflowId);
    if (['completed', 'cancelled'].includes(workflow.status)) {
      throw new AppError('Workflow cannot be cancelled', 400);
    }
    workflow.status = 'cancelled';
    workflow.cancelledAt = new Date();
    await workflow.save();

    await preparationAuditService.log({
      userId: ctx.userId,
      userRole: ctx.userRole,
      action: 'workflow_cancelled',
      tenderId,
      documentId: String(workflow.documentId),
      workflowId: String(workflow._id),
      ipAddress: ctx.ipAddress,
    });

    return this.toWorkflowDto(workflow);
  }

  async applyElectronicSignature(
    tenderId: string,
    workflowId: string,
    ctx: RequestContext,
    input: {
      signatureImageBase64: string;
      pageNumber?: number;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }
  ) {
    const workflow = await this.getWorkflowForTender(tenderId, workflowId);
    const step = assertSignerAuthorized(workflow, ctx.userId, ctx.userRole);

    const sourceDocId = workflow.signedDocumentId
      ? String(workflow.signedDocumentId)
      : String(workflow.documentId);
    const { buffer } = await documentPreparationService.getDocumentFile(tenderId, sourceDocId);

    const pngData = input.signatureImageBase64.replace(/^data:image\/png;base64,/, '');
    const signaturePng = Buffer.from(pngData, 'base64');
    const { buffer: signedBuffer } = await embedSignatureImage(buffer, signaturePng, {
      pageNumber: input.pageNumber ?? 1,
      x: input.x ?? 72,
      y: input.y ?? 72,
      width: input.width ?? 180,
      height: input.height ?? 60,
    });

    const signedDoc = await this.persistSignedDocument(
      tenderId,
      ctx.userId,
      signedBuffer,
      workflow.documentName,
      'signed',
      { workflowId: String(workflow._id), signatureType: 'electronic' }
    );

    const signatureImagePath = await this.storeSignatureImage(
      tenderId,
      String(workflow.documentId),
      signaturePng
    );

    const signature = await PreparationSignature.create({
      tenderId: new Types.ObjectId(tenderId),
      documentId: workflow.documentId,
      workflowId: workflow._id,
      signerUserId: ctx.userId,
      signerName: ctx.userName,
      signerRole: step.role,
      signatureType: 'electronic',
      signatureImagePath,
      signedDocumentId: new Types.ObjectId(signedDoc.id),
      verificationStatus: 'verified',
      verificationMessage: 'Electronic signature applied',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      signedAt: new Date(),
    });

    step.status = 'signed';
    step.signedAt = new Date();
    step.signatureId = signature._id;
    workflow.signedDocumentId = new Types.ObjectId(signedDoc.id);
    workflow.markModified('steps');
    await workflow.save();

    const advanced = await advanceWorkflow(workflow, tenderId);
    if (advanced.status === 'completed') {
      await preparationAuditService.log({
        userId: ctx.userId,
        userRole: ctx.userRole,
        action: 'workflow_completed',
        tenderId,
        documentId: String(workflow.documentId),
        workflowId: String(workflow._id),
        ipAddress: ctx.ipAddress,
      });
    }

    await preparationAuditService.log({
      userId: ctx.userId,
      userRole: ctx.userRole,
      action: 'esign_applied',
      tenderId,
      documentId: String(workflow.documentId),
      workflowId: String(workflow._id),
      signatureId: String(signature._id),
      ipAddress: ctx.ipAddress,
      metadata: { signerRole: step.role },
    });

    return {
      workflow: this.toWorkflowDto(advanced),
      signature: this.toSignatureDto(signature),
      signedDocument: signedDoc,
    };
  }

  async applyDscSignature(
    tenderId: string,
    workflowId: string,
    ctx: RequestContext,
    input: {
      certificatePem: string;
      signatureBase64: string;
      dscTokenId?: string;
      documentHashBase64?: string;
      signedPdfBase64?: string;
    }
  ) {
    const workflow = await this.getWorkflowForTender(tenderId, workflowId);
    const step = assertSignerAuthorized(workflow, ctx.userId, ctx.userRole);

    const verification = verifyDscSignaturePayload(
      input.certificatePem,
      input.signatureBase64,
      input.documentHashBase64
    );

    let signedDoc;
    if (input.signedPdfBase64) {
      const pdfBuffer = Buffer.from(input.signedPdfBase64, 'base64');
      signedDoc = await this.persistSignedDocument(
        tenderId,
        ctx.userId,
        pdfBuffer,
        workflow.documentName,
        'dsc_signed',
        { workflowId: String(workflow._id), signatureType: 'dsc', dscTokenId: input.dscTokenId }
      );
    } else {
      const sourceDocId = workflow.signedDocumentId
        ? String(workflow.signedDocumentId)
        : String(workflow.documentId);
      const { buffer } = await documentPreparationService.getDocumentFile(tenderId, sourceDocId);
      signedDoc = await this.persistSignedDocument(
        tenderId,
        ctx.userId,
        buffer,
        workflow.documentName,
        'dsc_signed',
        {
          workflowId: String(workflow._id),
          signatureType: 'dsc',
          dscTokenId: input.dscTokenId,
          certificateThumbprint: verification.certificateInfo.thumbprint,
        }
      );
    }

    const signature = await PreparationSignature.create({
      tenderId: new Types.ObjectId(tenderId),
      documentId: workflow.documentId,
      workflowId: workflow._id,
      signerUserId: ctx.userId,
      signerName: ctx.userName,
      signerRole: step.role,
      signatureType: 'dsc',
      signedDocumentId: new Types.ObjectId(signedDoc.id),
      certificateInfo: verification.certificateInfo,
      dscTokenId: input.dscTokenId,
      verificationStatus: verification.valid ? 'verified' : 'failed',
      verificationMessage: verification.message,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { signatureBase64Length: input.signatureBase64.length },
      signedAt: new Date(),
    });

    step.status = 'signed';
    step.signedAt = new Date();
    step.signatureId = signature._id;
    workflow.signedDocumentId = new Types.ObjectId(signedDoc.id);
    workflow.markModified('steps');
    await workflow.save();

    const advanced = await advanceWorkflow(workflow, tenderId);

    await preparationAuditService.log({
      userId: ctx.userId,
      userRole: ctx.userRole,
      action: 'dsc_signed',
      tenderId,
      documentId: String(workflow.documentId),
      workflowId: String(workflow._id),
      signatureId: String(signature._id),
      ipAddress: ctx.ipAddress,
      metadata: {
        certificateClass: verification.certificateClass,
        dscTokenId: input.dscTokenId,
      },
    });

    return {
      workflow: this.toWorkflowDto(advanced),
      signature: this.toSignatureDto(signature),
      signedDocument: signedDoc,
      verification,
    };
  }

  async verifyDocumentDsc(tenderId: string, documentId: string, certificatePem: string) {
    await documentPreparationService.assertDocumentExists(tenderId, documentId);
    return verifyDscCertificate(certificatePem);
  }

  async getSignatureHistory(tenderId: string, documentId: string) {
    await documentPreparationService.assertDocumentExists(tenderId, documentId);
    const signatures = await PreparationSignature.find({
      tenderId: new Types.ObjectId(tenderId),
      documentId: new Types.ObjectId(documentId),
    })
      .sort({ signedAt: -1 })
      .lean();
    return signatures.map((s) => ({
      id: String(s._id),
      workflowId: s.workflowId ? String(s.workflowId) : undefined,
      signerName: s.signerName,
      signerRole: s.signerRole,
      signatureType: s.signatureType,
      verificationStatus: s.verificationStatus,
      verificationMessage: s.verificationMessage,
      certificateInfo: s.certificateInfo,
      dscTokenId: s.dscTokenId,
      signedDocumentId: s.signedDocumentId ? String(s.signedDocumentId) : undefined,
      signedAt: s.signedAt.toISOString(),
    }));
  }

  async getWorkflowAuditTrail(tenderId: string, workflowId: string) {
    return preparationAuditService.getDocumentAuditTrail({ tenderId, workflowId });
  }

  async getDocumentAuditLogs(tenderId: string, documentId: string, page = 1, limit = 50) {
    await documentPreparationService.assertDocumentExists(tenderId, documentId);
    return preparationAuditService.getDocumentAuditTrail({ tenderId, documentId, page, limit });
  }

  async saveMarkup(
    tenderId: string,
    ctx: RequestContext,
    input: {
      documentId: string;
      markupType: 'annotation' | 'highlight' | 'redaction' | 'stamp';
      regions: MarkupRegionInput[];
      outputName?: string;
    }
  ) {
    await documentPreparationService.assertDocumentExists(tenderId, input.documentId);
    if (!input.regions?.length) throw new AppError('At least one markup region is required', 400);

    const result = await documentPreparationService.applyAdvancedMarkup(
      tenderId,
      ctx.userId,
      input
    );

    await PreparationDocumentMarkup.create({
      tenderId: new Types.ObjectId(tenderId),
      documentId: new Types.ObjectId(input.documentId),
      markupType: input.markupType,
      regions: toMarkupRegions(input.regions),
      appliedDocumentId: new Types.ObjectId(result.id),
      createdBy: ctx.userId,
    });

    const actionMap = {
      redaction: 'pdf_redacted',
      annotation: 'pdf_annotated',
      highlight: 'pdf_highlighted',
      stamp: 'pdf_stamped',
    } as const;

    await preparationAuditService.log({
      userId: ctx.userId,
      userRole: ctx.userRole,
      action: actionMap[input.markupType],
      tenderId,
      documentId: input.documentId,
      ipAddress: ctx.ipAddress,
      metadata: { regionCount: input.regions.length, outputDocumentId: result.id },
    });

    return result;
  }

  private async persistSignedDocument(
    tenderId: string,
    userId: Types.ObjectId,
    buffer: Buffer,
    displayName: string,
    source: PreparationDocumentSource,
    metadata: Record<string, unknown>
  ) {
    return documentPreparationService.saveDerivedPdf(
      tenderId,
      userId,
      buffer,
      `${displayName}_${source}`,
      source,
      metadata
    );
  }

  private async storeSignatureImage(tenderId: string, documentId: string, png: Buffer) {
    const folder = preparationFolder(tenderId);
    const fileName = `signature_${documentId}_${Date.now()}.png`;
    const stored = await fileStorageService.saveFile(png, fileName, folder);
    return stored.relativePath;
  }
}

export const preparationSigningService = new PreparationSigningService();
