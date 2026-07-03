import { NavLink } from 'react-router-dom';
import type { EditorMode } from '../persistence/projectDocument';
import pinboardLogo from '../../pinboard_logo.png';

interface HeaderProps {
  editorBasePath: string;
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode) => void;
}

export default function Header({ editorBasePath, editorMode, onEditorModeChange }: HeaderProps) {
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    [
      'px-3 py-2 text-sm font-semibold border-b-2 transition-colors',
      isActive ? 'border-ink text-ink' : 'border-transparent text-gray-500 hover:text-ink',
    ].join(' ');

  return (
    <header className="h-16 bg-surface border-b-2 border-ink flex items-center justify-between px-4 gap-4 z-10">
      <div className="flex items-center gap-3 shrink-0">
        <div className="rounded-2xl border-2 border-ink bg-white px-2 py-1 shadow-[3px_3px_0_#111]">
          <img
            src={pinboardLogo}
            alt="Pinboard"
            className="h-9 w-auto max-w-[220px] object-contain"
          />
        </div>
        <h1 className="sr-only">Pinboard</h1>
      </div>

      <nav className="flex items-center gap-2 min-w-0">
        <NavLink to={editorBasePath} end className={tabClass}>
          Build
        </NavLink>
        <NavLink data-testid="lessons-toggle" to={`${editorBasePath}/lessons`} className={tabClass}>
          Lessons
        </NavLink>
        <NavLink to={`${editorBasePath}/account`} className={tabClass}>
          Account
        </NavLink>
        <NavLink to={`${editorBasePath}/preferences`} className={tabClass}>
          Preferences
        </NavLink>
      </nav>

      <select
        data-testid="editor-mode"
        aria-label="Editor mode"
        value={editorMode}
        onChange={(e) => onEditorModeChange(e.target.value as EditorMode)}
        className="px-2 py-1.5 bg-surface border-2 border-ink rounded-xl text-sm font-semibold text-ink shadow-[2px_2px_0_#111]"
        title="Editor mode — changes which blocks the toolbox offers"
      >
        <option value="beginner">Beginner</option>
        <option value="intermediate">Intermediate</option>
        <option value="advanced">Advanced</option>
      </select>
    </header>
  );
}
