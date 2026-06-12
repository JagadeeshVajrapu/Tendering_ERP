'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Clock,
  Download,
  Eye,
  FileText,
  IndianRupee,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessage';
import { formatCurrency, formatDate } from '@/lib/utils';
import type {
  CreateFinanceRecordInput,
  FinanceDashboard,
  FinanceDocumentType,
  FinanceRecord,
  FinanceRecordType,
  RefundStatus,
} from '@/types/financeTracking';
import {
  DOCUMENT_TYPE_LABELS,
  RECORD_TYPE_LABELS,
  REFUND_STATUS_LABELS,
} from '@/types/financeTracking';
import { FinanceWorkflowSection } from '@/components/financeWorkflow/FinanceWorkflowSection';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api').replace(
  /\/api\/?$/,
  ''
);

const RECORD_TYPES: FinanceRecordType[] = [
  'EMD',
  'BG',
  'DD',
  'TENDER_FEE',
  'SECURITY_DEPOSIT',
  'PBG',
];

const DOCUMENT_TYPES: FinanceDocumentType[] = [
  'EMD_RECEIPT',
  'BG_COPY',
  'DD_COPY',
  'TENDER_FEE_RECEIPT',
  'SECURITY_DEPOSIT_RECEIPT',
  'PBG_COPY',
];

const EMPTY_FORM: CreateFinanceRecordInput = {
  recordType: 'EMD',
  amount: 0,
  bankName: '',
  referenceNumber: '',
  issueDate: '',
  expiryDate: '',
  status: '',
  remarks: '',
  paymentDate: '',
  paymentMode: '',
  transactionReferenceNumber: '',
  instrumentNumber: '',
  depositDate: '',
};

function alertBadge(level: string) {
  if (level === 'expired') return 'bg-red-100 text-red-800';
  if (level === '7_days') return 'bg-orange-100 text-orange-900';
  if (level === '15_days') return 'bg-amber-100 text-amber-900';
  return 'bg-yellow-100 text-yellow-900';
}

function refundBadge(status: RefundStatus) {
  const map: Record<RefundStatus, string> = {
    pending: 'bg-slate-100 text-slate-700',
    requested: 'bg-blue-100 text-blue-800',
    approved: 'bg-amber-100 text-amber-900',
    received: 'bg-emerald-100 text-emerald-800',
  };
  return map[status];
}

interface Props {
  token: string;
  tenderId: string;
  canEdit: boolean;
}

