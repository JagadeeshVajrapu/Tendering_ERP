'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessage';
import { useAuthStore } from '@/stores/authStore';
import type { TenderExtraction, TenderExtractedField } from '@/types';
import { Loader2, Upload } from 'lucide-react';

function confidenceVariant(conf: number): 'default' | 'destructive' | 'secondary' {
  if (conf < 80) return 'destructive';
  if (conf < 90) return 'secondary';
  return 'default';
}

function FieldTable({ fields }: { fields: TenderExtractedField[] }) {
  if (!fields.length) return null;
  return (
    <table className="w-full border-collapse border border-slate-200 text-sm">
      <thead>
        <tr className="bg-slate-50">
          <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Field Name</th>
          <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Value</th>
          <th className="border border-slate-200 px-3 py-2 text-left font-semibold">Confidence</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((f) => (
          <tr key={f.fieldName}>
            <td className="border border-slate-200 px-3 py-2 font-medium">{f.fieldName}</td>
            <td className="border border-slate-200 px-3 py-2">{f.value}</td>
            <td className="border border-slate-200 px-3 py-2">
              <Badge variant={confidenceVariant(f.confidence)}>{f.confidence}</Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TenderExtractionPanel({ tenderId }: { tenderId: string }) {
  const { token } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const { data, refetch } = useQuery({
    queryKey: ['tender-extraction', tenderId],
    queryFn: () => api.getTenderExtraction(token!, tenderId),
    enabled: !!token,
    retry: false,
    refetchInterval: (q) => {
      const e = q.state.data?.data?.extraction;
      if (!e) return false;
      if (e.status === 'ai_verification_complete' || e.status === 'failed') return false;
      return 3000;
    },
  });

  const extraction: TenderExtraction | null = data?.data?.extraction || null;

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Select a file first');
      return api.uploadTenderExtraction(token!, file, { tenderId });
    },
    onSuccess: () => {
      setError('');
      refetch();
    },
    onError: (err) => setError(getErrorMessage(err, 'Upload failed')),
  });

  const statusLabel = useMemo(() => {
    if (!extraction) return 'Not started';
    if (extraction.status === 'uploaded') return 'Queued';
    if (extraction.status === 'processing') return 'Processing';
    if (extraction.status === 'text_extracted') return 'OCR Complete';
    if (extraction.status === 'rule_analysis_complete') return 'Rule Analysis Complete';
    if (extraction.status === 'ai_verification_complete') return 'AI Verification Complete';
    if (extraction.status === 'failed') return 'Failed';
    return extraction.status;
  }, [extraction]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Tender Document Analysis</span>
          <Badge variant={extraction?.status === 'failed' ? 'destructive' : 'secondary'}>{statusLabel}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            {extraction ? (
              <>
                Progress: <span className="font-semibold">{extraction.progress}%</span>
              </>
            ) : (
              'Upload a tender document (PDF/DOCX/Image) to extract fields.'
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".pdf,.docx,.png,.jpg,.jpeg,.tiff"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <Button onClick={() => upload.mutate()} disabled={!file || upload.isPending}>
              {upload.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Extract
                </>
              )}
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {extraction?.errorMessage && <p className="text-sm text-red-600">{extraction.errorMessage}</p>}

        <FieldTable fields={extraction?.extractedFields || []} />
      </CardContent>
    </Card>
  );
}

