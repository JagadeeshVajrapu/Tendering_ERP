'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { Loader2, RefreshCw } from 'lucide-react';
import { getErrorMessage } from '@/lib/errorMessage';
import { AllDiscoveredParametersTable } from './AllDiscoveredParametersTable';

interface Props {
  tenderId: string;
  token: string;
  jobRunning?: boolean;
  ocrReady?: boolean;
}

export function ExtractedParametersTable({
  tenderId,
  token,
  jobRunning,
  ocrReady = true,
}: Props) {
  const [refresh, setRefresh] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['discovered-parameters', tenderId, refresh],
    queryFn: () => api.getTenderDiscoveredParameters(token, tenderId, refresh),
    enabled: !!token && ocrReady,
    retry: 1,
    refetchInterval: jobRunning ? 8000 : false,
  });

  const payload = data?.data;

  if (!ocrReady) {
    return (
      <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        Waiting for OCR to finish…
      </p>
    );
  }

  if (isLoading && !payload?.parameters?.length) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        Loading extracted parameters…
      </div>
    );
  }

  if (error && !payload?.parameters?.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {getErrorMessage(error, 'Parameters not ready yet')}
        {jobRunning ? ' — extraction is still running.' : ''}
      </p>
    );
  }

  if (!payload?.parameters?.length) {
    return (
      <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        {jobRunning
          ? 'Extracting parameters… table updates automatically.'
          : 'No parameters extracted yet. Click Re-extract or re-analyze the document.'}
      </p>
    );
  }

  return (
    <AllDiscoveredParametersTable
      parameters={payload.parameters.map((p, i) => ({
        id: `${p.sourcePage ?? (p as { pageNumber?: number }).pageNumber}-${i}-${p.parameterName}`,
        parameterName: p.parameterName,
        parameterValue: p.parameterValue,
        sourcePage: p.sourcePage ?? (p as { pageNumber?: number }).pageNumber ?? 0,
        confidence: p.confidence,
      }))}
      totalFound={payload.totalFound}
      pagesScanned={payload.pagesScanned}
      headerExtra={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => {
              setRefresh(true);
              refetch();
            }}
          >
            {isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Re-extract
          </Button>
          <Link href={`/tenders/${tenderId}/nit-analysis`}>
            <Button variant="outline" size="sm">
              NIT report
            </Button>
          </Link>
        </div>
      }
    />
  );
}
