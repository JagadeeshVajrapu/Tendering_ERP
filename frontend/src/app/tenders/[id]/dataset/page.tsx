'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Master dataset UI removed — OCR extraction report is the source of truth. */
export default function TenderDatasetRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/tenders/${id}/nit-analysis`);
  }, [id, router]);

  return null;
}
