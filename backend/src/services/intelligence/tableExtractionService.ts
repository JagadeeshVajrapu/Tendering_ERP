import { PageText } from '../../types/intelligence';
import { extractSourceSnippet } from './fieldContextVerifier';
import { ProductionFieldDefinition } from './fieldDefinitions';
import { FieldCandidate } from './fieldLevelExtractor';

/** Structured table preserved from tender PDF text layer. */
export interface ExtractedTableRow {
  cells: string[];
}

export interface ExtractedTable {
  pageNumber: number;
  tableIndex: number;
  heading: string;
  columns: string[];
  rows: ExtractedTableRow[];
  /** Raw lines for context / AI verification */
  sourceLines: string[];
}

const TABLE_LINE =
  /(?:\|.+\|)|(?:\S(?:\s{2,}\S)+)|(?:\t\S)/;

const HEADING_LINE =
  /^(?:sl\.?\s*no|sr\.?\s*no|particulars|description|details|amount|value|remarks)/i;

function splitColumns(line: string): string[] {
  const trimmed = line.trim();
  if (trimmed.includes('|')) {
    return trimmed
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
  }
  if (trimmed.includes('\t')) {
    return trimmed.split('\t').map((c) => c.trim()).filter(Boolean);
  }
  const bySpaces = trimmed.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
  if (bySpaces.length >= 2) return bySpaces;
  const colon = trimmed.match(/^(.{2,55}?)\s*[:–-]\s*(.+)$/);
  if (colon) return [colon[1].trim(), colon[2].trim()];
  return [trimmed];
}

function isTableLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 4) return false;
  if (TABLE_LINE.test(t)) return true;
  if (/\t/.test(t)) return true;
  if (t.split(/\s{2,}/).length >= 2) return true;
  return false;
}

function detectTableHeading(lines: string[], startIdx: number): string {
  for (let i = startIdx - 1; i >= Math.max(0, startIdx - 4); i--) {
    const line = lines[i]?.trim() || '';
    if (line.length >= 6 && line.length <= 120 && !isTableLine(line)) {
      if (/annexure|schedule|table|form/i.test(line)) return line;
      if (/^[A-Z0-9][A-Za-z0-9\s\-–:()]+$/.test(line)) return line;
    }
  }
  const first = lines[startIdx]?.trim() || '';
  if (HEADING_LINE.test(first)) return 'Data Table';
  return '';
}

class TableExtractionService {
  /** Extract all structured tables from document pages. */
  extractFromPages(pages: PageText[]): ExtractedTable[] {
    const tables: ExtractedTable[] = [];

    for (const page of pages) {
      const lines = page.text.split('\n');
      let blockStart = -1;
      let blockLines: string[] = [];
      let tableIndex = 0;

      const flush = () => {
        if (blockLines.length < 2) {
          blockLines = [];
          blockStart = -1;
          return;
        }
        const parsed = this.parseTableBlock(page.pageNumber, tableIndex, blockLines, blockStart, lines);
        if (parsed) {
          tables.push(parsed);
          tableIndex++;
        }
        blockLines = [];
        blockStart = -1;
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isTableLine(line)) {
          if (blockStart < 0) blockStart = i;
          blockLines.push(line);
        } else if (blockLines.length) {
          flush();
        }
      }
      flush();
    }

    return tables;
  }

  private parseTableBlock(
    pageNumber: number,
    tableIndex: number,
    blockLines: string[],
    startIdx: number,
    allLines: string[]
  ): ExtractedTable | null {
    const rowCells = blockLines.map(splitColumns).filter((r) => r.length > 0);
    if (rowCells.length < 2) return null;

    const maxCols = Math.max(...rowCells.map((r) => r.length));
    const normalized = rowCells.map((r) => {
      const cells = [...r];
      while (cells.length < maxCols) cells.push('');
      return { cells };
    });

    let columns: string[] = [];
    let dataRows = normalized;

    const first = rowCells[0];
    if (first.length >= 2 && (HEADING_LINE.test(first.join(' ')) || first.every((c) => c.length < 40))) {
      columns = first.map((c) => c.trim());
      dataRows = normalized.slice(1);
    } else if (maxCols === 2) {
      columns = ['Parameter', 'Value'];
    } else {
      columns = first.map((_, i) => `Col ${i + 1}`);
    }

    const heading = detectTableHeading(allLines, startIdx);

    return {
      pageNumber,
      tableIndex,
      heading,
      columns,
      rows: dataRows,
      sourceLines: blockLines,
    };
  }

  /**
   * Generate field candidates from structured tables (first-class input).
   */
  candidatesFromTables(
    def: ProductionFieldDefinition,
    tables: ExtractedTable[],
    pageTextByPage: Map<number, string>
  ): FieldCandidate[] {
    const candidates: FieldCandidate[] = [];
    const labels = [...def.labels, ...(def.synonymLabels || [])];

    for (const table of tables) {
      for (const { label, value, rowIndex } of this.iterLabelValuePairs(table, labels)) {
        const pageText = pageTextByPage.get(table.pageNumber) || table.sourceLines.join('\n');
        const contextLine = table.sourceLines[rowIndex] || `${label}: ${value}`;
        const idx = pageText.indexOf(contextLine);
        const start = idx >= 0 ? idx : 0;

        candidates.push({
          value,
          page: table.pageNumber,
          confidence: 0,
          score: 12 + (table.heading ? 2 : 0),
          source: 'table',
          matchStart: start,
          sourceText: extractSourceSnippet(
            pageText,
            start,
            Math.max(value.length, contextLine.length)
          ),
        });
      }

      for (const col of table.columns) {
        for (const label of labels) {
          if (!col.toLowerCase().includes(label.toLowerCase())) continue;
          const colIdx = table.columns.findIndex((c) => c === col);
          for (const row of table.rows) {
            const val = row.cells[colIdx + 1] || row.cells[1] || '';
            if (!val || val.length < 2) continue;
            const pageText = pageTextByPage.get(table.pageNumber) || '';
            candidates.push({
              value: val.trim(),
              page: table.pageNumber,
              confidence: 0,
              score: 11,
              source: 'table',
              sourceText: `${table.heading} | ${col}: ${val}`.slice(0, 320),
            });
          }
        }
      }
    }

    return candidates;
  }

  private *iterLabelValuePairs(
    table: ExtractedTable,
    labels: string[]
  ): Generator<{ label: string; value: string; rowIndex: number }> {
    for (let ri = 0; ri < table.rows.length; ri++) {
      const cells = table.rows[ri].cells;
      if (cells.length < 2) continue;

      const head = cells[0].toLowerCase();
      for (const label of labels) {
        if (!head.includes(label.toLowerCase())) continue;
        const value = cells.slice(1).join(' ').trim();
        if (value.length >= 2) yield { label, value, rowIndex: ri };
      }

      if (cells.length >= 2) {
        const joined = cells.join(' ').toLowerCase();
        for (const label of labels) {
          const re = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^:]{0,20}[:\\s]+(.+)`, 'i');
          const m = joined.match(re);
          if (m?.[1]) yield { label, value: m[1].trim(), rowIndex: ri };
        }
      }
    }
  }

  tablesForPages(tables: ExtractedTable[], pageNumbers: number[]): ExtractedTable[] {
    const set = new Set(pageNumbers);
    return tables.filter((t) => set.has(t.pageNumber));
  }
}

export const tableExtractionService = new TableExtractionService();
