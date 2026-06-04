'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { NitAnalysis, EligibilityResult } from '@/types';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileCheck,
  IndianRupee,
  Shield,
  Wrench,
  XCircle,
} from 'lucide-react';

interface Props {
  nitAnalysis: NitAnalysis;
  eligibility?: EligibilityResult | null;
}

export function NitAnalysisView({ nitAnalysis, eligibility }: Props) {
  const data = nitAnalysis.extractedData;
  const risk = nitAnalysis.riskAssessment;
  const score = eligibility?.score ?? nitAnalysis.eligibilityScore;

  const riskColor =
    risk.riskLevel === 'High' ? 'text-red-600' : risk.riskLevel === 'Medium' ? 'text-amber-600' : 'text-green-600';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-1 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Eligibility Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-700">{score}%</div>
            <Progress value={score} className="mt-3" />
            <Badge className="mt-3" variant={eligibility?.status === 'ELIGIBLE' ? 'default' : 'secondary'}>
              {eligibility?.status || 'ANALYZED'}
            </Badge>
            <p className={`mt-2 text-sm font-medium ${riskColor}`}>Risk: {risk.riskLevel}</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Tender Overview</CardTitle>
            <CardDescription>{data.tenderAuthority}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Tender Number</p>
              <p className="font-semibold">{data.tenderNumber || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tender Value</p>
              <p className="font-semibold">{formatCurrency(data.tenderValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">EMD Amount</p>
              <p className="font-semibold">{formatCurrency(data.emdAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completion</p>
              <p className="font-semibold">{data.completionTime || '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Eligibility Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {eligibility?.ruleChecks.map((check, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border p-3">
                {check.passed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                )}
                <div>
                  <p className="text-sm font-medium">{check.rule}</p>
                  <p className="text-xs text-muted-foreground">{check.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5" /> Financial Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">EMD</span>
              <span className="font-medium">{formatCurrency(data.emdAmount)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">BG Requirement</span>
              <span className="font-medium text-right max-w-[60%]">{data.bgRequirement || '—'}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Turnover Required</span>
              <span className="font-medium text-right max-w-[60%]">{data.turnoverRequirement || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Experience</span>
              <span className="font-medium text-right max-w-[60%]">{data.experienceRequirement || '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" /> Technical Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(data.technicalRequirements || ['As per NIT']).map((req, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-blue-600">•</span>
                  {req}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Important Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm border-b pb-2">
              <span>Submission</span>
              <span className="font-medium">{formatDate(data.submissionDate)}</span>
            </div>
            <div className="flex justify-between text-sm border-b pb-2">
              <span>Bid Opening</span>
              <span className="font-medium">{formatDate(data.bidOpeningDate)}</span>
            </div>
            {(data.importantDates || []).map((d, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{d.label}</span>
                <span className="font-medium">{formatDate(d.date)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scope of Work</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-slate-700">{data.scopeOfWork || 'Not specified'}</p>
        </CardContent>
      </Card>

      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-5 w-5" /> AI Risk Assessment
          </CardTitle>
          <CardDescription>{risk.riskSummary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { title: 'Disqualification Points', items: risk.disqualificationPoints },
            { title: 'Missing Documents', items: risk.missingDocuments },
            { title: 'Critical Clauses', items: risk.criticalClauses },
            { title: 'Deadline Risks', items: risk.deadlineRisks },
            { title: 'Financial Risks', items: risk.financialRisks },
          ].map((section) => (
            <div key={section.title} className="rounded-lg border p-4">
              <h4 className="mb-2 text-sm font-semibold">{section.title}</h4>
              <ul className="space-y-1">
                {(section.items || []).length === 0 ? (
                  <li className="text-xs text-muted-foreground">None identified</li>
                ) : (
                  section.items.map((item, i) => (
                    <li key={i} className="text-xs text-slate-600">
                      • {item}
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" /> Document Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(data.requiredDocuments || []).map((doc, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <FileCheck className="h-4 w-4 text-blue-600" />
                {doc}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
