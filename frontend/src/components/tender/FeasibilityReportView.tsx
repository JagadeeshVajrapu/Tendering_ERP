'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ExecutiveReportSnapshot, FeasibilityReport } from '@/types';
import { Download } from 'lucide-react';

interface Props {
  report: FeasibilityReport;
  pdfUrl?: string;
  tenderName?: string;
}

const recStyles = (label: string) => {
  if (label === 'APPLY' || label === 'Apply' || label === 'Suitable') {
    return { className: 'bg-emerald-600 text-white', label: label === 'Suitable' ? 'APPLY' : label };
  }
  if (label === 'DO NOT APPLY' || label === 'Do Not Apply' || label === 'Not Suitable') {
    return { className: 'bg-red-600 text-white', label: label === 'Not Suitable' ? 'DO NOT APPLY' : label };
  }
  return { className: 'bg-amber-500 text-white', label: label || 'APPLY WITH CAUTION' };
};

function fromReport(report: FeasibilityReport): ExecutiveReportSnapshot | null {
  if (report.executiveReport) return report.executiveReport;
  return null;
}

function legacyFromReport(report: FeasibilityReport): ExecutiveReportSnapshot {
  const bullets = (text: string) =>
    text
      .split('\n')
      .map((l) => l.replace(/^•\s*/, '').trim())
      .filter(Boolean);

  return {
    overviewLines: report.financialSummary
      ? [report.financialSummary]
      : [],
    scopeBullets: bullets(report.scopeSummary),
    eligibilityBullets: bullets(report.eligibilitySummary).filter(
      (l) => !l.startsWith('Eligibility Status:')
    ),
    eligibilityStatus: report.eligibilityStatus || 'Partially Eligible',
    timelineRows: report.timelineSummary
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf(':');
        if (i < 0) return { milestone: line, date: '—' };
        return { milestone: line.slice(0, i).trim(), date: line.slice(i + 1).trim() };
      }),
    recommendation: report.intelligenceRecommendation || report.recommendation,
    recommendationJustification: report.recommendationJustification || '',
  };
}

export function FeasibilityReportView({ report, pdfUrl, tenderName }: Props) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001';
  const fullPdfUrl = pdfUrl?.startsWith('http') ? pdfUrl : `${apiBase}${pdfUrl}`;
  const exec = fromReport(report) || legacyFromReport(report);
  const badge = recStyles(exec.recommendation);

  return (
    <div className="mx-auto max-w-3xl space-y-6 print:max-w-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tender Feasibility Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Executive decision brief — read in under 2 minutes
          </p>
          {tenderName && <p className="mt-1 font-medium text-slate-800">{tenderName}</p>}
        </div>
        <Badge className={badge.className}>{badge.label}</Badge>
      </div>

      {fullPdfUrl && (
        <Button asChild variant="outline" size="sm">
          <a href={fullPdfUrl} target="_blank" rel="noopener noreferrer">
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </a>
        </Button>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tender Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-slate-700">
          {exec.overviewLines.length > 0 ? (
            exec.overviewLines.map((line, i) => <p key={i}>{line}</p>)
          ) : (
            <p className="text-muted-foreground">Overview not available.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Scope Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            {exec.scopeBullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Eligibility Assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            {exec.eligibilityBullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          <p className="text-sm font-semibold text-slate-900">
            Eligibility Status:{' '}
            <span className="font-normal">{exec.eligibilityStatus}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Timeline Assessment</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-600">
                <th className="px-4 py-2">Milestone</th>
                <th className="px-4 py-2">Date / Period</th>
              </tr>
            </thead>
            <tbody>
              {exec.timelineRows.map((row) => (
                <tr key={row.milestone} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-700">{row.milestone}</td>
                  <td className="px-4 py-2 text-slate-900">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {report.keyRisks.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Key Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
              {report.keyRisks.map((risk, i) => (
                <li key={i}>{risk}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Executive Recommendation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-lg font-bold tracking-wide text-slate-900">{badge.label}</p>
          {exec.recommendationJustification && (
            <p className="text-sm leading-relaxed text-slate-700">
              {exec.recommendationJustification}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
