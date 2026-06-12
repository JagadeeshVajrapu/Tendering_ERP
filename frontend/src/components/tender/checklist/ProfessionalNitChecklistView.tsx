'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { DynamicChecklistCategory, DynamicChecklistItem, DynamicChecklistResult } from '@/types/dynamicChecklist';

interface Props {
  data: DynamicChecklistResult;
  userRole?: string;
  onWorkflowAction?: (itemId: string, checked: boolean) => void;
  pendingItemId?: string | null;
}

/** Checkbox reflects executive manual selection only. */
function isItemChecked(item: DynamicChecklistItem): boolean {
  return !!item.markedComplete;
}

function isItemPrepared(item: DynamicChecklistItem): boolean {
  return isItemChecked(item) || item.uploaded || item.status === 'approved' || item.status === 'uploaded';
}

function canToggleChecklist(userRole?: string): boolean {
  const role = userRole?.toLowerCase();
  return role === 'executive' || role === 'md' || role === 'manager';
}

function isHeaderType(t?: string): boolean {
  return (
    t === 'selection_header' ||
    t === 'experience_header' ||
    t === 'compliance_header'
  );
}

function isGroupedChildType(t?: string): boolean {
  return (
    t === 'state_option' ||
    t === 'iso_option' ||
    t === 'itr_year' ||
    t === 'experience_year' ||
    t === 'compliance_year'
  );
}

function parseFyStartYear(itemId: string): number {
  const match = itemId.match(/_fy_(\d{4})_/);
  return match ? parseInt(match[1], 10) : 0;
}

function sortGroupChildren(items: DynamicChecklistItem[]): DynamicChecklistItem[] {
  if (!items.length) return items;
  const firstType = items[0].itemType;
  if (firstType === 'state_option') {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }
  if (
    firstType === 'experience_year' ||
    firstType === 'compliance_year' ||
    firstType === 'itr_year'
  ) {
    return [...items].sort((a, b) => parseFyStartYear(b.id) - parseFyStartYear(a.id));
  }
  return items;
}

function RequirementTag({
  item,
  hideOptional,
}: {
  item: DynamicChecklistItem;
  hideOptional?: boolean;
}) {
  if (isItemPrepared(item)) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
        Prepared
      </span>
    );
  }
  if (item.required) {
    return (
      <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-800">
        Required
      </span>
    );
  }
  if (hideOptional) return null;
  return (
    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      Optional
    </span>
  );
}

function ChecklistRow({
  item,
  canToggle,
  isPending,
  onToggle,
  indent = false,
  hideOptionalTag = false,
}: {
  item: DynamicChecklistItem;
  canToggle: boolean;
  isPending?: boolean;
  onToggle: (item: DynamicChecklistItem, checked: boolean) => void;
  indent?: boolean;
  hideOptionalTag?: boolean;
}) {
  const checked = isItemChecked(item);

  return (
    <div
      className={`flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0 ${
        indent ? 'pl-2' : ''
      } ${item.required && !checked ? 'bg-orange-50/30' : ''}`}
    >
      <Checkbox
        checked={checked}
        disabled={!canToggle || isPending}
        onCheckedChange={(next) => onToggle(item, next === true)}
        aria-label={`Mark ${item.name} as prepared`}
      />
      <span className={`min-w-0 flex-1 text-sm ${indent ? 'text-slate-600' : 'font-medium text-slate-800'}`}>
        {item.name}
      </span>
      <RequirementTag item={item} hideOptional={hideOptionalTag} />
    </div>
  );
}

