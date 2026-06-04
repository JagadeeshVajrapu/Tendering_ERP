'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errorMessage';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  const message = getErrorMessage(error, 'An unexpected error occurred');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold text-slate-900">Something went wrong</h2>
      <p className="max-w-md text-center text-sm text-slate-600">{message}</p>
      <Button type="button" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
