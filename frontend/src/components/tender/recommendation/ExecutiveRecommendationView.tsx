'use client';

import { CheckCircle2, AlertTriangle, XCircle, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  ExecutiveRecommendation,
  ExecutiveRecommendationResponse,
  FactorStatus,
} from '@/types/executiveRecommendation';

const RECOMMENDATION_STYLES: Record<
  ExecutiveRecommendation,
  { bg: string; text: string; border: string; icon: React.ElementType }
> = {
  'Apply Immediately': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    icon: CheckCircle2,
  },
  'Apply With Caution': {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    icon: AlertTriangle,
  },
  'Need Manual Review': {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-300',
    icon: Eye,
  },
  'Do Not Apply': {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-300',
    icon: XCircle,
  },
};

const STATUS_STYLES: Record<FactorStatus, string> = {
  Favorable: 'bg-emerald-100 text-emerald-800',
  Neutral: 'bg-slate-100 text-slate-700',
  Concern: 'bg-amber-100 text-amber-800',
  Critical: 'bg-red-100 text-red-800',
};

interface Props {
  data: ExecutiveRecommendationResponse;
  tenderTitle?: string;
}

export function ExecutiveRecommendationView({ data, tenderTitle }: Props) {
  const style = RECOMMENDATION_STYLES[data.recommendation];
  const Icon = style.icon;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-emerald-50/20 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">
          Executive Decision Support
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">{tenderTitle || 'Bid Recommendation'}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Based exclusively on verified Master Dataset and Risk Analysis.
        </p>

        <div
          className={cn(
            'mt-5 inline-flex items-center gap-3 rounded-xl border-2 px-5 py-4',
            style.bg,
            style.text,
            style.border
          )}
        >
          <Icon className="h-8 w-8 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Recommendation</p>
            <p className="text-xl font-bold">{data.recommendation}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <MetricChip label="Overall Risk" value={data.overallRiskLevel} />
          <MetricChip label="Data Quality" value={`${data.dataQualityScore}/100`} />
          {data.generatedAt && (
            <MetricChip label="Generated" value={new Date(data.generatedAt).toLocaleString('en-IN')} />
          )}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Executive Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-slate-700">{data.executiveSummary}</p>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Decision Factors</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {data.factors.map((factor) => (
            <Card key={factor.factor} className="border-slate-200">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{factor.factor}</CardTitle>
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold',
                      STATUS_STYLES[factor.status]
                    )}
                  >
                    {factor.status}
                  </span>
                </div>
                <CardDescription className="font-medium text-slate-800">{factor.summary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm leading-relaxed text-slate-600">{factor.detail}</p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {factor.confidence !== null && (
                    <span>Confidence: {factor.confidence}%</span>
                  )}
                  {factor.sourcePage !== null && <span>Source: p. {factor.sourcePage}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-slate-200">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-semibold text-slate-900">{value}</span>
    </span>
  );
}
