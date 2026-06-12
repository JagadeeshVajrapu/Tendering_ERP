import { Types } from 'mongoose';
import { AppError } from '../../middleware/errorHandler';
import { TenderChecklistItemState } from '../../models/TenderChecklistItemState';
import { ChecklistItemWorkflowUpdate } from '../../types/dynamicChecklist';
import { UserRole } from '../../types';

class ChecklistWorkflowService {
  async loadStates(documentId: Types.ObjectId) {
    return TenderChecklistItemState.find({ documentId }).lean();
  }

  async applyUpdate(
    documentId: Types.ObjectId,
    tenderId: Types.ObjectId,
    userId: Types.ObjectId,
    userRole: UserRole,
    update: ChecklistItemWorkflowUpdate
  ) {
    if (update.action === 'mark_complete') {
      if (
        userRole !== UserRole.EXECUTIVE &&
        userRole !== UserRole.MD &&
        userRole !== UserRole.MANAGER
      ) {
        throw new AppError('Only executives or managers can mark checklist items complete', 403);
      }
      return TenderChecklistItemState.findOneAndUpdate(
        { documentId, itemId: update.itemId },
        {
          $set: {
            documentId,
            tenderId,
            itemId: update.itemId,
            markedComplete: true,
            markedCompleteBy: userId,
            markedCompleteAt: new Date(),
            reviewStatus: 'pending',
            linkedDocumentId: update.documentId ? new Types.ObjectId(update.documentId) : undefined,
          },
        },
        { upsert: true, new: true }
      );
    }

    if (update.action === 'unmark_complete') {
      if (
        userRole !== UserRole.EXECUTIVE &&
        userRole !== UserRole.MD &&
        userRole !== UserRole.MANAGER
      ) {
        throw new AppError('Only executives or managers can unmark checklist items', 403);
      }
      return TenderChecklistItemState.findOneAndUpdate(
        { documentId, itemId: update.itemId },
        {
          $set: {
            documentId,
            tenderId,
            itemId: update.itemId,
            markedComplete: false,
          },
          $unset: {
            markedCompleteBy: '',
            markedCompleteAt: '',
            reviewStatus: '',
            linkedDocumentId: '',
          },
        },
        { upsert: true, new: true }
      );
    }

    if (update.action === 'approve') {
      if (userRole !== UserRole.MANAGER && userRole !== UserRole.MD) {
        throw new AppError('Only managers can approve checklist documents', 403);
      }
      return TenderChecklistItemState.findOneAndUpdate(
        { documentId, itemId: update.itemId },
        {
          $set: {
            documentId,
            tenderId,
            itemId: update.itemId,
            reviewStatus: 'approved',
            reviewedBy: userId,
            reviewedAt: new Date(),
            reviewNote: update.note || '',
          },
        },
        { upsert: true, new: true }
      );
    }

    if (update.action === 'reject' || update.action === 'request_reupload') {
      if (userRole !== UserRole.MANAGER && userRole !== UserRole.MD) {
        throw new AppError('Only managers can reject checklist documents', 403);
      }
      return TenderChecklistItemState.findOneAndUpdate(
        { documentId, itemId: update.itemId },
        {
          $set: {
            documentId,
            tenderId,
            itemId: update.itemId,
            markedComplete: false,
            reviewStatus: 'rejected',
            reviewedBy: userId,
            reviewedAt: new Date(),
            reviewNote: update.note || 'Re-upload requested',
          },
        },
        { upsert: true, new: true }
      );
    }

    throw new AppError('Invalid checklist workflow action', 400);
  }
}

export const checklistWorkflowService = new ChecklistWorkflowService();
