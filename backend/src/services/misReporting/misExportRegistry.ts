import { MisExportDescriptor, MisExportFormat } from '../../types/misReporting';

/**
 * Export-ready registry — implementations deferred to a future phase.
 * Services and controllers can enumerate available export targets without coupling to exporters.
 */
const EXPORT_SECTIONS = [
  'dashboard',
  'tender-performance',
  'tender-value',
  'service-category',
  'finance-summary',
  'contracts',
  'revenue',
  'alerts',
  'recent-activity',
] as const;

const EXPORT_FORMATS: MisExportFormat[] = ['excel', 'pdf', 'csv'];

export function listMisExportDescriptors(): MisExportDescriptor[] {
  const descriptors: MisExportDescriptor[] = [];
  for (const section of EXPORT_SECTIONS) {
    for (const format of EXPORT_FORMATS) {
      descriptors.push({
        section,
        format,
        label: `${section.replace(/-/g, ' ')} (${format.toUpperCase()})`,
        enabled: false,
      });
    }
  }
  return descriptors;
}

export interface MisExportRequest {
  section: string;
  format: MisExportFormat;
  filters: Record<string, unknown>;
}

export class MisExportNotImplementedError extends Error {
  constructor(section: string, format: MisExportFormat) {
    super(`Export ${format} for section "${section}" is not implemented yet`);
    this.name = 'MisExportNotImplementedError';
  }
}

/** Placeholder for future export pipeline */
export async function requestMisExport(_req: MisExportRequest): Promise<never> {
  throw new MisExportNotImplementedError(_req.section, _req.format);
}
