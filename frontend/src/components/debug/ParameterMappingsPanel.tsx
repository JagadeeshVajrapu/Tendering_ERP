'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ParameterMappingResult } from '@/types/parameterMapping';

interface Props {
  data: ParameterMappingResult;
}

export function ParameterMappingsPanel({ data }: Props) {
  return (
    <div className="space-y-4">
      <Card className="border-indigo-200 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-indigo-50/80 to-white pb-4">
          <CardTitle className="text-lg">Mapping Engine</CardTitle>
          <CardDescription>
            {data.mappedCount} mapped · {data.unmappedCount} unmapped · {data.totalDiscovered}{' '}
            discovered — maps parameters to master dataset fields
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {data.mappingExamples && data.mappingExamples.length > 0 && (
            <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-sm text-indigo-900">
              <p className="font-semibold">Examples</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {data.mappingExamples.map((ex) => (
                  <li key={ex.masterKey}>
                    {ex.sourceParameters.join(', ')} → <strong>{ex.masterField}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b bg-slate-50/80 pb-3">
          <CardTitle className="text-base">Mapped to master fields</CardTitle>
          <CardDescription>Discovered parameter → Master field | Value | Page</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!data.mappedFields.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No mappings yet.</p>
          ) : (
            <div className="max-h-[50vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-100">
                  <TableRow>
                    <TableHead className="font-semibold">Discovered parameter</TableHead>
                    <TableHead className="font-semibold">Master field</TableHead>
                    <TableHead className="min-w-[200px] font-semibold">Value</TableHead>
                    <TableHead className="w-16 font-semibold">Page</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.mappedFields.map((row) => (
                    <TableRow key={`${row.masterKey}-${row.sourceParameterName}-${row.sourcePage}`}>
                      <TableCell className="text-slate-700">{row.sourceParameterName}</TableCell>
                      <TableCell className="font-medium text-indigo-800">
                        {row.businessFieldName}
                        <span className="mt-0.5 block text-xs font-normal text-slate-500">
                          {row.mappingRule}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap break-words">{row.value}</TableCell>
                      <TableCell>{row.sourcePage}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!!data.unmappedParameters?.length && (
        <Card className="overflow-hidden border-amber-200 shadow-sm">
          <CardHeader className="border-b bg-amber-50/50 pb-3">
            <CardTitle className="text-base text-amber-900">Unmapped parameters</CardTitle>
            <CardDescription>No master field rule matched</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[40vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="w-16">Page</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.unmappedParameters.map((row, i) => (
                    <TableRow key={`${row.sourcePage}-${row.parameterName}-${i}`}>
                      <TableCell>{row.parameterName}</TableCell>
                      <TableCell className="max-w-md truncate">{row.parameterValue}</TableCell>
                      <TableCell>{row.sourcePage}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
