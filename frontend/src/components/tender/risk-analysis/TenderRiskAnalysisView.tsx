'use client';

import { AlertTriangle, Shield, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TenderRiskAnalysisResponse, TenderRiskLevel } from '@/types/tenderRiskAnalysis';

const LEVEL_STYLES: Record<TenderRiskLevel, { bg: string; text: string; border: string }> = {
  LOW: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  HIGH: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
};

interface Props {
  analysis: TenderRiskAnalysisResponse;
  tenderTitle?: string;
}

export function TenderRiskAnalysisView({ analysis, tenderTitle }: Props) {
  const overall = LEVEL_STYLES[analysis.overallLevel];

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-red-50/20 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Shield className="mt-1 h-7 w-7 shrink-0 text-red-700" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-red-700">
              Tender Risk Assessment
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{tenderTitle || 'Risk Analysis'}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Derived exclusively from Master Tender Dataset — no raw OCR used.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold',
              overall.bg,
              overall.text,
              overall.border
            )}
          >
            <AlertTriangle className="h-4 w-4" />
            Overall Risk: {analysis.overallLevel}
          </span>
          <span className="text-xs text-muted-foreground">
            {analysis.risks.length} risk categories assessed
            {analysis.generatedAt && ` · ${new Date(analysis.generatedAt).toLocaleString('en-IN')}`}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <PrereqChip ok={analysis.prerequisites.extractionComplete} label="Extraction" />
          <PrereqChip ok={analysis.prerequisites.validationComplete} label="Validation" />
          <PrereqChip ok={analysis.prerequisites.masterDatasetReady} label="Master Dataset" />
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {analysis.risks.map((risk) => {
          const style = LEVEL_STYLES[risk.level];
          return (
            <Card key={risk.riskType} className={cn('border-2', style.border)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base text-slate-900">{risk.riskType}</CardTitle>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-xs font-bold',
                      style.bg,
                      style.text
                    )}
                  >
                    {risk.level}
                  </span>
                </div>
                <CardDescription className="text-xs tabular-nums">
                  Confidence: {risk.confidence}%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-slate-700">{risk.reason}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PrereqChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 ring-1',
        ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label}
    </span>
  );
}
