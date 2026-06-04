export class PipelineTimer {
  private readonly started = Date.now();
  private readonly marks = new Map<string, number>();

  mark(label: string): void {
    this.marks.set(label, Date.now() - this.started);
  }

  summary(extra?: Record<string, unknown>): Record<string, unknown> {
    return {
      totalMs: Date.now() - this.started,
      stages: Object.fromEntries(this.marks),
      ...extra,
    };
  }
}
