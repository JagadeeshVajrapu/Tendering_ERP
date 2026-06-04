'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  ExecutiveNitPresentation,
  NitRiskItem,
  NitSheetRow,
  NitSheetSection,
  TenderIntelligence,
} from '@/types';
import {
  getExecutiveNitSheet,
  getNitAnalysisSheet,
  getRecommendation,
  countFoundFields,
} from '@/lib/nitAnalysis';
import { FileSpreadsheet, Printer } from 'lucide-react';

interface Props {
  intelligence: TenderIntelligence;
  tenderTitle?: string;
}

const recStyles: Record<string, string> = {
  Apply: 'bg-emerald-600 text-white',
  'Apply with Caution': 'bg-amber-500 text-white',
  'Do Not Apply': 'bg-red-600 text-white',
};

const riskLevelStyles: Record<string, string> = {
  Low: 'bg-emerald-100 text-emerald-800',
  Medium: 'bg-amber-100 text-amber-800',
  High: 'bg-red-100 text-red-800',
};

type KeyNitRow = {
  parameter: string;
  value: string;
  confidence: number;
  sourcePage: string;
};

function KeyNitTable({ rows }: { rows: KeyNitRow[] }) {
  if (!rows.length) return null;
  return (
    <table className="w-full border-collapse border border-slate-900 text-sm print:text-xs">
      <thead>
        <tr className="bg-slate-100">
          <th className="w-[30%] border border-slate-900 px-3 py-2 text-left font-bold">Parameter</th>
          <th className="border border-slate-900 px-3 py-2 text-left font-bold">Value</th>
          <th className="w-28 border border-slate-900 px-3 py-2 text-left font-bold">Confidence</th>
          <th className="w-28 border border-slate-900 px-3 py-2 text-left font-bold">Source Page</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const low = row.confidence < 80;
          return (
            <tr key={row.parameter} className={low ? 'bg-amber-50' : ''}>
              <td className="border border-slate-900 px-3 py-2 font-semibold text-slate-800">
                {row.parameter}
              </td>
              <td className="border border-slate-900 px-3 py-2 text-slate-900">{row.value}</td>
              <td className="border border-slate-900 px-3 py-2">
                <span className={low ? 'font-bold text-amber-800' : 'font-semibold text-slate-900'}>
                  {row.confidence}%
                </span>
              </td>
              <td className="border border-slate-900 px-3 py-2 text-slate-900">{row.sourcePage}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ParameterValueTable({ rows }: { rows: NitSheetRow[] }) {
  if (!rows.length) return null;
  return (
    <table className="w-full border-collapse border border-slate-900 text-sm print:text-xs">
      <thead>
        <tr className="bg-slate-100">
          <th className="w-[36%] border border-slate-900 px-3 py-2 text-left font-bold">Parameter</th>
          <th className="border border-slate-900 px-3 py-2 text-left font-bold">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.parameter}>
            <td className="border border-slate-900 px-3 py-2 font-semibold text-slate-800">
              {row.parameter}
            </td>
            <td className="border border-slate-900 px-3 py-2 text-slate-900">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function buildKeyNitRows(intelligence: TenderIntelligence): KeyNitRow[] {
  const sheet = getNitAnalysisSheet(intelligence);

  const allTableRows = [
    ...(sheet.generalInformation || []),
    ...(sheet.financialInformation || []),
    ...(sheet.timelineInformation || []),
    ...(sheet.complianceRequirements || []),
  ];

  const pick = (re: RegExp) => allTableRows.find((r) => re.test(r.parameter));

  const out: KeyNitRow[] = [];

  // Tender Number
  const tenderNo =
    pick(/tender\s*(?:no|number|reference)/i) ||
    pick(/tender\s*id/i);
  if (tenderNo) out.push({ ...tenderNo, confidence: tenderNo.confidence });

  // NIT Number (only if present in verified table rows)
  const nitNo = pick(/\bnit\b\s*(?:no|number|reference)?/i) || pick(/notice\s+inviting\s+tender/i);
  if (nitNo) out.push({ parameter: 'NIT Number', value: nitNo.value, confidence: nitNo.confidence, sourcePage: nitNo.sourcePage });

  // Department
  const dept = pick(/department/i);
  if (dept) out.push({ ...dept, confidence: dept.confidence });

  // Work Name (prefer Work Name, else Tender Name)
  const work = pick(/work\s*name|name\s+of\s+work/i) || pick(/tender\s*name/i);
  if (work) out.push({ parameter: 'Work Name', value: work.value, confidence: work.confidence, sourcePage: work.sourcePage });

  // EMD
  const emd = pick(/\bemd\b/i) || pick(/earnest\s+money/i);
  if (emd) out.push({ parameter: 'EMD', value: emd.value, confidence: emd.confidence, sourcePage: emd.sourcePage });

  // Tender Value
  const tenderValue = pick(/tender\s*value/i) || pick(/estimated\s*(?:cost|value)/i);
  if (tenderValue) out.push({ parameter: 'Tender Value', value: tenderValue.value, confidence: tenderValue.confidence, sourcePage: tenderValue.sourcePage });

  // Turnover (often in executive sheet; also in general table sometimes)
  const turnover = pick(/turnover/i);
  if (turnover) out.push({ parameter: 'Turnover', value: turnover.value, confidence: turnover.confidence, sourcePage: turnover.sourcePage });

  // Eligibility (combine top verified eligibility requirements)
  if (sheet.eligibilityInformation?.length) {
    const top = sheet.eligibilityInformation.slice(0, 4);
    const value = top.map((r) => r.requirement).filter(Boolean).join(' | ');
    const confidence = Math.min(...top.map((r) => r.confidence));
    const sourcePage = top.length > 1 ? 'Multiple' : top[0].sourcePage;
    if (value.trim()) out.push({ parameter: 'Eligibility', value, confidence, sourcePage });
  }

  // Bid Dates (combine key date rows if present)
  const dateRows = sheet.timelineInformation || [];
  const keyDateParams = [/submission/i, /pre-?bid/i, /opening/i, /technical/i, /financial/i];
  const pickedDates = dateRows.filter((r) => keyDateParams.some((p) => p.test(r.parameter))).slice(0, 6);
  if (pickedDates.length) {
    const value = pickedDates.map((r) => `${r.parameter}: ${r.value}`).join(' | ');
    const confidence = Math.min(...pickedDates.map((r) => r.confidence));
    const sourcePage = pickedDates.length > 1 ? 'Multiple' : pickedDates[0].sourcePage;
    out.push({ parameter: 'Bid Dates', value, confidence, sourcePage });
  }

  // Ensure stable ordering + remove blanks
  const order = [
    'Tender Number',
    'NIT Number',
    'Department',
    'Work Name',
    'EMD',
    'Tender Value',
    'Eligibility',
    'Turnover',
    'Bid Dates',
  ];

  const dedup = new Map<string, KeyNitRow>();
  for (const r of out) {
    if (!r.value?.trim()) continue;
    if (!dedup.has(r.parameter)) dedup.set(r.parameter, r);
  }

  return order.map((k) => dedup.get(k)).filter((x): x is KeyNitRow => !!x);
}

function SectionBlock({ section }: { section: NitSheetSection }) {
  if (section.variant === 'scope' && section.scopeLines?.length) {
    return (
      <ul className="list-disc space-y-1.5 border border-slate-900 bg-white px-6 py-3 text-sm">
        {section.scopeLines.map((line, i) => (
          <li key={i} className="text-slate-900">
            {line}
          </li>
        ))}
      </ul>
    );
  }

  if (section.variant === 'documents' && section.documentItems?.length) {
    return (
      <ul className="list-disc space-y-1 border border-slate-900 bg-white px-6 py-3 text-sm">
        {section.documentItems.map((doc) => (
          <li key={doc} className="text-slate-900">
            {doc}
          </li>
        ))}
      </ul>
    );
  }

  if (section.variant === 'technical' && section.technicalItems?.length) {
    return (
      <ul className="list-disc space-y-1 border border-slate-900 bg-white px-6 py-3 text-sm">
        {section.technicalItems.map((item) => (
          <li key={item} className="font-medium text-slate-900">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  if (section.variant === 'risk' && section.riskItems?.length) {
    return (
      <table className="w-full border-collapse border border-slate-900 text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-900 px-3 py-2 text-left font-bold">Risk</th>
            <th className="w-24 border border-slate-900 px-3 py-2 text-left font-bold">Level</th>
            <th className="w-28 border border-slate-900 px-3 py-2 text-left font-bold">Confidence</th>
            <th className="border border-slate-900 px-3 py-2 text-left font-bold">Explanation</th>
          </tr>
        </thead>
        <tbody>
          {section.riskItems.map((r: NitRiskItem) => {
            const lowConf = (r.confidence ?? 100) < 80;
            return (
              <tr key={r.category} className={lowConf ? 'bg-amber-50' : ''}>
                <td className="border border-slate-900 px-3 py-2 font-medium">{r.category}</td>
                <td className="border border-slate-900 px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${riskLevelStyles[r.level] || ''}`}
                  >
                    {r.level}
                  </span>
                </td>
                <td className="border border-slate-900 px-3 py-2">
                  <span className={lowConf ? 'font-bold text-amber-800' : 'font-semibold'}>
                    {r.confidence != null ? `${r.confidence}%` : '—'}
                  </span>
                </td>
                <td className="border border-slate-900 px-3 py-2 text-slate-800">
                  {r.explanation || r.note}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  if (section.variant === 'recommendation' && section.recommendation) {
    return (
      <div className="flex justify-end">
        <Badge className={`px-4 py-2 text-base ${recStyles[section.recommendation] || 'bg-slate-700 text-white'}`}>
          {section.recommendation}
        </Badge>
      </div>
    );
  }

  return <ParameterValueTable rows={section.rows} />;
}

function exportCsv(sheet: ExecutiveNitPresentation, title: string) {
  const lines: string[] = [];
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;

  for (const section of sheet.sections) {
    lines.push('', esc(section.title));
    if (section.scopeLines) {
      section.scopeLines.forEach((l) => lines.push(`${esc('Scope')},${esc(l)}`));
    } else if (section.documentItems) {
      section.documentItems.forEach((d) => lines.push(`${esc('Document')},${esc(d)}`));
    } else if (section.technicalItems) {
      section.technicalItems.forEach((t) => lines.push(`${esc('Technical')},${esc(t)}`));
    } else if (section.riskItems) {
      section.riskItems.forEach((r) =>
        lines.push(`${esc(r.category)},${esc(`${r.level} — ${r.note}`)}`)
      );
    } else if (section.variant === 'recommendation') {
      lines.push(`${esc('Recommendation')},${esc(section.recommendation || '')}`);
    } else {
      section.rows.forEach((r) => lines.push(`${esc(r.parameter)},${esc(r.value)}`));
    }
  }

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}_NIT_Analysis.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function NitAnalysisTables({ intelligence, tenderTitle = 'Tender' }: Props) {
  const executive = useMemo(() => getExecutiveNitSheet(intelligence), [intelligence]);
  const recommendation = getRecommendation(intelligence);
  const foundCount = countFoundFields(getNitAnalysisSheet(intelligence));
  const keyNitRows = useMemo(() => buildKeyNitRows(intelligence), [intelligence]);

  const sections =
    executive?.sections?.filter((s) => s.id !== 'recommendation' && hasSectionContent(s)) ?? [];

  if (!sections.length && !executive?.rows?.length) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
        No verified tender parameters yet. Re-analyze the document to generate the complete NIT Analysis
        Sheet.
      </div>
    );
  }

  const displaySections =
    executive?.sections?.filter((s) => s.id !== 'recommendation') ?? [];

  return (
    <div className="nit-analysis mx-auto max-w-4xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-slate-800 pb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">NIT Analysis Sheet</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            {tenderTitle} · {foundCount} verified parameters · {intelligence.pageCount} pages
          </p>
        </div>
        <Badge className={`text-sm ${recStyles[recommendation] || 'bg-slate-700 text-white'}`}>
          {recommendation}
        </Badge>
      </div>

      <div className="flex gap-2 print:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => executive && exportCsv(executive, tenderTitle)}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print / PDF
        </Button>
      </div>

      {keyNitRows.length > 0 && (
        <section className="break-inside-avoid space-y-2">
          <h3 className="border-b border-slate-500 pb-1 text-xs font-bold uppercase tracking-widest text-slate-700">
            Key NIT Parameters (Verified)
          </h3>
          <KeyNitTable rows={keyNitRows} />
          <p className="text-xs text-slate-500">
            Rows with confidence below 80% are highlighted for quick review.
          </p>
        </section>
      )}

      {displaySections.map((section) => (
        <section key={section.id} className="break-inside-avoid space-y-2">
          <h3 className="border-b border-slate-500 pb-1 text-xs font-bold uppercase tracking-widest text-slate-700">
            {section.title}
          </h3>
          <SectionBlock section={section} />
        </section>
      ))}

      <section className="border-t-2 border-slate-800 pt-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-700">
          Executive Recommendation
        </h3>
        <Badge className={`text-base ${recStyles[recommendation] || 'bg-slate-700 text-white'}`}>
          {recommendation}
        </Badge>
      </section>
    </div>
  );
}

function hasSectionContent(s: NitSheetSection): boolean {
  if (s.rows.length) return true;
  if (s.scopeLines?.length) return true;
  if (s.documentItems?.length) return true;
  if (s.technicalItems?.length) return true;
  if (s.riskItems?.length) return true;
  return false;
}
