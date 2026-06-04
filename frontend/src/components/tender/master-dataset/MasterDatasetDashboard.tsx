'use client';

import { useMemo, useState } from 'react';
import {
  Database,
  AlertTriangle,
  CheckCircle2,
  FileText,
  BarChart3,
  Layers,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatasetToolbar } from './DatasetToolbar';
import { DatasetSection } from './DatasetSection';
import {
  MASTER_DATASET_SECTIONS,
  MASTER_FIELD_LABELS,
  LOW_CONFIDENCE_THRESHOLD,
} from '@/lib/masterDatasetSections';
import { exportDatasetCsv, exportDatasetExcel } from '@/lib/datasetExport';
import type {
  DatasetFilterMode,
  DatasetRowView,
  MasterTenderDatasetResponse,
} from '@/types/masterDataset';

interface Props {
  data: MasterTenderDatasetResponse;
  tenderTitle?: string;
}

function buildAllRows(data: MasterTenderDatasetResponse): DatasetRowView[] {
  return MASTER_DATASET_SECTIONS.flatMap((section) =>
    section.fields.map((key) => ({
      key,
      parameter: MASTER_FIELD_LABELS[key],
      sectionId: section.id,
      sectionTitle: section.title,
      field: data.dataset[key],
    }))
  );
}

function applyFilters(rows: DatasetRowView[], search: string, filter: DatasetFilterMode): DatasetRowView[] {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    const hasValue = !!row.field.value.trim();
    const lowConfidence = hasValue && row.field.confidence < LOW_CONFIDENCE_THRESHOLD;

    if (filter === 'populated' && !hasValue) return false;
    if (filter === 'low_confidence' && !lowConfidence) return false;
    if (filter === 'missing' && hasValue) return false;

    if (!q) return true;
    return (
      row.parameter.toLowerCase().includes(q) ||
      row.field.value.toLowerCase().includes(q) ||
      row.sectionTitle.toLowerCase().includes(q) ||
      row.field.sourceText.toLowerCase().includes(q)
    );
  });
}

export function MasterDatasetDashboard({ data, tenderTitle }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DatasetFilterMode>('all');

  const allRows = useMemo(() => buildAllRows(data), [data]);
  const filteredRows = useMemo(() => applyFilters(allRows, search, filter), [allRows, search, filter]);

  const rowsBySection = useMemo(() => {
    const map = new Map<string, DatasetRowView[]>();
    for (const section of MASTER_DATASET_SECTIONS) {
      map.set(
        section.id,
        filteredRows.filter((r) => r.sectionId === section.id)
      );
    }
    return map;
  }, [filteredRows]);

  const exportBaseName = `tender-dataset-${data.tenderId.slice(-8)}`;

  const stats = [
    {
      label: 'Fields Populated',
      value: `${data.statistics.populatedFields}/${data.statistics.totalFields}`,
      icon: CheckCircle2,
      tone: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Avg Confidence',
      value: `${data.statistics.averageConfidence}%`,
      icon: BarChart3,
      tone: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Needs Review',
      value: String(data.statistics.lowConfidenceFields),
      icon: AlertTriangle,
      tone: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'OCR Pages',
      value: String(data.provenance.ocrPageCount),
      icon: FileText,
      tone: 'text-slate-600 bg-slate-100',
    },
  ];

  return (
    <div className="master-dataset space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700">
              <Database className="h-4 w-4" />
              Master Tender Dataset
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Single Source of Truth
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{tenderTitle || 'Tender Extraction'}</h2>
            {data.originalName && (
              <p className="mt-1 text-sm text-slate-600">
                Source document: <span className="font-medium">{data.originalName}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <MetaChip icon={Layers} label={`${data.provenance.ruleExtractedCount} rule matches`} />
            <MetaChip icon={CheckCircle2} label={`${data.provenance.validatedCount} validated`} />
            <MetaChip icon={BarChart3} label={`${data.provenance.aiVerifiedCount} AI verified`} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${stat.tone}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold tabular-nums text-slate-900">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {data.lowConfidenceFields.length > 0 && filter !== 'low_confidence' && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              {data.lowConfidenceFields.length} field{data.lowConfidenceFields.length > 1 ? 's' : ''} below {LOW_CONFIDENCE_THRESHOLD}% confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.lowConfidenceFields.map((f) => (
                <span
                  key={f.field}
                  className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200"
                >
                  {MASTER_FIELD_LABELS[f.field]} ({f.confidence}%)
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <DatasetToolbar
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        resultCount={filteredRows.length}
        totalCount={allRows.length}
        onExportCsv={() => exportDatasetCsv(filteredRows, exportBaseName)}
        onExportExcel={() => exportDatasetExcel(filteredRows, exportBaseName)}
      />

      <div className="space-y-6">
        {MASTER_DATASET_SECTIONS.map((section) => (
          <DatasetSection
            key={section.id}
            section={section}
            rows={rowsBySection.get(section.id) || []}
          />
        ))}
      </div>

      {filteredRows.length === 0 && (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">No fields match your search or filter criteria.</p>
        </div>
      )}
    </div>
  );
}

function MetaChip({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
