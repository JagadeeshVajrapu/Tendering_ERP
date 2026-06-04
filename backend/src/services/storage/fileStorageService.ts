import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { resolveUploadsRoot } from '../../config/upload';

class FileStorageService {
  private get root(): string {
    return resolveUploadsRoot();
  }

  async ensureDir(subfolder: string): Promise<string> {
    const dir = path.join(this.root, subfolder);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async saveFile(
    buffer: Buffer,
    originalName: string,
    subfolder = 'tenders'
  ): Promise<{ fileName: string; filePath: string; relativePath: string }> {
    const dir = await this.ensureDir(subfolder);
    const ext = originalName.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${uuidv4()}.${ext}`;
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, buffer);

    return {
      fileName,
      filePath,
      relativePath: path.join(subfolder, fileName).replace(/\\/g, '/'),
    };
  }

  async saveReportPdf(
    buffer: Buffer,
    tenderId: string
  ): Promise<{ filePath: string; relativePath: string; fileName: string }> {
    const dir = await this.ensureDir('reports');
    const fileName = `feasibility-${tenderId}-${Date.now()}.pdf`;
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, buffer);

    return {
      fileName,
      filePath,
      relativePath: path.join('reports', fileName).replace(/\\/g, '/'),
    };
  }

  getPublicUrl(relativePath: string): string {
    return `/uploads/${relativePath}`;
  }

  getAbsolutePath(relativePath: string): string {
    return path.join(this.root, relativePath);
  }
}

export const fileStorageService = new FileStorageService();
