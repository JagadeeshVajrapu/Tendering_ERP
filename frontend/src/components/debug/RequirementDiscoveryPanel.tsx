'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RequirementDiscoveryResult } from '@/types/requirementDiscovery';

export function RequirementDiscoveryPanel({ data }: { data: RequirementDiscoveryResult }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Service Category</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-semibold">{data.serviceCategory || 'Unclassified'}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data.totalItems}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Required</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-amber-700">{data.requiredCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mentioned in Tender</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-700">{data.mentionedInTenderCount}</CardContent>
        </Card>
      </div>

      {data.categories.map((cat) => (
        <Card key={cat.id}>
          <CardHeader>
            <CardTitle>{cat.title}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Document</th>
                  <th className="px-4 py-2 font-semibold">Required</th>
                  <th className="px-4 py-2 font-semibold">In Tender</th>
                  <th className="px-4 py-2 font-semibold">Source</th>
                  <th className="px-4 py-2 font-semibold">Page</th>
                  <th className="px-4 py-2 font-semibold">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {cat.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50/80 align-top">
                    <td className="px-4 py-2 font-medium">{item.name}</td>
                    <td className="px-4 py-2">
                      {item.required ? <Badge>Required</Badge> : <Badge variant="outline">Optional</Badge>}
                    </td>
                    <td className="px-4 py-2">
                      {item.mentionedInTender ? (
                        <Badge className="bg-emerald-100 text-emerald-900">Yes</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{item.source.replace('_', ' ')}</td>
                    <td className="px-4 py-2 text-muted-foreground">{item.page ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs truncate" title={item.sourceText}>
                      {item.sourceText || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
