'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Building2, Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessage';
import type { CompanyTemplateData } from '@/types/documentPreparation';

interface Props {
  token: string;
  tenderId: string;
  activeDocumentId: string | null;
  activeDocumentName?: string;
  onRefresh: (selectId?: string) => void | Promise<void>;
  onSelectDocument: (id: string) => void;
  canEdit: boolean;
}

const EMPTY_TEMPLATE: CompanyTemplateData = {
  id: '',
  companyName: '',
  gst: '',
  pan: '',
  address: '',
  cin: '',
  msme: '',
  email: '',
  phone: '',
  updatedAt: '',
};

export function TemplateFillPanel({
  token,
  tenderId,
  activeDocumentId,
  activeDocumentName,
  onRefresh,
  onSelectDocument,
  canEdit,
}: Props) {
  const [form, setForm] = useState<CompanyTemplateData>(EMPTY_TEMPLATE);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data: templateResponse, isLoading } = useQuery({
    queryKey: ['company-template-data', tenderId],
    queryFn: () => api.getCompanyTemplateData(token, tenderId),
    enabled: !!token,
  });

  useEffect(() => {
    if (templateResponse?.data) setForm(templateResponse.data);
  }, [templateResponse?.data]);

  const saveTemplateMutation = useMutation({
    mutationFn: () => api.updateCompanyTemplateData(token, tenderId, form),
    onSuccess: (res) => {
      setForm(res.data);
      setMessage('Company template saved');
      setError('');
    },
    onError: (err) => setError(getErrorMessage(err, 'Failed to save template')),
  });

  const autoFillMutation = useMutation({
    mutationFn: () =>
      api.autoFillPreparationTemplate(token, tenderId, {
        documentId: activeDocumentId!,
        includeCoverPage: true,
      }),
    onSuccess: async (res) => {
      setMessage(
        `Auto-fill complete — “${res.data.document.displayName}” (${res.data.filledFields.join(', ')})`
      );
      setError('');
      await onRefresh(res.data.document.id);
      onSelectDocument(res.data.document.id);
    },
    onError: (err) => setError(getErrorMessage(err, 'Auto-fill failed')),
  });

  const updateField = (key: keyof CompanyTemplateData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const runAutoFill = () => {
    setError('');
    setMessage('');
    if (!activeDocumentId) {
      setError('Select a document to auto-fill');
      return;
    }
    autoFillMutation.mutate();
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Building2 className="h-4 w-4" />
          Template Auto-Fill
        </h3>
        <p className="text-xs text-muted-foreground">
          Company data is stored in the database and applied to{' '}
          {activeDocumentName || 'the selected PDF'} (cover page + form fields + header stamp).
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading company template…
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['companyName', 'Company Name'],
              ['gst', 'GST'],
              ['pan', 'PAN'],
              ['cin', 'CIN'],
              ['msme', 'MSME'],
              ['email', 'Email'],
              ['phone', 'Phone'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <Label className="text-xs">{label}</Label>
              <Input
                value={form[key] || ''}
                onChange={(e) => updateField(key, e.target.value)}
                className="h-8 text-sm"
                disabled={!canEdit}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label className="text-xs">Address</Label>
            <Input
              value={form.address || ''}
              onChange={(e) => updateField('address', e.target.value)}
              className="h-8 text-sm"
              disabled={!canEdit}
            />
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saveTemplateMutation.isPending}
            onClick={() => saveTemplateMutation.mutate()}
          >
            {saveTemplateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save company data
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={autoFillMutation.isPending || !activeDocumentId}
            onClick={runAutoFill}
          >
            {autoFillMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            Auto-fill active PDF
          </Button>
        </div>
      )}
    </div>
  );
}
