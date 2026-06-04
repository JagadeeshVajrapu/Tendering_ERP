export interface CleanTextResult {
  text: string;
  removedHeaderFooterLines: number;
  removedPageNumberLines: number;
  mergedLines: number;
}

function normalizeWhitespace(s: string): string {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function removePageNumbers(lines: string[]): { lines: string[]; removed: number } {
  let removed = 0;
  const out = lines.filter((l) => {
    const t = l.trim();
    if (!t) return true;
    if (/^page\s*\d+\s*(of\s*\d+)?$/i.test(t)) {
      removed++;
      return false;
    }
    if (/^\d+\s*\/\s*\d+$/.test(t)) {
      removed++;
      return false;
    }
    return true;
  });
  return { lines: out, removed };
}

function stripRepeatedHeaderFooter(lines: string[]): { lines: string[]; removed: number } {
  // Heuristic: if a trimmed line repeats frequently across the doc, it’s probably header/footer.
  const freq = new Map<string, number>();
  for (const l of lines) {
    const t = l.trim();
    if (!t) continue;
    if (t.length < 6) continue;
    if (t.length > 120) continue;
    freq.set(t, (freq.get(t) || 0) + 1);
  }

  const threshold = Math.max(4, Math.floor(lines.length / 200)); // scales with doc length
  const blacklist = new Set(Array.from(freq.entries()).filter(([, c]) => c >= threshold).map(([t]) => t));

  let removed = 0;
  const out = lines.filter((l) => {
    const t = l.trim();
    if (!t) return true;
    if (blacklist.has(t)) {
      removed++;
      return false;
    }
    return true;
  });
  return { lines: out, removed };
}

function mergeBrokenLines(lines: string[]): { lines: string[]; merged: number } {
  // Merge lines that are likely wrapped mid-sentence.
  const out: string[] = [];
  let merged = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      out.push('');
      continue;
    }
    const prev = out.length ? out[out.length - 1] : '';
    if (!prev) {
      out.push(line);
      continue;
    }

    const prevEndsCleanly = /[.:;)\]]$/.test(prev);
    const prevLooksLikeLabel = /:\s*$/.test(prev);
    const startsWithBullet = /^[-*•]\s+/.test(line);
    const startsWithUpper = /^[A-Z]/.test(line);

    if (!prevEndsCleanly && !prevLooksLikeLabel && !startsWithBullet && !startsWithUpper) {
      out[out.length - 1] = `${prev} ${line}`;
      merged++;
      continue;
    }

    out.push(line);
  }

  return { lines: out, merged };
}

export function cleanExtractedText(input: string): CleanTextResult {
  const normalized = normalizeWhitespace(input);
  let lines = normalized.split('\n').map((l) => l.trimEnd());

  const pageRemoved = removePageNumbers(lines);
  lines = pageRemoved.lines;

  const hfRemoved = stripRepeatedHeaderFooter(lines);
  lines = hfRemoved.lines;

  const merged = mergeBrokenLines(lines);
  lines = merged.lines;

  // Remove excess blank lines
  const text = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  return {
    text,
    removedHeaderFooterLines: hfRemoved.removed,
    removedPageNumberLines: pageRemoved.removed,
    mergedLines: merged.merged,
  };
}

