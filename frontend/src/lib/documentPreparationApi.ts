const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

async function requestBlob(endpoint: string, token: string): Promise<Blob> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let message = 'Request failed';
    try {
      const data = await res.json();
      message = data.message || message;
    } catch {
      message = `Request failed (${res.status})`;
    }
    throw new Error(message);
  }
  return res.blob();
}

export async function fetchPreparationPdfBlob(
  token: string,
  tenderId: string,
  documentId: string
): Promise<Blob> {
  return requestBlob(
    `/tender/${tenderId}/document-preparation/documents/${documentId}/preview`,
    token
  );
}

export async function downloadPreparationPdf(
  token: string,
  tenderId: string,
  documentId: string,
  fileName: string
): Promise<void> {
  const blob = await requestBlob(
    `/tender/${tenderId}/document-preparation/documents/${documentId}/download`,
    token
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
