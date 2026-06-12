'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TenderIntelligenceLayerResult } from '@/types/tenderIntelligenceLayer';

export function TenderIntelligencePanel({ data }: { data: TenderIntelligenceLayerResult }) {
  const topTypes = Object.entries(data.typeScores || {})
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Intelligence Output</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Tender Type</span>
            <Badge className="px-3 py-1 text-base">{data.tenderType || 'Unclassified'}</Badge>
            <span className="text-sm text-muted-foreground">Confidence</span>
            <span className="text-lg font-semibold">{data.confidence}%</span>
            <span className="text-sm text-muted-foreground">Pages Scanned</span>
            <span className="font-medium">{data.pagesScanned}</span>
          </div>

          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
{JSON.stringify(
  {
    tenderType: data.tenderType || '',
    confidence: data.confidence,
    sections: data.sections.map((s) => s.section),
  },
  null,
  2
)}
          </pre>
        </CardContent>
      </Card>

      {topTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Type Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {topTypes.map(([type, score]) => (
                <Badge key={type} variant="outline">
                  {type}: {score}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Detected Sections ({data.sections.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {data.sections.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No sections detected.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Section</th>
                  <th className="px-4 py-2 font-semibold">Confidence</th>
                  <th className="px-4 py-2 font-semibold">Page Range</th>
                  <th className="px-4 py-2 font-semibold">Matched Keywords</th>
                </tr>
              </thead>
              <tbody>
                {data.sections.map((section) => (
                  <tr key={section.section} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{section.section}</td>
                    <td className="px-4 py-2">{section.confidence}%</td>
                    <td className="px-4 py-2">
                      {section.startPage != null && section.endPage != null
                        ? `${section.startPage}–${section.endPage}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {section.matchedKeywords.slice(0, 5).map((kw) => (
                          <Badge key={kw} variant="outline" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
