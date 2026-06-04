'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FieldLocatorDebugResponse, FieldLocatorFailure } from '@/types/fieldLocator';
import { Crosshair, FileText, AlertCircle } from 'lucide-react';
import { DiscoveredParametersPanel } from './DiscoveredParametersPanel';
import { MappedFieldsSummaryPanel } from './MappedFieldsSummaryPanel';

const METHOD_LABELS: Record<string, string> = {
  regex: 'Regex',
  keyword: 'Keyword',
  alias: 'Alias',
};

const FIELD_ORDER = [
  'Tender Number',
  'Organization',
  'EMD',
  'Tender Value',
  'Name of Work',
];

interface Props {
  data: FieldLocatorDebugResponse;
}

export function FieldLocatorViewer({ data }: Props) {
  const byName = new Map(data.fields.map((f) => [f.fieldName, f]));
  const failuresByName = new Map(
    (data.failedFields ?? []).map((f) => [f.fieldName, f])
  );

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-violet-50/40 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">
          Field Locator Engine
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Extracted fields with evidence</h1>
        {data.originalName && (
          <p className="mt-1 text-sm text-slate-600">{data.originalName}</p>
        )}
        <p className="mt-1 font-mono text-xs text-slate-500">Document ID: {data.documentId}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">
            All {data.pagesSearched} pages (priority 1–{data.priorityPages ?? 5})
          </Badge>
          <Badge className="bg-emerald-100 text-emerald-800">
            {data.foundCount} / {FIELD_ORDER.length} found
          </Badge>
          <Badge variant="secondary">No OpenAI</Badge>
          {data.debugMode && (
            <Badge className="bg-amber-200 text-amber-950">Debug mode — validation disabled</Badge>
          )}
          {data.matchMethods.map((m) => (
            <Badge key={m} variant="outline">
              {METHOD_LABELS[m] || m}
            </Badge>
          ))}
        </div>
      </header>

      <div className="space-y-4">
        {FIELD_ORDER.map((name) => {
          const field = byName.get(name);
          const fail = failuresByName.get(name);
          const debugCandidates =
            name === 'EMD'
              ? fail?.amountDebug?.emdCandidates ?? field?.amountDebug?.emdCandidates
              : name === 'Tender Value'
                ? fail?.amountDebug?.tenderValueCandidates ?? field?.amountDebug?.tenderValueCandidates
                : undefined;
          const displayValue =
            field?.value ??
            (data.debugMode && fail?.amountDebug?.selectedAmount
              ? fail.amountDebug.selectedAmount
              : null);
          return (
            <Card
              key={name}
              className={field ? 'border-slate-200' : 'border-amber-200 bg-amber-50/30'}
            >
              <CardHeader className="border-b bg-slate-50/80 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Crosshair className="h-4 w-4 text-violet-600" />
                  <CardTitle className="text-base">{name}</CardTitle>
                  {displayValue ? (
                    <>
                      <Badge variant="secondary">
                        {field
                          ? METHOD_LABELS[field.extractionMethod] || field.extractionMethod
                          : 'Candidate'}
                      </Badge>
                      {field && typeof field.confidence === 'number' && (
                        <Badge variant="outline">{field.confidence}% confidence</Badge>
                      )}
                      {!field && data.debugMode && (
                        <Badge className="bg-amber-100 text-amber-800">Candidate only</Badge>
                      )}
                    </>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800">Not found</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {displayValue ? (
                  <>
                    <div>
                      <p className="text-xs font-medium uppercase text-muted-foreground">Value</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{displayValue}</p>
                    </div>
                    {field && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground">
                              Source Page
                            </p>
                            <p className="mt-1 flex items-center gap-2 font-medium tabular-nums">
                              <FileText className="h-4 w-4 text-slate-500" />
                              {field.sourcePage}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground">
                              Extraction Method
                            </p>
                            <p className="mt-1 font-medium">
                              {METHOD_LABELS[field.extractionMethod] || field.extractionMethod}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase text-muted-foreground">
                            Source Text
                          </p>
                          <pre className="mt-2 max-h-32 overflow-auto rounded-lg border bg-slate-50 p-3 font-mono text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
                            {field.sourceText || '(line not captured)'}
                          </pre>
                        </div>
                      </>
                    )}
                    {(field?.amountDebug || fail?.amountDebug) &&
                      (name === 'EMD' || name === 'Tender Value') && (
                        <AmountDebugPanel
                          debug={(field?.amountDebug ?? fail?.amountDebug)!}
                          fieldName={name}
                        />
                      )}
                    {data.debugMode && debugCandidates && debugCandidates.length > 0 && (
                      <p className="text-xs text-amber-800">
                        Showing all {debugCandidates.length} candidate(s) below (debug mode).
                      </p>
                    )}
                  </>
                ) : (
                  <FailedFieldDebug failure={fail} pagesSearched={data.pagesSearched} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {data.labelValueMappings && data.labelValueMappings.length > 0 && (
        <MappedFieldsSummaryPanel mappedFields={data.labelValueMappings} />
      )}

      {data.discoveredParameters && (
        <DiscoveredParametersPanel data={data.discoveredParameters} />
      )}
    </div>
  );
}

function AmountDebugPanel({
  debug,
  fieldName,
}: {
  debug: import('@/types/fieldLocator').AmountExtractionDebug;
  fieldName?: string;
}) {
  const isEmd = fieldName === 'EMD';
  const isTenderValue = fieldName === 'Tender Value';
  const isClauseBased = isEmd || isTenderValue;

  return (
    <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-3 text-xs">
      <dl className="grid gap-2">
        {isEmd && debug.emdExtractionRule && (
          <div>
            <dt className="font-semibold text-muted-foreground">Extraction rule</dt>
            <dd className="font-mono">{debug.emdExtractionRule}</dd>
          </div>
        )}
        <div>
          <dt className="font-semibold text-muted-foreground">Winning keyword</dt>
          <dd>{debug.keywordFound || '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Selected amount</dt>
          <dd className="font-mono font-semibold text-violet-900">{debug.selectedAmount || '—'}</dd>
        </div>
        {!isClauseBased && (
          <div>
            <dt className="font-semibold text-muted-foreground">Distance from keyword</dt>
            <dd>{debug.distanceFromKeyword != null ? `${debug.distanceFromKeyword} chars` : '—'}</dd>
          </div>
        )}
      </dl>

      {isEmd && debug.percentageValidation && (
        <dl className="grid gap-2 rounded border border-emerald-200 bg-emerald-50/60 p-2">
          <div>
            <dt className="font-semibold text-muted-foreground">Percentage validation</dt>
            <dd>
              EMD @ {debug.percentageValidation.emdPercent}% of {debug.percentageValidation.tenderValue}{' '}
              → {debug.percentageValidation.calculatedEmd}
              {debug.percentageValidation.matched ? ' ✓ within ±5%' : ' ✗ no match'}
            </dd>
          </div>
        </dl>
      )}

      {isTenderValue && debug.tenderValueCrossValidation && (
        <dl className="grid gap-2 rounded border border-emerald-200 bg-emerald-50/60 p-2">
          <div>
            <dt className="font-semibold text-muted-foreground">EMD cross-validation</dt>
            <dd>
              {debug.tenderValueCrossValidation.emdAmount} @ {debug.tenderValueCrossValidation.emdPercent}% →{' '}
              {debug.tenderValueCrossValidation.calculatedTenderValue} ({debug.tenderValueCrossValidation.formula})
              {debug.tenderValueCrossValidation.matched ? ' ✓ within ±5%' : ' ✗ no match'}
            </dd>
          </div>
        </dl>
      )}

      {isTenderValue && debug.tenderValueCandidates && debug.tenderValueCandidates.length > 0 && (
        <div>
          <p className="mb-1 font-semibold text-muted-foreground">
            Tender Value candidates ({debug.tenderValueCandidates.length})
          </p>
          <ul className="max-h-56 space-y-2 overflow-auto">
            {debug.tenderValueCandidates.map((c, i) => (
              <li
                key={i}
                className={`rounded border p-2 ${
                  c.selected
                    ? 'border-violet-400 bg-violet-100'
                    : c.accepted
                      ? 'bg-white/80'
                      : 'border-red-200 bg-red-50/50'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {c.selected && (
                    <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      SELECTED
                    </span>
                  )}
                  <span className="font-mono font-semibold">{c.amount}</span>
                  <span className="text-muted-foreground">p.{c.page}</span>
                  <span className="text-muted-foreground">w.{c.pageWeight}</span>
                  <span className="text-muted-foreground">{c.label}</span>
                </div>
                <p className="mt-1 text-slate-600 break-words">{c.context}</p>
                {c.reasonAccepted && <p className="mt-1 text-emerald-800">✓ {c.reasonAccepted}</p>}
                {c.reasonRejected && <p className="mt-1 text-red-800">✗ {c.reasonRejected}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isEmd && debug.emdCandidates && debug.emdCandidates.length > 0 && (
        <div>
          <p className="mb-1 font-semibold text-muted-foreground">
            EMD candidates ({debug.emdCandidates.length})
          </p>
          <ul className="max-h-56 space-y-2 overflow-auto">
            {debug.emdCandidates.map((c, i) => (
              <li
                key={i}
                className={`rounded border p-2 ${
                  c.selected
                    ? 'border-violet-400 bg-violet-100'
                    : c.accepted
                      ? 'bg-white/80'
                      : 'border-red-200 bg-red-50/50'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {c.selected && (
                    <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      SELECTED
                    </span>
                  )}
                  <span className="font-mono font-semibold">{c.amount}</span>
                  <span className="text-muted-foreground">p.{c.page}</span>
                  <span className="text-muted-foreground">w.{c.pageWeight}</span>
                  <span className="text-muted-foreground">{c.keyword}</span>
                </div>
                <p className="mt-1 text-slate-600 break-words">{c.context}</p>
                {c.reasonAccepted && (
                  <p className="mt-1 text-emerald-800">✓ {c.reasonAccepted}</p>
                )}
                {c.reasonRejected && (
                  <p className="mt-1 text-red-800">✗ {c.reasonRejected}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {debug.keywordMatches && debug.keywordMatches.length > 0 && !isClauseBased && (
        <div>
          <p className="mb-1 font-semibold text-muted-foreground">
            Keyword matches ({debug.keywordMatches.length})
          </p>
          <ul className="max-h-40 space-y-2 overflow-auto">
            {debug.keywordMatches.map((m, i) => (
              <li key={i} className="rounded border bg-white/80 p-2 font-mono">
                <span className="text-violet-700">p.{m.page}</span> · {m.keyword}
                <p className="mt-1 text-slate-600 whitespace-pre-wrap break-words">{m.context}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {debug.scoredCandidates && debug.scoredCandidates.length > 0 && !isClauseBased && (
        <div>
          <p className="mb-1 font-semibold text-muted-foreground">
            Scored candidates ({debug.scoredCandidates.length})
          </p>
          <ul className="max-h-48 space-y-2 overflow-auto">
            {[...debug.scoredCandidates]
              .sort((a, b) => b.score - a.score)
              .map((c, i) => (
                <li
                  key={i}
                  className={`rounded border p-2 ${c.selected ? 'border-violet-400 bg-violet-100' : 'bg-white/80'}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {c.selected && (
                      <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        SELECTED
                      </span>
                    )}
                    <span className="font-mono font-semibold">{c.amount}</span>
                    <span className="text-muted-foreground">score {c.score}</span>
                    <span className="text-muted-foreground">p.{c.page}</span>
                    <span className="text-muted-foreground">{c.keyword}</span>
                    <span className="text-muted-foreground">{c.distanceFromKeyword}ch</span>
                  </div>
                  <p className="mt-1 text-slate-600">{c.scoreBreakdown.join(' · ')}</p>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FailedFieldDebug({
  failure,
  pagesSearched,
}: {
  failure?: FieldLocatorFailure;
  pagesSearched: number;
}) {
  if (!failure) {
    return (
      <p className="flex items-center gap-2 text-sm text-amber-800">
        <AlertCircle className="h-4 w-4 shrink-0" />
        No match across {pagesSearched} pages.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm text-amber-900">
      <p className="flex items-center gap-2 font-medium">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {failure.failureReason}
      </p>
      <dl className="grid gap-2 rounded-lg border border-amber-200 bg-white/60 p-3 text-xs">
        <div>
          <dt className="font-semibold text-muted-foreground">Pages searched</dt>
          <dd>{failure.pagesSearched}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Regex used</dt>
          <dd className="font-mono break-all">
            {failure.regexUsed.length ? failure.regexUsed.join(' · ') : '—'}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Aliases / keywords</dt>
          <dd>{failure.aliasesUsed.join(', ')}</dd>
        </div>
        {(failure.fieldName === 'EMD' || failure.fieldName === 'Tender Value') &&
          failure.amountDebug && (
            <AmountDebugPanel debug={failure.amountDebug} fieldName={failure.fieldName} />
          )}
        {failure.pageSearched != null && (
          <div>
            <dt className="font-semibold text-muted-foreground">Page searched (last hit)</dt>
            <dd>{failure.pageSearched}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
