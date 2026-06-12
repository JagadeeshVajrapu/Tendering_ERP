'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { PreparationAuditLogItem } from '@/types/documentPreparation';

interface Props {
  token: string;
  tenderId: string;
  documentId: string | null;
}

function formatUser(userId: PreparationAuditLogItem['userId']): string {
  if (typeof userId === 'string') return userId;
  if (userId?.name) return `${userId.name}${userId.role ? ` (${userId.role})` : ''}`;
  return 'Unknown user';
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ');
}

export function PreparationAuditLogPanel({ token, tenderId, documentId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['preparation-audit-logs', tenderId, documentId],
    queryFn: () =>
      api.getPreparationAuditLogs(token, tenderId, {
        documentId: documentId || undefined,
        limit: 50,
      }),
    enabled: !!token,
  });

  const logs = data?.data?.logs ?? [];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-slate-700" />
        <h3 className="text-sm font-semibold text-slate-900">Audit log</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Tracks user, action, time, document, and signature events
        {documentId ? ' for the selected document' : ' across this tender'}.
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading audit trail…
        </div>
      )}

      {!isLoading && logs.length === 0 && (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-muted-foreground">
          No audit events recorded yet.
        </p>
      )}

      {logs.length > 0 && (
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-2">Time</th>
                <th className="py-2 pr-2">User</th>
                <th className="py-2 pr-2">Action</th>
                <th className="py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2 text-xs text-muted-foreground whitespace-nowrap">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="py-2 pr-2 text-xs">{formatUser(log.userId)}</td>
                  <td className="py-2 pr-2 text-xs capitalize">{formatAction(log.action)}</td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {log.documentId && <span>Doc: {String(log.documentId).slice(-6)} </span>}
                    {log.metadata?.workflowId != null && (
                      <span>· Workflow: {String(log.metadata.workflowId).slice(-6)}</span>
                    )}
                    {log.ipAddress && <span> · IP: {log.ipAddress}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
