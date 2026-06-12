'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const PdfViewerClient = dynamic(() => import('./PdfViewerClient'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Initializing PDF viewer…
    </div>
  ),
});

interface Props {
  token: string;
  tenderId: string;
  documentId: string | null;
  documentName?: string;
}

export function PdfViewer(props: Props) {
  return <PdfViewerClient {...props} />;
}
