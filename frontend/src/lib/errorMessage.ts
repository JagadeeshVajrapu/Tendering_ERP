/** Normalize unknown thrown/rejected values for UI (avoids "[object Event]"). */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const o = error as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message) return o.message;
    if (typeof o.reason === 'string' && o.reason) return o.reason;
    // DOM Event / ProgressEvent
    if (typeof o.type === 'string') {
      return `Request failed (${o.type})`;
    }
  }
  return fallback;
}