export function FinanceTrackingView({ token, tenderId, canEdit }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [recordTypeFilter, setRecordTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceRecord | null>(null);
  const [form, setForm] = useState<CreateFinanceRecordInput>(EMPTY_FORM);

  const [docType, setDocType] = useState<FinanceDocumentType>('EMD_RECEIPT');
  const [docRecordId, setDocRecordId] = useState('');

  const queryKey = ['finance-tracking', tenderId, page, search, recordTypeFilter, sortBy, sortOrder];

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      api.getTenderFinanceDashboard(token, tenderId, {
        page,
        limit: 15,
        search: search || undefined,
        recordType: recordTypeFilter || undefined,
        sortBy,
        sortOrder,
      }),
    enabled: !!token,
    staleTime: 0,
  });

  const dashboard: FinanceDashboard | null = data?.data ?? null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['finance-tracking', tenderId] });
  };

  const onSuccess = (msg: string) => {
    setError('');
    setMessage(msg);
    invalidate();
    void refetch();
  };

  const createMutation = useMutation({
    mutationFn: (body: CreateFinanceRecordInput) => api.createFinanceRecord(token, tenderId, body),
    onSuccess: () => {
      setShowForm(false);
      setForm(EMPTY_FORM);
      onSuccess('Finance record created');
    },
    onError: (err) => setError(getErrorMessage(err, 'Failed to create record')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CreateFinanceRecordInput> }) =>
      api.updateFinanceRecord(token, tenderId, id, body),
    onSuccess: () => {
      setShowForm(false);
      setEditingRecord(null);
      setForm(EMPTY_FORM);
      onSuccess('Finance record updated');
    },
    onError: (err) => setError(getErrorMessage(err, 'Failed to update record')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteFinanceRecord(token, tenderId, id),
    onSuccess: () => onSuccess('Finance record deleted'),
    onError: (err) => setError(getErrorMessage(err, 'Failed to delete record')),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      api.uploadFinanceDocument(token, tenderId, file, docType, docRecordId || undefined),
    onSuccess: () => onSuccess('Document uploaded'),
    onError: (err) => setError(getErrorMessage(err, 'Upload failed')),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => api.deleteFinanceDocument(token, tenderId, id),
    onSuccess: () => onSuccess('Document deleted'),
    onError: (err) => setError(getErrorMessage(err, 'Failed to delete document')),
  });

  const refundMutation = useMutation({
    mutationFn: ({ refundRecordId, status }: { refundRecordId: string; status: RefundStatus }) =>
      api.updateFinanceRefundStatus(token, tenderId, { refundRecordId, status }),
    onSuccess: () => onSuccess('Refund status updated'),
    onError: (err) => setError(getErrorMessage(err, 'Failed to update refund status')),
  });

  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    uploadMutation.isPending ||
    deleteDocMutation.isPending ||
    refundMutation.isPending;

  const summaryCards = useMemo(() => {
    if (!dashboard) return [];
    const s = dashboard.summary;
    return [
      { label: 'EMD', value: s.emdAmount },
      { label: 'BG', value: s.bgAmount },
      { label: 'DD', value: s.ddAmount },
      { label: 'Tender Fee', value: s.tenderFeeAmount },
      { label: 'Security Deposit', value: s.securityDepositAmount },
      { label: 'PBG', value: s.pbgAmount },
      { label: 'Pending Refund', value: s.pendingRefundAmount, highlight: true },
    ];
  }, [dashboard]);

  const openCreate = () => {
    setEditingRecord(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (record: FinanceRecord) => {
    setEditingRecord(record);
    setForm({
      recordType: record.recordType,
      amount: record.amount,
      bankName: record.bankName || '',
      referenceNumber: record.referenceNumber || '',
      issueDate: record.issueDate?.slice(0, 10) || '',
      expiryDate: record.expiryDate?.slice(0, 10) || '',
      status: record.status,
      remarks: record.remarks || '',
      paymentDate: record.paymentDate?.slice(0, 10) || '',
      paymentMode: record.paymentMode || '',
      transactionReferenceNumber: record.transactionReferenceNumber || '',
      instrumentNumber: record.instrumentNumber || '',
      depositDate: record.depositDate?.slice(0, 10) || '',
    });
    setShowForm(true);
  };

  const submitForm = () => {
    const payload = {
      ...form,
      amount: Number(form.amount),
      bankName: form.bankName || undefined,
      referenceNumber: form.referenceNumber || undefined,
      issueDate: form.issueDate || undefined,
      expiryDate: form.expiryDate || undefined,
      status: form.status || undefined,
      remarks: form.remarks || undefined,
      paymentDate: form.paymentDate || undefined,
      paymentMode: form.paymentMode || undefined,
      transactionReferenceNumber: form.transactionReferenceNumber || undefined,
      instrumentNumber: form.instrumentNumber || undefined,
      depositDate: form.depositDate || undefined,
    };
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const docAuthUrl = (documentId: string, mode: 'preview' | 'download') =>
    `${API_ORIGIN}/api/tenders/${tenderId}/finance/documents/${documentId}/${mode}`;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-20 text-muted-foreground">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-600" />
        Loading finance tracking…
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        Unable to load finance tracking data.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(message || error) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {error || message}
        </div>
      )}

      {/* Section 1: Summary */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Finance Summary</h2>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-lg border p-4 ${
                card.highlight ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(card.value)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Expiry Alerts (prominent when present) */}
      {dashboard.alerts.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-amber-950">
            <AlertTriangle className="h-5 w-5" />
            BG & PBG Expiry Alerts
          </h2>
          <ul className="space-y-2">
            {dashboard.alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm"
              >
                <span>{alert.message}</span>
                <Badge className={alertBadge(alert.alertLevel)}>
                  {alert.alertLevel === 'expired' ? 'Expired' : `Expires ${formatDate(alert.expiryDate)}`}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Section 2: Records */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Finance Records</h2>
          {canEdit && (
            <Button onClick={openCreate} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Record
            </Button>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search bank, reference, instrument…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearch(searchInput);
                  setPage(1);
                }
              }}
            />
          </div>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={recordTypeFilter}
            onChange={(e) => {
              setRecordTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            {RECORD_TYPES.map((t) => (
              <option key={t} value={t}>
                {RECORD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [by, order] = e.target.value.split(':');
              setSortBy(by);
              setSortOrder(order as 'asc' | 'desc');
            }}
          >
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="amount:desc">Amount high → low</option>
            <option value="amount:asc">Amount low → high</option>
            <option value="expiryDate:asc">Expiry soonest</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch(searchInput);
              setPage(1);
            }}
          >
            Search
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Bank / Instrument</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.records.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No finance records yet. Add EMD, BG, DD, or other instruments to begin tracking.
                  </TableCell>
                </TableRow>
              ) : (
                dashboard.records.items.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.recordType}</TableCell>
                    <TableCell>{formatCurrency(record.amount)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {record.bankName && <p>{record.bankName}</p>}
                        {(record.instrumentNumber || record.referenceNumber) && (
                          <p className="text-muted-foreground">
                            {record.instrumentNumber || record.referenceNumber}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {record.issueDate && <p>Issue: {formatDate(record.issueDate)}</p>}
                      {record.expiryDate && <p>Expiry: {formatDate(record.expiryDate)}</p>}
                      {record.paymentDate && <p>Payment: {formatDate(record.paymentDate)}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.status}</Badge>
                      {record.refundStatus && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Refund: {REFUND_STATUS_LABELS[record.refundStatus]}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(record)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            disabled={busy}
                            onClick={() => {
                              if (confirm('Delete this finance record?')) {
                                deleteMutation.mutate(record.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {dashboard.records.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {dashboard.records.page} of {dashboard.records.totalPages} ({dashboard.records.total} records)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= dashboard.records.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>

      <FinanceWorkflowSection token={token} tenderId={tenderId} canEdit={canEdit} />

      {/* Section 3: Refund Tracking + Report */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Refund Tracking</h2>
          <div className="text-sm text-muted-foreground">
            Total pending refund:{' '}
            <span className="font-semibold text-amber-800">
              {formatCurrency(dashboard.refundReport.totalPendingAmount)}
            </span>
          </div>
        </div>

        {dashboard.refunds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No refundable instruments tracked yet.</p>
        ) : (
          <div className="space-y-4">
            {dashboard.refunds.map((refund) => (
              <div key={refund.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {refund.instrumentType} — {refund.instrumentLabel}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(refund.amount)}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {refund.requestDate && <span>Requested: {formatDate(refund.requestDate)}</span>}
                      {refund.approvalDate && <span>Approved: {formatDate(refund.approvalDate)}</span>}
                      {refund.receivedDate && <span>Received: {formatDate(refund.receivedDate)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={refundBadge(refund.status)}>{REFUND_STATUS_LABELS[refund.status]}</Badge>
                    {canEdit &&
                      refund.status !== 'received' &&
                      (['requested', 'approved', 'received'] as RefundStatus[])
                        .filter((s) => {
                          const order: RefundStatus[] = ['pending', 'requested', 'approved', 'received'];
                          return order.indexOf(s) > order.indexOf(refund.status);
                        })
                        .slice(0, 1)
                        .map((next) => (
                          <Button
                            key={next}
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => refundMutation.mutate({ refundRecordId: refund.id, status: next })}
                          >
                            Mark {REFUND_STATUS_LABELS[next]}
                          </Button>
                        ))}
                  </div>
                </div>
                {refund.history.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">History</p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {refund.history.map((h, i) => (
                        <li key={i}>
                          {formatDate(h.date)} — {REFUND_STATUS_LABELS[h.status]}
                          {h.updatedByName ? ` by ${h.updatedByName}` : ''}
                          {h.note ? ` (${h.note})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {dashboard.refundReport.items.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Refund Pending Report</h3>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Pending Since</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.refundReport.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        {item.instrumentType} — {item.instrumentLabel}
                      </TableCell>
                      <TableCell>{formatCurrency(item.amount)}</TableCell>
                      <TableCell>{formatDate(item.pendingSince)}</TableCell>
                      <TableCell>
                        <Badge className={refundBadge(item.currentStatus)}>
                          {REFUND_STATUS_LABELS[item.currentStatus]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </section>

      {/* Section 5: Documents */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Uploaded Documents</h2>

        {canEdit && (
          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Document type</label>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={docType}
                onChange={(e) => setDocType(e.target.value as FinanceDocumentType)}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Link to record (optional)</label>
              <select
                className="min-w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={docRecordId}
                onChange={(e) => setDocRecordId(e.target.value)}
              >
                <option value="">— None —</option>
                {dashboard.records.items.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.recordType} — {formatCurrency(r.amount)}
                  </option>
                ))}
              </select>
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate(file);
                e.target.value = '';
              }}
            />
            <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              {uploadMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload
            </Button>
          </div>
        )}

        {dashboard.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No financial documents uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{doc.originalName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{DOCUMENT_TYPE_LABELS[doc.documentType]}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(doc.uploadedAt)}
                      {doc.uploadedByName ? ` · ${doc.uploadedByName}` : ''}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <a
                          href={docAuthUrl(doc.id, 'preview')}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            e.preventDefault();
                            fetch(docAuthUrl(doc.id, 'preview'), {
                              headers: { Authorization: `Bearer ${token}` },
                            })
                              .then((r) => r.blob())
                              .then((blob) => window.open(URL.createObjectURL(blob), '_blank'));
                          }}
                        >
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </a>
                        <a
                          href={docAuthUrl(doc.id, 'download')}
                          onClick={(e) => {
                            e.preventDefault();
                            fetch(docAuthUrl(doc.id, 'download'), {
                              headers: { Authorization: `Bearer ${token}` },
                            })
                              .then((r) => r.blob())
                              .then((blob) => {
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = doc.originalName;
                                a.click();
                                URL.revokeObjectURL(url);
                              });
                          }}
                        >
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            disabled={busy}
                            onClick={() => {
                              if (confirm('Delete this document?')) deleteDocMutation.mutate(doc.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Section 6: Activity Timeline */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Clock className="h-5 w-5" />
          Activity Timeline
        </h2>
        {dashboard.activityLog.length === 0 ? (
          <p className="text-sm text-muted-foreground">No finance activity recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {dashboard.activityLog.map((entry) => (
              <li key={entry.id} className="flex gap-3 border-l-2 border-emerald-200 pl-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{entry.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.userName} · {formatDate(entry.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">
              {editingRecord ? 'Edit Finance Record' : 'Add Finance Record'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Record type</label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.recordType}
                  disabled={!!editingRecord}
                  onChange={(e) => setForm({ ...form, recordType: e.target.value as FinanceRecordType })}
                >
                  {RECORD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {RECORD_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Amount (₹)</label>
                <Input
                  type="number"
                  min={0}
                  value={form.amount || ''}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                />
              </div>
              {(form.recordType === 'BG' || form.recordType === 'DD' || form.recordType === 'PBG') && (
                <div>
                  <label className="mb-1 block text-xs font-medium">Bank name</label>
                  <Input
                    value={form.bankName || ''}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  />
                </div>
              )}
              {(form.recordType === 'BG' || form.recordType === 'PBG') && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      {form.recordType} number
                    </label>
                    <Input
                      value={form.instrumentNumber || ''}
                      onChange={(e) => setForm({ ...form, instrumentNumber: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium">Issue date</label>
                      <Input
                        type="date"
                        value={form.issueDate || ''}
                        onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">Expiry date</label>
                      <Input
                        type="date"
                        value={form.expiryDate || ''}
                        onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}
              {form.recordType === 'DD' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium">DD number</label>
                    <Input
                      value={form.instrumentNumber || ''}
                      onChange={(e) => setForm({ ...form, instrumentNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Issue date</label>
                    <Input
                      type="date"
                      value={form.issueDate || ''}
                      onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                    />
                  </div>
                </>
              )}
              {form.recordType === 'EMD' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium">Payment date</label>
                      <Input
                        type="date"
                        value={form.paymentDate || ''}
                        onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">Payment mode</label>
                      <Input
                        value={form.paymentMode || ''}
                        onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Transaction reference</label>
                    <Input
                      value={form.transactionReferenceNumber || ''}
                      onChange={(e) => setForm({ ...form, transactionReferenceNumber: e.target.value })}
                    />
                  </div>
                </>
              )}
              {form.recordType === 'TENDER_FEE' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Payment date</label>
                    <Input
                      type="date"
                      value={form.paymentDate || ''}
                      onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Transaction reference</label>
                    <Input
                      value={form.transactionReferenceNumber || ''}
                      onChange={(e) => setForm({ ...form, transactionReferenceNumber: e.target.value })}
                    />
                  </div>
                </>
              )}
              {form.recordType === 'SECURITY_DEPOSIT' && (
                <div>
                  <label className="mb-1 block text-xs font-medium">Deposit date</label>
                  <Input
                    type="date"
                    value={form.depositDate || ''}
                    onChange={(e) => setForm({ ...form, depositDate: e.target.value })}
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium">Remarks</label>
                <Input
                  value={form.remarks || ''}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingRecord(null);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancel
              </Button>
              <Button disabled={busy || !form.amount} onClick={submitForm}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <IndianRupee className="mr-2 h-4 w-4" />}
                {editingRecord ? 'Save changes' : 'Create record'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
