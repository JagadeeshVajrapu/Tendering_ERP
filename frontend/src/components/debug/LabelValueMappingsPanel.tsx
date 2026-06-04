'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LabelValueMappingResult } from '@/types/labelValueMapping';
import { ArrowRight } from 'lucide-react';

export function LabelValueMappingsPanel({ data }: { data: LabelValueMappingResult }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Field Mapping Layer</h2>
        <p className="text-sm text-muted-foreground">
          Label–value pairs mapped to canonical tender fields (no schema on extraction; mapping applied
          after).
        </p>
      </div>

      <Card className="border-teal-200 bg-teal-50/30">
        <CardHeader className="py-3">
          <CardTitle className="text-base">Mapped fields ({data.mappedFields.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.mappedFields.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No pairs matched mapping rules.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-white/60 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Source label</th>
                  <th className="px-2 py-2 w-8" />
                  <th className="px-4 py-2 font-semibold">Target field</th>
                  <th className="px-4 py-2 font-semibold">Value</th>
                  <th className="px-4 py-2 font-semibold">Page</th>
                </tr>
              </thead>
              <tbody>
                {data.mappedFields.map((m) => (
                  <tr key={m.targetField} className="border-b last:border-0 bg-white/80">
                    <td className="px-4 py-3 font-medium">{m.sourceLabel}</td>
                    <td className="px-2 py-3 text-teal-700">
                      <ArrowRight className="h-4 w-4" />
                    </td>
                    <td className="px-4 py-3">
                      <Badge className="bg-teal-100 text-teal-900">{m.targetField}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono break-words">{m.value}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{m.page}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base text-muted-foreground">Mapping reference</CardTitle>
        </CardHeader>
        <CardContent className="max-h-48 overflow-auto p-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-muted-foreground">
                <th className="px-4 py-2 font-semibold">OCR label alias</th>
                <th className="px-4 py-2 font-semibold">→ Field</th>
              </tr>
            </thead>
            <tbody>
              {data.mappingTable.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-1.5">{row.sourceLabel}</td>
                  <td className="px-4 py-1.5 text-teal-800">{row.targetField}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
