import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/apiResponse';
import { paramId } from '../utils/params';
import { dynamicParameterDiscoveryService } from '../services/tenderParameter/dynamicParameterDiscoveryService';
import { getLearningRegistrySummary } from '../services/tenderParameter/dynamicParameterLearningRegistry';
import { DYNAMIC_PARAMETER_REGISTRY } from '../foundation/masterParameterRegistry';
import { getBusinessRelevantDiscoveryRuleSummary } from '../services/tenderParameter/businessRelevantDynamicParameterEngine';
import { GENUINE_REQUIREMENT_QUESTION } from '../services/tenderParameter/dynamicParameterAiEvaluator';

/** GET /api/debug/:documentId/dynamic-parameter-discovery */
export const getDocumentDynamicParameterDiscovery = asyncHandler(async (req: AuthRequest, res: Response) => {
  const documentId = paramId(req.params.documentId);
  const result = await dynamicParameterDiscoveryService.getDiscoveryDashboard(documentId);
  sendSuccess(res, result);
});

/** GET /api/tender/foundation/dynamic-parameter-registry */
export const getFoundationDynamicParameterRegistry = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const learning = await getLearningRegistrySummary(100);
  sendSuccess(res, {
    staticRegistry: DYNAMIC_PARAMETER_REGISTRY,
    learningRegistry: learning,
    businessRelevantDiscovery: {
      ...getBusinessRelevantDiscoveryRuleSummary(),
      aiGateQuestion: GENUINE_REQUIREMENT_QUESTION,
    },
  });
});
