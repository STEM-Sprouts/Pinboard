/**
 * Bounded serial output buffer (implemenation_plam/runtime.md §10).
 * Ring semantics: keep the newest `maxLines`, count what was dropped so the
 * UI can show an "older output hidden" note.
 */
export class SerialBuffer {
  private maxLines: number;
  private completedLines: string[] = [];
  private currentLine = '';
  private droppedCount = 0;
  private listeners: Array<(line: string) => void> = [];

  constructor(maxLines = 500) {
    this.maxLines = maxLines;
  }

  print(text: string): void {
    const parts = String(text).split('\n');
    for (let i = 0; i < parts.length; i++) {
      this.currentLine += parts[i];
      const isLast = i === parts.length - 1;
      if (!isLast) this.commitLine();
    }
  }

  println(text = ''): void {
    this.print(text + '\n');
  }

  private commitLine(): void {
    const line = this.currentLine;
    this.currentLine = '';
    this.completedLines.push(line);
    if (this.completedLines.length > this.maxLines) {
      this.completedLines.shift();
      this.droppedCount++;
    }
    for (const listener of this.listeners) listener(line);
  }

  /** Completed lines, oldest first (excludes any unterminated tail). */
  lines(): readonly string[] {
    return this.completedLines;
  }

  /** Text printed since the last newline. */
  pending(): string {
    return this.currentLine;
  }

  droppedLines(): number {
    return this.droppedCount;
  }

  onLine(listener: (line: string) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  clear(): void {
    this.completedLines = [];
    this.currentLine = '';
    this.droppedCount = 0;
  }
}
