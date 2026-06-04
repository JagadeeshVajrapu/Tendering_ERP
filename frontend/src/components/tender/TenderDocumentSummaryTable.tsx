'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TenderAnalysis } from '@/types';

const PLACEHOLDER = /^(not specified|n\/a|na|—|-)$/i;

function cleanValue(value?: string): string {
  if (!value?.trim()) return '';
  const trimmed = value.trim();
  return PLACEHOLDER.test(trimmed) ? '' : trimmed;
}

export function dedupeList(items?: string[]): string[] {
  if (!items?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of items) {
    const parts = raw.includes(',') && raw.length < 120 ? raw.split(/[,;|•]+/) : [raw];
    for (const part of parts) {
      const item = part.trim().replace(/\s+/g, ' ');
      if (item.length < 2) continue;
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      const dupIdx = result.findIndex((existing) => {
        const ek = existing.toLowerCase();
        if (ek === key) return true;
        if (item.length <= 25 && ek.length <= 25) return ek.includes(key) || key.includes(ek);
        if (item.length > 40 && ek.length > 40) return ek.includes(key) || key.includes(ek);
        return false;
      });
      if (dupIdx >= 0) {
        if (item.length > result[dupIdx].length) {
          seen.delete(result[dupIdx].toLowerCase());
          seen.add(key);
          result[dupIdx] = item;
        }
        continue;
      }
      seen.add(key);
      result.push(item);
    }
  }
  return result.slice(0, 12);
}

function formatList(items?: string[]): string {
  const unique = dedupeList(items);
  if (!unique.length) return '—';
  return unique.join(', ');
}

function formatYesNo(value?: string): string {
  const cleaned = cleanValue(value);
  if (!cleaned) return '—';
  const lower = cleaned.toLowerCase();
  if (lower === 'true' || lower === 'yes' || lower === 'required') return 'Yes';
  if (lower === 'false' || lower === 'no' || lower === 'not required') return 'No';
  return cleaned;
}

function displayField(value?: string): string {
  return cleanValue(value) || '—';
}

export function buildTenderSummaryRows(analysis: TenderAnalysis): { parameter: string; value: string }[] {
  const eligibility = dedupeList(analysis.eligibilityCriteria);
  const technical = dedupeList(analysis.technicalRequirements);

  const submissionDate =
    cleanValue(analysis.bidSubmissionDate) ||
    analysis.importantDates?.find((d) => /submission|last date|closing/i.test(d.label))?.date ||
    '';

  const authority = cleanValue(analysis.organization) || cleanValue(analysis.department);

  return [
    { parameter: 'Tender Authority', value: authority || '—' },
    { parameter: 'Tender Value', value: displayField(analysis.estimatedValue) },
    { parameter: 'EMD Amount', value: displayField(analysis.emdAmount) },
    { parameter: 'BG Requirement', value: displayField(analysis.bgRequirement) },
    { parameter: 'Completion Time', value: displayField(analysis.contractDuration) },
    { parameter: 'Eligibility Criteria', value: formatList(eligibility) },
    { parameter: 'Technical Requirements', value: formatList(technical) },
    { parameter: 'Submission Date', value: submissionDate || '—' },
    { parameter: 'Reverse Auction', value: formatYesNo(analysis.reverseAuction) },
    { parameter: 'MAF Required', value: formatYesNo(analysis.mafRequired) },
    { parameter: 'Scope of Work', value: displayField(analysis.scopeOfWork) },
  ];
}

interface Props {
  analysis: TenderAnalysis;
  title?: string;
}

export function TenderDocumentSummaryTable({ analysis, title = 'Tender Document Summary' }: Props) {
  const rows = buildTenderSummaryRows(analysis);
  const filledCount = rows.filter((r) => r.value !== '—').length;

  return (
    <div className="overflow-hidden rounded-md border-2 border-black bg-white">
      {title && (
        <div className="flex items-center justify-between border-b-2 border-black px-4 py-2">
          <h3 className="text-base font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground">
            {filledCount}/{rows.length} fields extracted
          </span>
        </div>
      )}
      <Table className="border-collapse">
        <TableHeader>
          <TableRow className="border-b-2 border-black hover:bg-transparent">
            <TableHead className="w-1/2 border-r-2 border-black bg-white px-4 py-3 text-center font-bold text-black">
              Parameter
            </TableHead>
            <TableHead className="w-1/2 bg-white px-4 py-3 text-center font-bold text-black">
              Value
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.parameter} className="border-b border-black hover:bg-transparent">
              <TableCell className="border-r border-black px-4 py-3 align-top font-medium text-black">
                {row.parameter}
              </TableCell>
              <TableCell
                className={`px-4 py-3 align-top ${row.value === '—' ? 'text-muted-foreground italic' : 'text-black'}`}
              >
                {row.value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
