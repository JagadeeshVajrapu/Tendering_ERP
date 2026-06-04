import * as XLSX from 'xlsx';
import type { DatasetRowView } from '@/types/masterDataset';

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowsToMatrix(rows: DatasetRowView[]) {
  const headers = [
    'Section',
    'Parameter',
    'Value',
    'Confidence',
    'Source Page',
    'Source Text',
    'Validation Result',
    'Extraction Method',
  ];

  const data = rows.map((row) => [
    row.sectionTitle,
    row.parameter,
    row.field.value || '—',
    row.field.value ? String(row.field.confidence) : '—',
    row.field.sourcePage ? String(row.field.sourcePage) : '—',
    row.field.sourceText || '—',
    row.field.validationResult || '—',
    row.field.extractionMethod || '—',
  ]);

  return [headers, ...data];
}

export function exportDatasetCsv(rows: DatasetRowView[], filename: string) {
  const matrix = rowsToMatrix(rows);
  const csv = matrix.map((line) => line.map((cell) => escapeCsvCell(String(cell))).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

export function exportDatasetExcel(rows: DatasetRowView[], filename: string) {
  const matrix = rowsToMatrix(rows);
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  worksheet['!cols'] = [
    { wch: 22 },
    { wch: 28 },
    { wch: 40 },
    { wch: 12 },
    { wch: 12 },
    { wch: 50 },
    { wch: 28 },
    { wch: 18 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Dataset');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