function GroupedSelectionSection({
  header,
  children,
  canToggle,
  onToggle,
  pendingItemId,
  hint,
  subtitle,
}: {
  header: DynamicChecklistItem;
  children: DynamicChecklistItem[];
  canToggle: boolean;
  onToggle: (item: DynamicChecklistItem, checked: boolean) => void;
  pendingItemId?: string | null;
  hint?: string;
  subtitle?: string;
}) {
  const [open, setOpen] = useState(true);
  const sorted = sortGroupChildren(children);
  const selectedCount = sorted.filter((y) => isItemChecked(y)).length;

  return (
    <div className="border-b border-slate-200 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-slate-50/80 px-4 py-3 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-slate-800">{header.name}</span>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {selectedCount}/{sorted.length} selected
          {hint ? ` · ${hint}` : ''}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3">
          <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sorted.map((child) => (
              <ChecklistRow
                key={child.id}
                item={child}
                canToggle={canToggle}
                isPending={pendingItemId === child.id}
                onToggle={onToggle}
                indent
                hideOptionalTag
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function groupSubtitle(header: DynamicChecklistItem): string | undefined {
  if (header.id === 'gst_header') return 'Select state(s) where GST is registered';
  if (header.id === 'pf_registration_header') return 'Select state(s) for PF / EPF registration';
  if (header.id === 'esic_registration_header') return 'Select state(s) for ESIC / ESI registration';
  if (header.id === 'iso_header') return 'ISO types marked Required are mentioned in the NIT';
  if (header.id === 'itr_header') return 'Select ITR financial years to submit';
  if (header.itemType === 'experience_header') return 'Newest financial years shown first';
  return undefined;
}

type SectionSegment =
  | { kind: 'row'; item: DynamicChecklistItem }
  | { kind: 'group'; header: DynamicChecklistItem; children: DynamicChecklistItem[] };

/** Preserve backend catalog order — one row or dropdown group at a time. */
function buildOrderedSegments(items: DynamicChecklistItem[]): SectionSegment[] {
  const segments: SectionSegment[] = [];

  for (const item of items) {
    if (isGroupedChildType(item.itemType)) continue;
    if (isHeaderType(item.itemType)) {
      segments.push({
        kind: 'group',
        header: item,
        children: items.filter((child) => child.parentId === item.id),
      });
    } else {
      segments.push({ kind: 'row', item });
    }
  }

  return segments;
}

function SectionBlock({
  category,
  canToggle,
  onToggle,
  pendingItemId,
  minYears,
}: {
  category: DynamicChecklistCategory;
  canToggle: boolean;
  onToggle: (item: DynamicChecklistItem, checked: boolean) => void;
  pendingItemId?: string | null;
  minYears?: number;
}) {
  const segments = buildOrderedSegments(category.items);
  const completed = category.summary?.completed ?? 0;
  const required = category.summary?.required ?? 0;
  const pct = category.summary?.compliancePercentage ?? 0;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm print:break-inside-avoid">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">{category.title}</h3>
            {category.subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">({category.subtitle})</p>
            )}
          </div>
          {required > 0 && (
            <span className="shrink-0 text-xs font-medium text-emerald-700">
              {completed}/{required} · {pct}%
            </span>
          )}
        </div>
      </div>

      {segments.map((segment) =>
        segment.kind === 'row' ? (
          <div key={segment.item.id} className="px-4">
            <ChecklistRow
              item={segment.item}
              canToggle={canToggle}
              isPending={pendingItemId === segment.item.id}
              onToggle={onToggle}
            />
          </div>
        ) : (
          <GroupedSelectionSection
            key={segment.header.id}
            header={segment.header}
            children={segment.children}
            canToggle={canToggle}
            onToggle={onToggle}
            pendingItemId={pendingItemId}
            subtitle={groupSubtitle(segment.header)}
            hint={
              segment.header.itemType === 'experience_header' && minYears && minYears > 0
                ? `NIT requires ${minYears} yr`
                : undefined
            }
          />
        )
      )}
    </div>
  );
}

export function ProfessionalNitChecklistView({
  data,
  userRole,
  onWorkflowAction,
  pendingItemId,
}: Props) {
  const s = data.summary;
  const canToggle = canToggleChecklist(userRole);
  const compliancePct = s.compliancePercentage ?? s.readinessScore;

  const toggle = (item: DynamicChecklistItem, checked: boolean) => {
    if (!onWorkflowAction || !canToggle) return;
    onWorkflowAction(item.id, checked);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Compliance Score</p>
          <p className="text-2xl font-bold text-blue-900">{compliancePct}%</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Required</p>
          <p className="text-2xl font-bold text-slate-900">{s.required}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Completed</p>
          <p className="text-2xl font-bold text-emerald-700">{s.completed}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pending</p>
          <p className="text-2xl font-bold text-amber-700">{s.pending ?? s.missing}</p>
        </div>
      </div>

      {s.minimumExperienceYears && s.minimumExperienceYears > 0 && (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          NIT specifies <strong>{s.minimumExperienceYears} years</strong> experience.
          {s.suggestedExperienceYears?.length ? (
            <> Suggested FY years: <strong>{s.suggestedExperienceYears.join(', ')}</strong>.</>
          ) : null}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Expand each group to select states, ISO certificates, ITR years, or experience FY years.
        Documents mentioned in the NIT are marked <strong>Required</strong>.
        {!canToggle && (
          <span className="mt-1 block text-amber-700">
            Sign in as Executive or Manager to update checklist items.
          </span>
        )}
      </p>

      {data.categories.map((cat) => (
        <SectionBlock
          key={cat.id}
          category={cat}
          canToggle={canToggle}
          onToggle={toggle}
          pendingItemId={pendingItemId}
          minYears={s.minimumExperienceYears}
        />
      ))}
    </div>
  );
}
