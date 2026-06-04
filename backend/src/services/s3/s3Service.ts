import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';

class S3Service {
  private client: S3Client | null = null;

  private getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: env.aws.region,
        credentials: env.aws.accessKeyId
          ? { accessKeyId: env.aws.accessKeyId, secretAccessKey: env.aws.secretAccessKey }
          : undefined,
      });
    }
    return this.client;
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder = 'documents'
  ): Promise<{ key: string; url: string }> {
    const ext = originalName.split('.').pop() || 'bin';
    const key = `${folder}/${uuidv4()}.${ext}`;

    if (!env.aws.accessKeyId) {
      return { key, url: `local://${key}` };
    }

    try {
      await this.getClient().send(
        new PutObjectCommand({
          Bucket: env.aws.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        })
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/NoSuchBucket/i.test(msg) || /The specified bucket does not exist/i.test(msg)) {
        throw new AppError(
          `S3 bucket "${env.aws.bucket}" does not exist. Create it in AWS or change AWS_S3_BUCKET in backend/.env. (Dev fallback: clear AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY to use local storage.)`,
          500
        );
      }
      throw err;
    }

    const url = `https://${env.aws.bucket}.s3.${env.aws.region}.amazonaws.com/${key}`;
    return { key, url };
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!env.aws.accessKeyId) return `local://${key}`;
    const command = new GetObjectCommand({ Bucket: env.aws.bucket, Key: key });
    return getSignedUrl(this.getClient(), command, { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    if (!env.aws.accessKeyId) return;
    await this.getClient().send(new DeleteObjectCommand({ Bucket: env.aws.bucket, Key: key }));
  }
}

export const s3Service = new S3Service();
