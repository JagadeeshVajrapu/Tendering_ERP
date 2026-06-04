'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MappedLabelValueField } from '@/types/labelValueMapping';
import { ArrowRight } from 'lucide-react';

/** Compact mapped-fields view for Field Locator (no full mapping API payload). */
export function MappedFieldsSummaryPanel({ mappedFields }: { mappedFields: MappedLabelValueField[] }) {
  if (!mappedFields.length) return null;

  return (
    <Card className="border-teal-200 bg-teal-50/30">
      <CardHeader className="py-3">
        <CardTitle className="text-base">Label–value mapping layer</CardTitle>
        <p className="text-xs font-normal text-muted-foreground">
          Applied after extraction to fill canonical fields
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-white/60 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-semibold">Source label</th>
              <th className="px-2 py-2 w-8" />
              <th className="px-4 py-2 font-semibold">Field</th>
              <th className="px-4 py-2 font-semibold">Value</th>
              <th className="px-4 py-2 font-semibold">Page</th>
            </tr>
          </thead>
          <tbody>
            {mappedFields.map((m) => (
              <tr key={m.targetField} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{m.sourceLabel}</td>
                <td className="px-2 py-2 text-teal-700">
                  <ArrowRight className="h-4 w-4" />
                </td>
                <td className="px-4 py-2">
                  <Badge className="bg-teal-100 text-teal-900">{m.targetField}</Badge>
                </td>
                <td className="px-4 py-2 font-mono break-words">{m.value}</td>
                <td className="px-4 py-2 text-muted-foreground tabular-nums">{m.page}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
