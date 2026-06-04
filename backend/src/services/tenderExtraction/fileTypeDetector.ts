export type DetectedFileType = 'digital_pdf' | 'scanned_pdf' | 'docx' | 'image' | 'unknown';

export function detectByMimeAndExt(mimeType: string, fileName: string): DetectedFileType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (mimeType === 'application/pdf' || ext === 'pdf') return 'digital_pdf';
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    return 'docx';
  }
  if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'tiff', 'bmp'].includes(ext)) return 'image';
  return 'unknown';
}

