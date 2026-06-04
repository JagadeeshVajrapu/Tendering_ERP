import { z } from 'zod';

export const uploadTenderSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(300).optional(),
    tenderId: z.string().optional(),
  }),
});

export const tenderIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const mdDecisionSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    remarks: z.string().max(2000).optional().default(''),
  }),
});
