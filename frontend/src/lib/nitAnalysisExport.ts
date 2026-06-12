import * as XLSX from 'xlsx';
import type { NitAnalysisReport } from '@/types/nitAnalysisReport';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function rowsMatrix(report: NitAnalysisReport) {
  const headers = [
    'Section',
    'Intelligence',
    'Parameter',
    'Value',
    'Page',
    'Confidence',
    'Confidence Label',
    'Validation Status',
    'Category',
    'Type',
  ];

  const data = report.sections.flatMap((section) =>
    section.fields.map((row) => [
      section.title,
      section.intelligenceLabel || section.title,
      row.label,
      row.value,
      row.sourcePage || '',
      row.confidence,
      row.confidenceLabel || '',
      row.validationDisplay || row.validationStatus || '',
      row.category || '',
      row.parameterType || '',
    ])
  );

  return [headers, ...data];
}

export function exportNitAnalysisJson(report: NitAnalysisReport, filename: string) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${filename}.json`);
}

export function exportNitAnalysisExcel(report: NitAnalysisReport, filename: string) {
  const matrix = rowsMatrix(report);
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  worksheet['!cols'] = [
    { wch: 18 },
    { wch: 24 },
    { wch: 28 },
    { wch: 40 },
    { wch: 8 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 10 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'NIT Analysis');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportNitAnalysisCsv(report: NitAnalysisReport, filename: string) {
  const matrix = rowsMatrix(report);
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = matrix.map((line) => line.map(esc).join(',')).join('\r\n');
  triggerDownload(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

export async function exportNitAnalysisPdfFromApi(
  token: string,
  tenderId: string,
  filename: string
) {
  const res = await fetch(`${API_URL}/tender/${tenderId}/nit-analysis/export?format=pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('PDF export failed');
  const blob = await res.blob();
  triggerDownload(blob, `${filename}.pdf`);
}
