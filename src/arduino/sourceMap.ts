/**
 * Line ↔ block source map (implemenation_plam/codegen.md §9).
 *
 * Built by the printer as it emits lines; consumed by the CodeMirror preview
 * (highlight the selected block's lines) and later by compiler diagnostics
 * (compiler.md §2: error line → block). Lines are 1-indexed. Derived data:
 * cache, not truth — never persisted into the project document.
 */
export type CodeSourceMap = {
  cLineToBlockId: Record<number, string>;
  blockIdToLineRange: Record<string, { start: number; end: number }>;
};

export function emptySourceMap(): CodeSourceMap {
  return { cLineToBlockId: {}, blockIdToLineRange: {} };
}

/**
 * Record that `blockId` produced lines start..end (inclusive). Inner
 * statements record first, so on the line level the innermost block wins;
 * the block's own range grows to cover every line it produced.
 */
export function recordBlockLines(map: CodeSourceMap, blockId: string, start: number, end: number): void {
  for (let line = start; line <= end; line++) {
    if (!(line in map.cLineToBlockId)) map.cLineToBlockId[line] = blockId;
  }
  const range = map.blockIdToLineRange[blockId];
  map.blockIdToLineRange[blockId] = range
    ? { start: Math.min(range.start, start), end: Math.max(range.end, end) }
    : { start, end };
}
