import { TextractClient, DetectDocumentTextCommand, StartDocumentTextDetectionCommand, GetDocumentTextDetectionCommand } from '@aws-sdk/client-textract';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

class TextractService {
  private client: TextractClient | null = null;

  private getClient(): TextractClient {
    if (!env.aws.accessKeyId) {
      throw new AppError('AWS credentials missing. Configure AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.', 500);
    }
    if (!this.client) {
      this.client = new TextractClient({
        region: env.aws.region,
        credentials: { accessKeyId: env.aws.accessKeyId, secretAccessKey: env.aws.secretAccessKey },
      });
    }
    return this.client;
  }

  async detectTextFromImageBytes(bytes: Buffer): Promise<string> {
    const res = await this.getClient().send(
      new DetectDocumentTextCommand({
        Document: { Bytes: bytes },
      })
    );
    const lines = (res.Blocks || [])
      .filter((b) => b.BlockType === 'LINE' && b.Text)
      .map((b) => b.Text!.trim())
      .filter(Boolean);
    return lines.join('\n').trim();
  }

  /**
   * For PDFs (and multi-page docs), Textract requires S3 + async job.
   * We poll for completion and return concatenated LINE blocks.
   */
  async detectTextFromS3Pdf(params: { bucket: string; key: string }): Promise<string> {
    const start = await this.getClient().send(
      new StartDocumentTextDetectionCommand({
        DocumentLocation: { S3Object: { Bucket: params.bucket, Name: params.key } },
      })
    );

    const jobId = start.JobId;
    if (!jobId) throw new AppError('Textract did not return a JobId for PDF processing.', 500);

    const deadline = Date.now() + 2 * 60 * 1000; // 2 minutes
    let nextToken: string | undefined;
    const lines: string[] = [];

    // Poll status first
    while (Date.now() < deadline) {
      const page = await this.getClient().send(
        new GetDocumentTextDetectionCommand({
          JobId: jobId,
          NextToken: nextToken,
          MaxResults: 1000,
        })
      );

      const status = page.JobStatus;
      if (status === 'FAILED') {
        throw new AppError('Textract failed to process the PDF.', 500);
      }
      if (status === 'IN_PROGRESS') {
        await sleep(1500);
        continue;
      }

      (page.Blocks || [])
        .filter((b) => b.BlockType === 'LINE' && b.Text)
        .forEach((b) => lines.push(b.Text!.trim()));

      nextToken = page.NextToken;
      if (!nextToken) break;
    }

    if (!lines.length) {
      throw new AppError('Textract returned no text for this PDF.', 400);
    }

    return lines.filter(Boolean).join('\n').trim();
  }

  /**
   * Like detectTextFromS3Pdf, but preserves Textract page numbers.
   * Returns a map: pageNumber -> page text.
   */
  async detectTextPagesFromS3Pdf(params: {
    bucket: string;
    key: string;
  }): Promise<{ pages: Record<number, string>; pageCount: number }> {
    const start = await this.getClient().send(
      new StartDocumentTextDetectionCommand({
        DocumentLocation: { S3Object: { Bucket: params.bucket, Name: params.key } },
      })
    );

    const jobId = start.JobId;
    if (!jobId) throw new AppError('Textract did not return a JobId for PDF processing.', 500);

    const deadline = Date.now() + 5 * 60 * 1000; // 5 minutes
    let nextToken: string | undefined;
    const byPage: Record<number, string[]> = {};

    while (Date.now() < deadline) {
      const page = await this.getClient().send(
        new GetDocumentTextDetectionCommand({
          JobId: jobId,
          NextToken: nextToken,
          MaxResults: 1000,
        })
      );

      const status = page.JobStatus;
      if (status === 'FAILED') throw new AppError('Textract failed to process the PDF.', 500);
      if (status === 'IN_PROGRESS') {
        await sleep(1500);
        continue;
      }

      for (const b of page.Blocks || []) {
        if (b.BlockType !== 'LINE' || !b.Text) continue;
        const p = Number(b.Page) || 1;
        byPage[p] ||= [];
        byPage[p].push(b.Text.trim());
      }

      nextToken = page.NextToken;
      if (!nextToken) break;
    }

    const pageNums = Object.keys(byPage).map(Number).sort((a, b) => a - b);
    const pageCount = pageNums.length ? pageNums[pageNums.length - 1] : 0;
    const pages: Record<number, string> = {};
    for (const p of pageNums) pages[p] = (byPage[p] || []).filter(Boolean).join('\n').trim();

    if (!pageNums.length) throw new AppError('Textract returned no text for this PDF.', 400);
    return { pages, pageCount };
  }
}

export const textractService = new TextractService();

