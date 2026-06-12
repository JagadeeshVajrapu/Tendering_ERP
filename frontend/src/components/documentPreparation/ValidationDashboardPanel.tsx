'use client';

import type { ValidationDashboard } from '@/types/documentPreparation';

interface Props {
  dashboard: ValidationDashboard | null;
  isLoading?: boolean;
}

export function ValidationDashboardPanel({ dashboard, isLoading }: Props) {
  if (isLoading && !dashboard) {
    return (
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard label="Total Documents" value={dashboard.totalDocuments} color="blue" />
      <StatCard label="Valid" value={dashboard.validDocuments} color="emerald" />
      <StatCard label="Warning" value={dashboard.warningDocuments} color="amber" />
      <StatCard label="Error" value={dashboard.errorDocuments} color="red" />
      <StatCard
        label="Avg Score"
        value={dashboard.averageScore ? `${dashboard.averageScore}%` : '—'}
        sub={dashboard.unvalidatedDocuments ? `${dashboard.unvalidatedDocuments} not validated` : undefined}
        color="slate"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color: 'blue' | 'emerald' | 'amber' | 'red' | 'slate';
}) {
  const border: Record<typeof color, string> = {
    blue: 'border-blue-200 bg-blue-50/60',
    emerald: 'border-emerald-200 bg-emerald-50/60',
    amber: 'border-amber-200 bg-amber-50/60',
    red: 'border-red-200 bg-red-50/60',
    slate: 'border-slate-200 bg-slate-50/60',
  };
  const text: Record<typeof color, string> = {
    blue: 'text-blue-900',
    emerald: 'text-emerald-900',
    amber: 'text-amber-900',
    red: 'text-red-900',
    slate: 'text-slate-900',
  };

  return (
    <div className={`rounded-lg border p-3 ${border[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${text[color]}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
