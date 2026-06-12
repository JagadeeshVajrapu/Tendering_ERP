import * as XLSX from 'xlsx';
import type { DynamicChecklistResult } from '@/types/dynamicChecklist';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportChecklistJson(result: DynamicChecklistResult, filename: string) {
  triggerDownload(
    new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }),
    `${filename}.json`
  );
}

export function exportChecklistExcel(result: DynamicChecklistResult, filename: string) {
  const headers = ['Section', 'Document', 'Required', 'Status', 'Critical', 'Uploaded File', 'Source'];
  const rows = result.categories.flatMap((cat) =>
    cat.items.map((item) => [
      cat.title,
      item.name,
      item.required ? 'Yes' : 'No',
      item.status,
      item.critical ? 'Yes' : 'No',
      item.matchedFileName || '',
      item.source,
    ])
  );
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Checklist');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export async function exportChecklistPdf(
  token: string,
  tenderId: string,
  filename: string,
  sectionId?: string
) {
  const qs = sectionId ? `?format=pdf&section=${sectionId}` : '?format=pdf';
  const res = await fetch(`${API_URL}/tender/${tenderId}/dynamic-checklist/export${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Checklist PDF export failed');
  triggerDownload(await res.blob(), `${filename}${sectionId ? `_${sectionId}` : ''}.pdf`);
}
