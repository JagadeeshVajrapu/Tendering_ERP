import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const destDir = path.join(root, 'public');
const dest = path.join(destDir, 'pdf.worker.min.mjs');

if (!fs.existsSync(src)) {
  console.warn('[copy-pdf-worker] pdfjs-dist worker not found, skipping');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('[copy-pdf-worker] copied to public/pdf.worker.min.mjs');
