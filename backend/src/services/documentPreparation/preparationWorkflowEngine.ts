import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { User } from '../../models/User';
import {
  IPreparationSigningWorkflow,
  IWorkflowStep,
  PreparationSigningWorkflow,
  SIGNER_ROLE_MAP,
  SignerRole,
} from '../../models/PreparationSigningWorkflow';
import { notificationService } from '../notification/notificationService';
import { NotificationType } from '../../types';

export const DEFAULT_SIGNING_CHAIN: Array<{ role: SignerRole; label: string }> = [
  { role: 'executive', label: 'Executive' },
  { role: 'manager', label: 'Manager' },
  { role: 'md', label: 'Director' },
];

export async function buildWorkflowSteps(
  customSteps?: Array<{ role: SignerRole; label?: string; assignedUserId?: string }>
): Promise<IWorkflowStep[]> {
  const chain = customSteps?.length ? customSteps : DEFAULT_SIGNING_CHAIN;

  const steps: IWorkflowStep[] = [];
  for (let i = 0; i < chain.length; i++) {
    const item = chain[i];
    let assignedUserId: Types.ObjectId | undefined;
    let assignedUserName: string | undefined;

    const assignedId = 'assignedUserId' in item ? item.assignedUserId : undefined;
    if (assignedId && Types.ObjectId.isValid(assignedId)) {
      const user = await User.findById(assignedId);
      if (user?.isActive) {
        assignedUserId = user._id;
        assignedUserName = user.name;
      }
    }

    if (!assignedUserId) {
      const user = await User.findOne({ role: SIGNER_ROLE_MAP[item.role], isActive: true }).sort({
        createdAt: 1,
      });
      if (user) {
        assignedUserId = user._id;
        assignedUserName = user.name;
      }
    }

    steps.push({
      order: i + 1,
      role: item.role,
      label:
        item.label ||
        DEFAULT_SIGNING_CHAIN.find((d) => d.role === item.role)?.label ||
        item.role,
      assignedUserId,
      assignedUserName,
      status: i === 0 ? 'active' : 'pending',
    });
  }

  return steps;
}

export function getActiveStep(workflow: IPreparationSigningWorkflow): IWorkflowStep | null {
  return workflow.steps[workflow.currentStepIndex] ?? null;
}

export async function notifyNextSigner(
  workflow: IPreparationSigningWorkflow,
  tenderId: string
): Promise<void> {
  const step = getActiveStep(workflow);
  if (!step?.assignedUserId) return;

  await notificationService.notifyUser(
    step.assignedUserId,
    NotificationType.DOCUMENT_SIGNING,
    'Document signing required',
    `Please sign "${workflow.documentName}" as ${step.label} in the ${workflow.title} workflow.`,
    'preparation_workflow',
    workflow._id
  );
}

export async function advanceWorkflow(
  workflow: IPreparationSigningWorkflow,
  tenderId: string
): Promise<IPreparationSigningWorkflow> {
  const nextIndex = workflow.currentStepIndex + 1;
  if (nextIndex >= workflow.steps.length) {
    workflow.status = 'completed';
    workflow.completedAt = new Date();
    workflow.currentStepIndex = workflow.steps.length - 1;
    await workflow.save();
    return workflow;
  }

  workflow.currentStepIndex = nextIndex;
  workflow.steps[nextIndex].status = 'active';
  await workflow.save();
  await notifyNextSigner(workflow, tenderId);
  return workflow;
}

export function assertSignerAuthorized(
  workflow: IPreparationSigningWorkflow,
  userId: Types.ObjectId,
  userRole: string
): IWorkflowStep {
  if (workflow.status !== 'in_progress') {
    throw new AppError('Workflow is not active for signing', 400);
  }

  const step = getActiveStep(workflow);
  if (!step) throw new AppError('No active signing step', 400);
  if (step.status !== 'active') throw new AppError('Current step is not awaiting signature', 400);

  const isAssigned = step.assignedUserId && String(step.assignedUserId) === String(userId);
  const roleMatches = step.role === userRole;
  if (!isAssigned && !roleMatches) {
    throw new AppError('You are not authorized to sign at this workflow step', 403);
  }

  return step;
}
