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
}

export function ExtractedParametersTable({ tenderId, token }: Props) {
  const [refresh, setRefresh] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['discovered-parameters', tenderId, refresh],
    queryFn: () => api.getTenderDiscoveredParameters(token, tenderId, refresh),
    enabled: !!token,
    retry: 1,
  });

  const payload = data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        Running Dynamic Parameter Discovery on OCR records…
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-center text-sm text-red-600">
        {getErrorMessage(error, 'Could not load discovered parameters')}
      </p>
    );
  }

  if (!payload?.parameters?.length) {
    return (
      <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        No parameters discovered yet. Complete OCR, then click Re-extract.
      </p>
    );
  }

  return (
    <AllDiscoveredParametersTable
      parameters={payload.parameters.map((p, i) => ({
        ...p,
        id: p.id ?? `${p.sourcePage}-${i}-${p.parameterName}`,
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
              Mapped NIT report
            </Button>
          </Link>
        </div>
      }
    />
  );
}
