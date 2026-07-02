import { useRef } from 'react';
import { Play, Square, RotateCcw, Download, Upload } from 'lucide-react';

interface HeaderProps {
  status: 'idle' | 'compiling' | 'running' | 'error';
  saveNote: string;
  onRun: () => void;
  onStop: () => void;
  onReset: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
}

export default function Header({ status, saveNote, onRun, onStop, onReset, onExport, onImportFile }: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="h-14 bg-surface border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
          <span className="text-white font-bold text-lg">P</span>
        </div>
        <h1 className="text-xl font-bold text-gray-800">Pinboard</h1>
        <span data-testid="save-note" className="text-xs text-gray-500 ml-2">{saveNote}</span>
      </div>

      <div className="flex items-center gap-3">
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
          className="flex items-center gap-1.5 px-4 py-1.5 bg-accent text-white rounded-md hover:bg-[#008f6b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold shadow-sm"
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
