'use client';

import { Fragment, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { DynamicChecklistItem, DynamicChecklistResult } from '@/types/dynamicChecklist';
import {
  exportChecklistExcel,
  exportChecklistJson,
  exportChecklistPdf,
} from '@/lib/checklistExport';

interface Props {
  data: DynamicChecklistResult;
  tenderId: string;
  token?: string;
  userRole?: string;
  onWorkflowAction?: (itemId: string, action: string, note?: string) => void;
  compact?: boolean;
  showExports?: boolean;
}

function displayStatusBadge(item: DynamicChecklistItem) {
  const status = item.displayStatus || (item.required ? 'required' : 'optional');
  const map: Record<string, string> = {
    verified: 'bg-emerald-100 text-emerald-800',
    uploaded: 'bg-blue-100 text-blue-800',
    missing: 'bg-red-100 text-red-800',
    required: 'bg-orange-100 text-orange-800',
    optional: 'bg-slate-100 text-slate-600',
    available: 'bg-cyan-100 text-cyan-800',
    approved: 'bg-emerald-100 text-emerald-800',
    expired: 'bg-amber-100 text-amber-900',
    rejected: 'bg-orange-100 text-orange-800',
    pending_review: 'bg-violet-100 text-violet-800',
  };
  const label: Record<string, string> = {
    verified: 'Verified',
    uploaded: 'Uploaded',
    missing: 'Missing',
    required: 'Required',
    optional: 'Optional',
    available: 'Available',
    approved: 'Verified',
    expired: 'Expired',
    rejected: 'Rejected',
    pending_review: 'Pending Review',
  };
  const key = item.status === 'approved' ? 'verified' : status;
  return (
    <Badge className={map[key] || 'bg-slate-100'}>
      {label[key] || key}
    </Badge>
  );
}

function isItemComplete(item: DynamicChecklistItem): boolean {
  return item.markedComplete || item.uploaded || item.status === 'approved' || item.status === 'uploaded';
}

export function EnterpriseDynamicChecklistView({
  data,
  tenderId,
  token,
  userRole,
  onWorkflowAction,
  compact = false,
  showExports = true,
}: Props) {
  const s = data.summary;
  const [exporting, setExporting] = useState<string | null>(null);
  const [expandedExperience, setExpandedExperience] = useState<Record<string, boolean>>({});

  const compliancePct = s.compliancePercentage ?? s.readinessScore;

  const handlePdf = async (sectionId?: string) => {
    if (!token) return;
    setExporting(sectionId || 'full');
    try {
      await exportChecklistPdf(token, tenderId, `Checklist_${tenderId}`, sectionId);
    } finally {
      setExporting(null);
    }
  };

  const role = userRole?.toLowerCase();
  const isExecutive = role === 'executive' || role === 'md' || role === 'manager';
  const isManager = role === 'manager' || role === 'md';

  const groupedCategories = useMemo(() => data.categories, [data.categories]);

  const toggleCheckbox = (item: DynamicChecklistItem) => {
    if (!onWorkflowAction || !isExecutive) return;
    const action = isItemComplete(item) ? 'unmark_complete' : 'mark_complete';
    onWorkflowAction(item.id, action);
  };

  return (
    <div className="space-y-6">
      {showExports && (
        <div className="flex flex-wrap gap-2 no-print">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportChecklistJson(data, `Checklist_${tenderId}`)}
          >
            <FileText className="mr-2 h-4 w-4" /> JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportChecklistExcel(data, `Checklist_${tenderId}`)}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          {token && (
            <Button
              variant="outline"
              size="sm"
              disabled={exporting === 'full'}
              onClick={() => handlePdf()}
            >
              <Download className="mr-2 h-4 w-4" /> Full PDF
            </Button>
          )}
        </div>
      )}

      <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8'}`}>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Compliance Score</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-blue-700">{compliancePct}%</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Required Documents</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{s.required}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Completed</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-700">{s.completed}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-amber-700">{s.pending ?? s.missing}</CardContent>
        </Card>
        {!compact && (
          <>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Critical Missing</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold text-red-800">{s.criticalMissing}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expired</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold text-amber-700">{s.expired}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending Review</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold text-violet-700">{s.pendingReview}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Service</CardTitle></CardHeader>
              <CardContent className="text-sm font-semibold">{data.serviceCategory || '—'}</CardContent>
            </Card>
          </>
        )}
      </div>

      {s.minimumExperienceYears && s.minimumExperienceYears > 0 && (
        <p className="rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
          NIT requires <strong>{s.minimumExperienceYears} years</strong> experience.
          {s.suggestedExperienceYears?.length ? (
            <> Suggested FY years: <strong>{s.suggestedExperienceYears.join(', ')}</strong>.</>
          ) : null}
          {' '}Executives can adjust year selections below.
        </p>
      )}

      {data.alerts?.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-900">
              <AlertTriangle className="h-5 w-5" /> Risk Alerts ({data.alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.alerts.slice(0, compact ? 4 : 8).map((alert) => (
              <p key={`${alert.itemId}-${alert.type}`} className="text-sm text-amber-900">
                <span className="font-medium capitalize">[{alert.severity}]</span> {alert.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {groupedCategories.map((cat) => {
        const catSummary = cat.summary;
        const documentItems = cat.items.filter((i) => i.itemType !== 'experience_year');
        const experienceHeaders = cat.items.filter((i) => i.itemType === 'experience_header');
        const experienceYears = cat.items.filter((i) => i.itemType === 'experience_year');

        return (
          <Card key={cat.id} className="overflow-hidden print:break-inside-avoid">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/80">
              <div>
                <CardTitle className="text-lg">{cat.title}</CardTitle>
                {cat.subtitle && (
                  <p className="mt-0.5 text-xs text-muted-foreground">({cat.subtitle})</p>
                )}
                {catSummary && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {catSummary.completed}/{catSummary.required} completed · {catSummary.compliancePercentage}% section compliance
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {catSummary && (
                  <Badge variant="outline" className="text-emerald-700">
                    {catSummary.compliancePercentage}%
                  </Badge>
                )}
                <Badge variant="outline">{cat.items.filter((i) => i.required && i.itemType !== 'experience_header').length} required</Badge>
                {token && showExports && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="no-print"
                    disabled={exporting === cat.id}
                    onClick={() => handlePdf(cat.id)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr className="text-left text-xs text-muted-foreground">
                    {onWorkflowAction && <th className="w-10 px-4 py-2" />}
                    <th className="px-4 py-2 font-semibold">Document</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                    {!compact && <th className="px-4 py-2 font-semibold">Uploaded File</th>}
                    {!compact && onWorkflowAction && (
                      <th className="px-4 py-2 font-semibold no-print">Manager</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {documentItems
                    .filter((i) => i.itemType !== 'experience_header')
                    .map((item) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/80">
                        {onWorkflowAction && (
                          <td className="px-4 py-2">
                            {item.itemType !== 'experience_header' && (
                              <Checkbox
                                checked={isItemComplete(item)}
                                disabled={!isExecutive}
                                onCheckedChange={() => toggleCheckbox(item)}
                                aria-label={`Mark ${item.name} complete`}
                              />
                            )}
                          </td>
                        )}
                        <td className="px-4 py-2 font-medium">
                          {item.name}
                          {item.critical && (
                            <span className="ml-2 text-[10px] font-bold uppercase text-red-600">Critical</span>
                          )}
                          {item.suggested && (
                            <span className="ml-2 text-[10px] font-semibold text-blue-600">Suggested</span>
                          )}
                        </td>
                        <td className="px-4 py-2">{displayStatusBadge(item)}</td>
                        {!compact && (
                          <td className="px-4 py-2 text-muted-foreground">{item.matchedFileName || '—'}</td>
                        )}
                        {!compact && onWorkflowAction && (
                          <td className="px-4 py-2 no-print">
                            {isManager && item.status === 'pending_review' && (
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => onWorkflowAction(item.id, 'approve')}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => onWorkflowAction(item.id, 'request_reupload')}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}

                  {experienceHeaders.map((header) => {
                    const years = experienceYears.filter((y) => y.parentId === header.id);
                    const expanded = expandedExperience[header.id] ?? true;
                    const yearCompleted = years.filter((y) => isItemComplete(y)).length;
                    const yearRequired = years.filter((y) => y.required).length;

                    return (
                      <Fragment key={header.id}>
                        <tr className="border-b bg-slate-50/60">
                          <td colSpan={onWorkflowAction ? (compact ? 3 : 5) : compact ? 2 : 4} className="px-4 py-2">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between text-left font-semibold text-slate-800"
                              onClick={() =>
                                setExpandedExperience((prev) => ({
                                  ...prev,
                                  [header.id]: !expanded,
                                }))
                              }
                            >
                              <span>{header.name}</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                {yearCompleted}/{yearRequired || years.length} years selected · FY 2001-02 to current
                              </span>
                            </button>
                          </td>
                        </tr>
                        {expanded &&
                          years.map((item) => (
                            <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/80">
                              {onWorkflowAction && (
                                <td className="px-4 py-2 pl-8">
                                  <Checkbox
                                    checked={isItemComplete(item)}
                                    disabled={!isExecutive}
                                    onCheckedChange={() => toggleCheckbox(item)}
                                    aria-label={`Select ${item.name}`}
                                  />
                                </td>
                              )}
                              <td className="px-4 py-2 pl-8 text-muted-foreground">{item.name}</td>
                              <td className="px-4 py-2">{displayStatusBadge(item)}</td>
                              {!compact && <td className="px-4 py-2 text-muted-foreground">—</td>}
                              {!compact && onWorkflowAction && <td className="px-4 py-2" />}
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
