/**
 * Bounded parallel execution — Promise.all with a worker pool (concurrency limit).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Math.max(1, Math.min(limit, items.length));

  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    })
  );

  return results;
}

/** Split an array into fixed-size slices (e.g. 5-page chunks). */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (!items.length || size < 1) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Process slices with a concurrency cap. Returns results in chunk order.
 */
export async function mapChunksWithConcurrency<T, R>(
  items: T[],
  chunkSize: number,
  concurrency: number,
  fn: (chunk: T[], chunkIndex: number) => Promise<R>
): Promise<R[]> {
  const chunks = chunkArray(items, chunkSize);
  return mapWithConcurrency(chunks, concurrency, fn);
}
