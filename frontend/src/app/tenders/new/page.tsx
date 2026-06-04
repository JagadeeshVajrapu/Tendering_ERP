'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Loader2, Upload } from 'lucide-react';

export default function NewTenderPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (file) {
        const res = await api.uploadTender(token!, file, { title: title || undefined });
        router.push(`/tenders/${res.data.tender._id}`);
      } else {
        const res = await api.createTender(token!, { title });
        router.push(`/tenders/${res.data._id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tender');
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Create New Tender</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Tender Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter tender title (optional if uploading document)"
              />
            </div>
            <div>
              <Label htmlFor="file">Upload Tender Document</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                PDF, DOC, or DOCX — AI analysis runs automatically after upload
              </p>
              <input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {file ? 'Uploading document...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {file ? 'Upload & Analyze Tender' : 'Create Tender'}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
