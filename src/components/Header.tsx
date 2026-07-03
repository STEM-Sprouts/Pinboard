import { useRef } from 'react';
import { Play, Square, RotateCcw, Download, Upload, BookOpen } from 'lucide-react';
import type { EditorMode } from '../persistence/projectDocument';
import AccountControl from './AccountControl';

interface HeaderProps {
  status: 'idle' | 'compiling' | 'running' | 'error';
  saveNote: string;
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode) => void;
  /** Signed in but this project is not in the cloud yet — show the ask. */
  canPromoteToCloud: boolean;
  onSaveToCloud: () => void;
  onRun: () => void;
  onStop: () => void;
  onReset: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onToggleLessons: () => void;
}

export default function Header({
  status,
  saveNote,
  editorMode,
  onEditorModeChange,
  canPromoteToCloud,
  onSaveToCloud,
  onRun,
  onStop,
  onReset,
  onExport,
  onImportFile,
  onToggleLessons,
}: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="h-16 bg-surface border-b-2 border-ink flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-primary border-2 border-ink rounded-lg flex items-center justify-center shadow-[2px_2px_0_#111]">
          <span className="text-ink font-bold text-lg">P</span>
        </div>
        <h1 className="text-xl font-bold text-ink">Pinboard</h1>
        <button
          data-testid="lessons-toggle"
          onClick={onToggleLessons}
          className="ss-btn ss-btn-primary px-3 py-1.5 text-sm ml-2"
        >
          <BookOpen size={15} /> Lessons
        </button>
        <select
          data-testid="editor-mode"
          aria-label="Editor mode"
          value={editorMode}
          onChange={(e) => onEditorModeChange(e.target.value as EditorMode)}
          className="ml-1 px-2 py-1.5 bg-surface border-2 border-ink rounded-xl text-sm font-semibold text-ink shadow-[2px_2px_0_#111]"
          title="Editor mode — changes which blocks the toolbox offers"
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <span data-testid="save-note" className="text-xs font-medium text-gray-500 ml-2">{saveNote}</span>
      </div>

      <div className="flex items-center gap-2.5">
        <AccountControl />
        {canPromoteToCloud && (
          <button data-testid="save-to-cloud" onClick={onSaveToCloud} className="ss-btn ss-btn-ghost px-3 py-1.5 text-sm">
            ☁ Save to my account
          </button>
        )}
        <button onClick={() => fileInputRef.current?.click()} className="ss-btn ss-btn-ghost px-3 py-1.5 text-sm">
          <Upload size={15} /> Import
        </button>
        <input
          ref={fileInputRef}
          data-testid="import-input"
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
            e.target.value = '';
          }}
        />
        <button onClick={onExport} className="ss-btn ss-btn-ghost px-3 py-1.5 text-sm">
          <Download size={15} /> Export
        </button>

        <div className="flex items-center text-sm font-semibold border-2 border-ink bg-surface px-3 py-1 rounded-full mx-1">
          <span
            className={`w-2.5 h-2.5 rounded-full mr-2 ${
              status === 'running' ? 'bg-primary animate-pulse' : status === 'error' ? 'bg-red-500' : 'bg-gray-400'
            }`}
          ></span>
          <span data-testid="emulator-status" className="capitalize text-ink">{status}</span>
        </div>

        <button
          onClick={onRun}
          disabled={status === 'running' || status === 'compiling'}
          className="ss-btn ss-btn-primary px-4 py-1.5 text-sm"
        >
          <Play size={16} /> Run
        </button>
        <button
          onClick={onStop}
          disabled={status !== 'running'}
          className="ss-btn px-4 py-1.5 text-sm bg-red-100 hover:bg-red-200"
        >
          <Square size={16} /> Stop
        </button>
        <button onClick={onReset} className="ss-btn ss-btn-ghost px-3 py-1.5 text-sm" title="Reset simulation">
          <RotateCcw size={16} />
        </button>
      </div>
    </header>
  );
}
