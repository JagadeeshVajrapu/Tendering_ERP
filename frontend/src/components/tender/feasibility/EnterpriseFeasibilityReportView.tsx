'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { EnterpriseFeasibilityReport, MdFeasibilityAction } from '@/types/enterpriseFeasibilityReport';
import { Download, CheckCircle, XCircle, MessageSquare, FileWarning } from 'lucide-react';

interface Props {
  enterprise: EnterpriseFeasibilityReport;
  pdfUrl?: string;
  userRole?: string;
  onMdAction?: (action: MdFeasibilityAction, comments?: string) => void;
}

const recColors: Record<string, string> = {
  'Strongly Recommended': 'bg-emerald-600 text-white',
  Recommended: 'bg-emerald-500 text-white',
  'Recommended With Conditions': 'bg-amber-500 text-white',
  'High Risk': 'bg-orange-600 text-white',
  'Not Recommended': 'bg-red-600 text-white',
};

const riskColor = (level: string) => {
  if (level === 'High') return 'text-red-700 bg-red-50';
  if (level === 'Medium') return 'text-amber-800 bg-amber-50';
  return 'text-emerald-700 bg-emerald-50';
};

export function EnterpriseFeasibilityReportView({
  enterprise: r,
  pdfUrl,
  userRole,
  onMdAction,
}: Props) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001';
  const fullPdfUrl = pdfUrl?.startsWith('http') ? pdfUrl : pdfUrl ? `${apiBase}${pdfUrl}` : undefined;
  const isMd = userRole === 'md';

  return (
    <div className="mx-auto max-w-4xl space-y-5 print:max-w-none">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Enterprise Feasibility Report
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            {r.overview.tenderTitle || 'Tender Decision Brief'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {r.overview.organization} · {r.overview.serviceCategory} · Generated{' '}
            {new Date(r.generatedAt).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Status: {r.approvalStatus} · Master Dataset only
          </p>
        </div>
        <Badge className={recColors[r.aiRecommendation.recommendation] || 'bg-slate-600 text-white'}>
          {r.aiRecommendation.recommendation}
        </Badge>
      </div>

      {fullPdfUrl && (
        <Button asChild variant="outline" size="sm" className="no-print">
          <a href={fullPdfUrl} target="_blank" rel="noopener noreferrer">
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </a>
        </Button>
      )}

      {isMd && onMdAction && (
        <Card className="border-blue-200 bg-blue-50/40 no-print">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">MD Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onMdAction('approve')}>
              <CheckCircle className="mr-1 h-4 w-4" /> Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => onMdAction('participate_with_conditions')}>
              Participate With Conditions
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onMdAction('reject')}>
              <XCircle className="mr-1 h-4 w-4" /> Reject
            </Button>
            <Button size="sm" variant="outline" onClick={() => onMdAction('request_clarification')}>
              <MessageSquare className="mr-1 h-4 w-4" /> Request Clarification
            </Button>
            <Button size="sm" variant="outline" onClick={() => onMdAction('request_missing_documents')}>
              <FileWarning className="mr-1 h-4 w-4" /> Request Documents
            </Button>
            <Button size="sm" variant="outline" onClick={() => onMdAction('request_finance_approval')}>
              Finance Approval
            </Button>
            <Button size="sm" variant="outline" onClick={() => onMdAction('request_compliance_review')}>
              Compliance Review
            </Button>
          </CardContent>
        </Card>
      )}

      <Section title="1. Tender Overview">
        <Grid
          items={[
            ['Tender Number', r.overview.tenderNumber],
            ['Organization', r.overview.organization],
            ['Service Category', r.overview.serviceCategory],
            ['Location', r.overview.location],
            ['Tender Value', r.overview.tenderValue],
            ['EMD', r.overview.emdAmount],
            ['Tender Fee', r.overview.tenderFee],
            ['Completion Period', r.overview.completionPeriod],
            ['Bid End Date', r.overview.bidSubmissionEndDate],
          ]}
        />
      </Section>

      <Section title="2. Scope Summary">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {r.scopeSummary.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </Section>

      <Section title="3. Manpower Requirements">
        {r.manpowerRequirements.items.length ? (
          <>
            <Grid items={r.manpowerRequirements.items.map((m) => [m.role, m.count])} />
            <p className="mt-2 text-sm font-medium">Total: {r.manpowerRequirements.totalEstimated}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No explicit manpower parameters in master dataset.</p>
        )}
      </Section>

      <Section title="4. Eligibility Summary">
        <Grid
          items={[
            ['Turnover', r.eligibilitySummary.turnoverRequirement],
            ['Experience', r.eligibilitySummary.experienceRequirement],
            ['Net Worth', r.eligibilitySummary.netWorthRequirement],
            ['Bid Capacity', r.eligibilitySummary.bidCapacity],
            ['Bank Solvency', r.eligibilitySummary.bankSolvency],
          ]}
        />
        {r.eligibilitySummary.mandatoryCertifications.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm">
            {r.eligibilitySummary.mandatoryCertifications.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="5. Financial Summary">
        <Grid
          items={[
            ['Tender Value', r.financialSummary.tenderValue],
            ['EMD', r.financialSummary.emd],
            ['Tender Fee', r.financialSummary.tenderFee],
            ['Performance Security', r.financialSummary.performanceSecurity],
            ['Bank Guarantee', r.financialSummary.bankGuarantee],
            ['Est. Exposure', r.financialSummary.estimatedFinancialExposure],
          ]}
        />
      </Section>

      <Section title="6. Timeline Summary">
        <Grid
          items={[
            ['Publishing', r.timelineSummary.publishingDate],
            ['Pre-Bid Meeting', r.timelineSummary.preBidMeeting],
            ['Bid Start', r.timelineSummary.bidStartDate],
            ['Bid End', r.timelineSummary.bidEndDate],
            ['Technical Opening', r.timelineSummary.technicalOpening],
            ['Financial Opening', r.timelineSummary.financialOpening],
            ['Days Remaining', r.timelineSummary.daysRemaining?.toString() ?? '—'],
          ]}
        />
      </Section>

      <Section title="7. Checklist Readiness">
        <div className="flex flex-wrap gap-3 text-sm">
          <Badge className="bg-blue-100 text-blue-800 text-base px-3 py-1">
            {r.checklistReadiness.readinessLabel}
          </Badge>
          <span>Required: {r.checklistReadiness.requiredDocuments}</span>
          <span>Uploaded: {r.checklistReadiness.uploadedDocuments}</span>
          <span className="text-red-700">Missing: {r.checklistReadiness.missingDocuments}</span>
          <span className="text-amber-700">Expired: {r.checklistReadiness.expiredDocuments}</span>
        </div>
        {r.checklistReadiness.criticalMissing.length > 0 && (
          <p className="mt-2 text-sm text-red-700">
            Critical missing: {r.checklistReadiness.criticalMissing.join(', ')}
          </p>
        )}
      </Section>

      <Section title="8. Experience Matching">
        <p className="text-sm font-medium">{r.experienceMatching.eligibilityStatus}</p>
        {r.experienceMatching.experienceGaps.length > 0 && (
          <p className="mt-1 text-sm text-amber-800">
            Gaps: {r.experienceMatching.experienceGaps.join(', ')}
          </p>
        )}
      </Section>

      <Section title="9. Risk Analysis">
        <p className="mb-2 text-sm">
          Overall: <span className={`rounded px-2 py-0.5 font-semibold ${riskColor(r.riskAnalysis.overallLevel)}`}>{r.riskAnalysis.overallLevel}</span>
        </p>
        <ul className="space-y-2 text-sm">
          {r.riskAnalysis.risks.map((risk, i) => (
            <li key={i} className="rounded border p-2">
              <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-semibold ${riskColor(risk.level)}`}>
                {risk.level}
              </span>
              <strong>{risk.riskType}</strong> — {risk.reason}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="10. AI Recommendation">
        <p className="text-sm">{r.aiRecommendation.reason}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="font-semibold text-emerald-800">Benefits</p>
            <ul className="mt-1 list-disc pl-4">
              {r.aiRecommendation.benefits.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-red-800">Risks</p>
            <ul className="mt-1 list-disc pl-4">
              {r.aiRecommendation.risks.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-blue-800">Required Actions</p>
            <ul className="mt-1 list-disc pl-4">
              {r.aiRecommendation.requiredActions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {r.decisionHistory?.length > 0 && (
        <Section title="Audit Log">
          <ul className="space-y-2 text-sm">
            {r.decisionHistory.map((d, i) => (
              <li key={i} className="rounded border p-2">
                <span className="font-medium">{d.action}</span> by {d.byRole} ·{' '}
                {new Date(d.at).toLocaleString()}
                {d.comments && <p className="text-muted-foreground">{d.comments}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="print:break-inside-avoid">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Grid({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2 text-sm">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
