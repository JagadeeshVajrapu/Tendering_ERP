'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { TenderDocumentSummaryTable, dedupeList } from '@/components/tender/TenderDocumentSummaryTable';
import type { TenderAnalysis } from '@/types';
import { AlertTriangle, Brain, CheckCircle2, FileText } from 'lucide-react';

interface Props {
  analysis: TenderAnalysis;
}

function ListSection({ title, items, icon: Icon }: { title: string; items: string[]; icon?: React.ElementType }) {
  if (!items?.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {Icon && <Icon className="h-4 w-4" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function TenderAnalysisView({ analysis }: Props) {
  const isSuitable = !analysis.aiRecommendation.toLowerCase().includes('not suitable');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{analysis.tenderName || 'Tender Analysis'}</h2>
          <p className="text-sm text-muted-foreground">
            {analysis.tenderNumber ? `Ref: ${analysis.tenderNumber}` : analysis.organization}
          </p>
        </div>
        <Badge variant={isSuitable ? 'default' : 'destructive'} className="text-sm">
          {isSuitable ? 'Suitable' : 'Review Required'}
        </Badge>
      </div>

      <TenderDocumentSummaryTable analysis={analysis} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Additional Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="w-1/3 font-medium text-muted-foreground">Department</TableCell>
                  <TableCell>{analysis.department || '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground">Payment Terms</TableCell>
                  <TableCell>{analysis.paymentTerms || '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground">Pre-Bid Meeting</TableCell>
                  <TableCell>{analysis.preBidMeetingDate || '—'}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <ListSection title="Required Documents" items={dedupeList(analysis.requiredDocuments)} icon={FileText} />
      </div>

      {analysis.importantDates?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Important Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {analysis.importantDates.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="w-1/2 font-medium">{d.label}</TableCell>
                    <TableCell>{d.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ListSection title="Eligibility Criteria (Detailed)" items={dedupeList(analysis.eligibilityCriteria)} icon={CheckCircle2} />
      <ListSection title="Risk Factors" items={dedupeList(analysis.riskFactors)} icon={AlertTriangle} />

      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-blue-900">
            <Brain className="h-5 w-5" />
            AI Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-slate-700">{analysis.aiRecommendation || 'No recommendation available.'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
