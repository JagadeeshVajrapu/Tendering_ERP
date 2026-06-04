import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { AppError } from './errorHandler';

export type ValidatedRequest<T> = Request & { validated: T };

export function validate<T extends ZodSchema>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      if (!result.success) {
        next(formatZodError(result.error));
        return;
      }

      (req as ValidatedRequest<typeof result.data>).validated = result.data;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function formatZodError(error: ZodError): AppError {
  const messages = error.errors.map((e) => {
    const path = e.path.filter((p) => p !== 'body' && p !== 'params' && p !== 'query').join('.');
    return path ? `${path}: ${e.message}` : e.message;
  });
  return new AppError(messages.join('; '), 400);
}
