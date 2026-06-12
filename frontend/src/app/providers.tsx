'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { getErrorMessage, isApiUnreachableError } from '@/lib/errorMessage';

let lastApiUnreachableLogAt = 0;

function isBenignQueryError(msg: string): boolean {
  return (
    msg === 'No extraction found for this tender.' ||
    msg === 'Tender analysis not found. Upload and analyze a document first.' ||
    msg === 'No analysis results yet. Upload a document to begin.' ||
    msg === 'No intelligence job found for this tender.' ||
    msg === 'Document not found' ||
    msg === 'Select a document first' ||
    msg.includes('OCR has not completed') ||
    msg.includes('awaiting_ocr') ||
    msg.includes('awaiting_ai_quota') ||
    /quota exceeded|exceeded your current quota|rate limit|too many requests/i.test(msg)
  );
}

function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        const msg = getErrorMessage(error);
        if (isBenignQueryError(msg)) return;
        if (isApiUnreachableError(error)) {
          const now = Date.now();
          if (now - lastApiUnreachableLogAt < 15_000) return;
          lastApiUnreachableLogAt = now;
          console.warn('[Query] API server unreachable — start backend: cd backend && npm run dev');
          return;
        }
        console.error('[Query]', msg);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        const msg = getErrorMessage(error);
        if (isBenignQueryError(msg)) return;
        if (isApiUnreachableError(error)) {
          const now = Date.now();
          if (now - lastApiUnreachableLogAt < 15_000) return;
          lastApiUnreachableLogAt = now;
          console.warn('[Mutation] API server unreachable — start backend: cd backend && npm run dev');
          return;
        }
        console.error('[Mutation]', msg);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isBenignQueryError(getErrorMessage(error))) return false;
          if (isApiUnreachableError(error)) return failureCount < 3;
          return failureCount < 1;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
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
