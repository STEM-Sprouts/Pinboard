/**
 * Read-only CodeMirror preview of the IR-printed Arduino C (ADR-0004,
 * TASKS Phase 1). Strictly one-way: blocks → code; typing does nothing.
 * The selected block's printed lines are highlighted via the printer's
 * CodeSourceMap (codegen.md §9); compiler diagnostics attach here later.
 */
import { useEffect, useRef } from 'react';
import { EditorState, StateEffect, StateField, type Range } from '@codemirror/state';
import { Decoration, EditorView, lineNumbers, type DecorationSet } from '@codemirror/view';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { cpp } from '@codemirror/lang-cpp';

export type LineRange = { start: number; end: number };

const setBlockHighlight = StateEffect.define<LineRange | null>();
const blockLine = Decoration.line({ class: 'cm-block-highlight' });

const blockHighlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setBlockHighlight)) continue;
      if (!effect.value) return Decoration.none;
      const ranges: Range<Decoration>[] = [];
      const last = Math.min(effect.value.end, tr.state.doc.lines);
      for (let line = Math.max(1, effect.value.start); line <= last; line++) {
        ranges.push(blockLine.range(tr.state.doc.line(line).from));
      }
      return Decoration.set(ranges);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const blockHighlightTheme = EditorView.baseTheme({
  '.cm-block-highlight': { backgroundColor: 'rgba(255, 213, 79, 0.35)' },
});

export default function CodePreview({
  code,
  highlight,
  fontSize = 'medium',
}: {
  code: string;
  highlight?: LineRange | null;
  fontSize?: 'small' | 'medium' | 'large';
}) {
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
          EditorView.contentAttributes.of({ 'aria-label': 'Arduino C preview (read-only)' }),
          blockHighlightField,
          blockHighlightTheme,
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
    const range = highlight && highlight.start >= 1 && highlight.start <= view.state.doc.lines ? highlight : null;
    view.dispatch({
      effects: [
        setBlockHighlight.of(range),
        ...(range ? [EditorView.scrollIntoView(view.state.doc.line(range.start).from, { y: 'center' })] : []),
      ],
    });
  }, [code, highlight]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2 bg-surface border-y-2 border-ink flex justify-between items-center text-sm font-bold text-ink">
        <span>Arduino C Preview</span>
        <span className="text-xs font-normal text-gray-600">read-only — generated from your blocks</span>
      </div>
      <div
        ref={hostRef}
        data-testid="code-preview"
        tabIndex={0}
        className={`flex-1 overflow-auto bg-surface ${
          fontSize === 'small' ? 'text-xs' : fontSize === 'large' ? 'text-base' : 'text-sm'
        }`}
      />
    </div>
  );
}
