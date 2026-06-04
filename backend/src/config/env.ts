import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
  port: parseInt(process.env.PORT || '5001', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/tender-erp',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  /** Extra CORS origins (comma-separated), e.g. http://172.28.80.1:3001 */
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  uploads: {
    dir: process.env.UPLOADS_DIR || '',
    maxFileSizeMb: parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || '25', 10),
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    bucket: process.env.AWS_S3_BUCKET || 'tender-erp-documents',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    /** Set to false to always use local document analysis (no OpenAI calls) */
    enabled: process.env.OPENAI_ENABLED !== 'false',
    /** Fall back to local analysis when OpenAI returns quota/auth/rate errors */
    fallbackOnError: process.env.OPENAI_FALLBACK_ON_ERROR !== 'false',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    enabled: process.env.GEMINI_ENABLED !== 'false',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@tendererp.com',
  },
  company: {
    turnover: parseFloat(process.env.COMPANY_TURNOVER || '50000000'),
    experienceYears: parseInt(process.env.COMPANY_EXPERIENCE_YEARS || '10', 10),
    hasIso: process.env.COMPANY_HAS_ISO === 'true',
    isMsme: process.env.COMPANY_IS_MSME === 'true',
    hasGst: process.env.COMPANY_HAS_GST !== 'false',
    hasPan: process.env.COMPANY_HAS_PAN !== 'false',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    enabled: process.env.REDIS_ENABLED !== 'false',
    workerConcurrency: parseInt(process.env.REDIS_WORKER_CONCURRENCY || '2', 10),
  },
  intelligence: {
    chunkSizePages: parseInt(process.env.INTELLIGENCE_CHUNK_PAGES || '5', 10),
    confidenceThreshold: parseFloat(process.env.INTELLIGENCE_CONFIDENCE_THRESHOLD || '0.55'),
    chunkConcurrency: parseInt(process.env.INTELLIGENCE_CHUNK_CONCURRENCY || '6', 10),
    fieldConcurrency: parseInt(process.env.INTELLIGENCE_FIELD_CONCURRENCY || '8', 10),
    pageConcurrency: parseInt(process.env.INTELLIGENCE_PAGE_CONCURRENCY || '6', 10),
  },
  cache: {
    enabled: process.env.PIPELINE_CACHE_ENABLED !== 'false',
    ocrTtlSec: parseInt(process.env.CACHE_TTL_OCR_SECONDS || '86400', 10),
    openaiTtlSec: parseInt(process.env.CACHE_TTL_OPENAI_SECONDS || '604800', 10),
  },
  ocr: {
    minQualityScore: parseInt(process.env.OCR_MIN_QUALITY_SCORE || '70', 10),
  },
};
