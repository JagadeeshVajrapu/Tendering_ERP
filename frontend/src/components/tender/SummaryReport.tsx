'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { TenderSummary } from '@/types';

export function SummaryReport({ summary }: { summary: TenderSummary }) {
  const proceed = summary.recommendation === 'Proceed';

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:space-y-4" id="summary-report">
      <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white print:bg-white print:text-black">
        <p className="text-sm uppercase tracking-widest text-slate-300 print:text-slate-600">Executive Summary Report</p>
        <h1 className="mt-2 text-3xl font-bold">{summary.tenderName}</h1>
        <p className="mt-2 text-slate-300 print:text-slate-600">{summary.tenderAuthority}</p>
        <Badge className={`mt-4 ${proceed ? 'bg-emerald-500' : 'bg-red-500'}`}>
          Recommendation: {summary.recommendation}
        </Badge>
      </div>

      {[
        { title: 'Scope', content: summary.scope },
        { title: 'Eligibility', content: summary.eligibility },
        { title: 'Timeline', content: summary.completionTimeline },
        { title: 'Risk Assessment', content: summary.riskSummary },
      ].map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-lg">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-slate-700">{section.content}</p>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Financial Requirement</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Estimated Revenue</p>
            <p className="text-xl font-bold">{formatCurrency(summary.estimatedRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">EMD Requirement</p>
            <p className="text-xl font-bold">{summary.emdRequirement}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle>Recommendation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-lg font-semibold ${proceed ? 'text-emerald-700' : 'text-red-700'}`}>
            {summary.recommendation}
          </p>
          <p className="mt-2 text-sm text-slate-600">{summary.recommendationReason}</p>
        </CardContent>
      </Card>
    </div>
  );
}
