/**
 * Read-only CodeMirror preview of the IR-printed Arduino C (ADR-0004,
 * TASKS Phase 1). Strictly one-way: blocks → code; typing does nothing.
 * CodeMirror (not highlight.js) so line↔block gutters and inline compiler
 * diagnostics can attach here later (codegen.md §9 source map).
 */
import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { cpp } from '@codemirror/lang-cpp';

export default function CodePreview({ code }: { code: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return;
    viewRef.current = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: '',
        extensions: [
          lineNumbers(),
          syntaxHighlighting(defaultHighlightStyle),
          cpp(),
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
        ],
      }),
    });
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== code) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: code } });
    }
  }, [code]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center text-sm font-semibold text-gray-700">
        <span>Arduino C Preview</span>
        <span className="text-xs font-normal text-gray-400">read-only — generated from your blocks</span>
      </div>
      <div ref={hostRef} data-testid="code-preview" className="flex-1 overflow-auto bg-surface text-sm" />
    </div>
  );
}
