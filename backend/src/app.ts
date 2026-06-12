import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env, httpLogger, resolveUploadsRoot } from './config';
import { corsOriginCallback } from './config/cors';
import { connectRedis, isRedisAvailable } from './config/redis';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import tenderRoutes from './routes/tenderRoutes';
import tenderAnalysisRoutes from './routes/tenderAnalysisRoutes';
import approvalRoutes from './routes/approvalRoutes';
import notificationRoutes from './routes/notificationRoutes';
import jobRoutes from './routes/jobRoutes';
import tenderExtractionRoutes from './routes/tenderExtractionRoutes';
import debugRoutes from './routes/debugRoutes';
import documentRoutes from './routes/documentRoutes';
import financeWorkflowRoutes from './routes/financeWorkflowRoutes';

const app = express();

app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: corsOriginCallback,
    credentials: true,
  })
);
app.use(httpLogger);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.isProduction ? 200 : 3000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests' },
  })
);

app.get('/health', async (_req, res) => {
  let redis = 'disabled';
  if (env.redis.enabled) {
    if (isRedisAvailable()) {
      redis = 'connected';
    } else {
      const ok = await connectRedis();
      redis = ok ? 'connected' : 'unavailable';
    }
  }

  res.json({
    success: true,
    message: 'TenderNova API is running',
    environment: env.nodeEnv,
    redis,
    workers: redis === 'connected' ? 'bullmq' : 'inline',
  });
});

app.use('/uploads', express.static(resolveUploadsRoot()));

app.use('/api/auth', authRoutes);
app.use('/api/tenders', tenderAnalysisRoutes);
app.use('/api/tenders', tenderRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/finance', financeWorkflowRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/tender', tenderExtractionRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/debug', debugRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
