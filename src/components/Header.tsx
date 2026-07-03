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
    <header className="h-14 bg-surface border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
          <span className="text-white font-bold text-lg">P</span>
        </div>
        <h1 className="text-xl font-bold text-gray-800">Pinboard</h1>
        <button
          data-testid="lessons-toggle"
          onClick={onToggleLessons}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium ml-2"
        >
          <BookOpen size={15} /> Lessons
        </button>
        <select
          data-testid="editor-mode"
          aria-label="Editor mode"
          value={editorMode}
          onChange={(e) => onEditorModeChange(e.target.value as EditorMode)}
          className="ml-2 px-2 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm font-medium border-none"
          title="Editor mode — changes which blocks the toolbox offers"
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <span data-testid="save-note" className="text-xs text-gray-500 ml-2">{saveNote}</span>
      </div>

      <div className="flex items-center gap-3">
        <AccountControl />
        {canPromoteToCloud && (
          <button
            data-testid="save-to-cloud"
            onClick={onSaveToCloud}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 text-sm font-medium"
          >
            Save to my account
          </button>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
        >
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
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          <Download size={15} /> Export
        </button>

        <div className="flex items-center text-sm font-medium mr-4 bg-gray-100 px-3 py-1 rounded-full">
          <span className={`w-2.5 h-2.5 rounded-full mr-2 ${status === 'running' ? 'bg-accent animate-pulse' : status === 'error' ? 'bg-red-500' : 'bg-gray-400'}`}></span>
          <span data-testid="emulator-status" className="capitalize text-gray-700">{status}</span>
        </div>

        <button
          onClick={onRun}
          disabled={status === 'running' || status === 'compiling'}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-accent text-white rounded-md hover:bg-[#00654c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold shadow-sm"
        >
          <Play size={16} className={status === 'running' ? 'opacity-50' : ''} /> Run
        </button>
        <button
          onClick={onStop}
          disabled={status !== 'running'}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
        >
          <Square size={16} /> Stop
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          title="Reset simulation"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </header>
  );
}
