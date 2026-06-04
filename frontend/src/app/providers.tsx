'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { getErrorMessage } from '@/lib/errorMessage';

function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        const msg = getErrorMessage(error);
        const benign =
          msg === 'No extraction found for this tender.' ||
          msg === 'Tender analysis not found. Upload and analyze a document first.' ||
          msg === 'No analysis results yet. Upload a document to begin.' ||
          msg === 'No intelligence job found for this tender.';
        if (benign) return;
        console.error('[Query]', msg);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => console.error('[Mutation]', getErrorMessage(error)),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        throwOnError: false,
      },
      mutations: {
        throwOnError: false,
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
