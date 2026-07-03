import { useEffect, useMemo, useState } from 'react';
import type { EditorMode } from '../persistence/projectDocument';

export type CodePreviewFontSize = 'small' | 'medium' | 'large';

export type PinboardPreferences = {
  defaultEditorMode: EditorMode;
  defaultSimulationSpeed: number;
  codePreviewFontSize: CodePreviewFontSize;
  autosaveEnabled: boolean;
  autosaveDebounceMs: number;
  showHintsAutomatically: boolean;
  reducedMotion: 'system' | 'on' | 'off';
};

const STORAGE_KEY = 'pinboard:preferences';

const DEFAULT_PREFERENCES: PinboardPreferences = {
  defaultEditorMode: 'beginner',
  defaultSimulationSpeed: 1,
  codePreviewFontSize: 'medium',
  autosaveEnabled: true,
  autosaveDebounceMs: 750,
  showHintsAutomatically: false,
  reducedMotion: 'system',
};

function parsePreferences(raw: string | null): PinboardPreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<PinboardPreferences>;
    return {
      defaultEditorMode:
        parsed.defaultEditorMode === 'beginner' ||
        parsed.defaultEditorMode === 'intermediate' ||
        parsed.defaultEditorMode === 'advanced'
          ? parsed.defaultEditorMode
          : DEFAULT_PREFERENCES.defaultEditorMode,
      codePreviewFontSize:
        parsed.codePreviewFontSize === 'small' || parsed.codePreviewFontSize === 'large'
          ? parsed.codePreviewFontSize
          : DEFAULT_PREFERENCES.codePreviewFontSize,
      defaultSimulationSpeed:
        typeof parsed.defaultSimulationSpeed === 'number' && Number.isFinite(parsed.defaultSimulationSpeed)
          ? Math.min(4, Math.max(0.25, parsed.defaultSimulationSpeed))
          : DEFAULT_PREFERENCES.defaultSimulationSpeed,
      autosaveEnabled: typeof parsed.autosaveEnabled === 'boolean' ? parsed.autosaveEnabled : DEFAULT_PREFERENCES.autosaveEnabled,
      autosaveDebounceMs:
        typeof parsed.autosaveDebounceMs === 'number' && Number.isFinite(parsed.autosaveDebounceMs)
          ? Math.min(5000, Math.max(250, Math.round(parsed.autosaveDebounceMs)))
          : DEFAULT_PREFERENCES.autosaveDebounceMs,
      showHintsAutomatically:
        typeof parsed.showHintsAutomatically === 'boolean'
          ? parsed.showHintsAutomatically
          : DEFAULT_PREFERENCES.showHintsAutomatically,
      reducedMotion:
        parsed.reducedMotion === 'on' || parsed.reducedMotion === 'off'
          ? parsed.reducedMotion
          : DEFAULT_PREFERENCES.reducedMotion,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<PinboardPreferences>(() =>
    parsePreferences(window.localStorage.getItem(STORAGE_KEY)),
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  return useMemo(
    () => ({
      preferences,
      setPreferences,
      resetPreferences: () => setPreferences(DEFAULT_PREFERENCES),
      defaultPreferences: DEFAULT_PREFERENCES,
    }),
    [preferences],
  );
}
