/**
 * Canonical persistence types — the one home for `PinboardProjectDocument`
 * and `ComponentInstance` (implemenation_plam/persistence.md §1).
 *
 * The project document is the source of truth on disk. Generated C, IR, and
 * source maps are derived cache and are never stored in it.
 */
import type { PinId } from '../hardware/types';

export type ComponentType =
  | 'led'
  | 'button'
  | 'potentiometer'
  | 'buzzer'
  | 'servo'
  | 'rgb-led'
  | 'ultrasonic';

export type ComponentInstance = {
  id: string;
  type: ComponentType;
  displayName: string;
  position: { x: number; y: number };
  /** e.g. { activeHigh } for LED, { pullMode, pressedValue } for button. */
  config: Record<string, unknown>;
  /** e.g. { signal: 'D13', ground: 'GND' }. */
  pins: Record<string, PinId | null>;
};

export type WiringConnection = {
  id: string;
  componentId: string;
  pinRole: string;
  boardPin: PinId;
};

export type EditorMode = 'beginner' | 'intermediate' | 'advanced';

export type PinboardProjectDocument = {
  schemaVersion: 1;
  appVersion: string;

  metadata: {
    id: string;
    title: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    ownerDisplayName?: string;
    /** Set when the student chose "Save to my account" (supabase.md §1);
     * never set silently on sign-in. */
    cloudProjectId?: string;
  };

  board: {
    id: 'arduino-uno';
    fqbn: 'arduino:avr:uno';
  };

  workspace: {
    format: 'blockly-json'; // ADR-0002; XML only as one-way import migration
    data: unknown;
  };

  hardware: {
    components: ComponentInstance[];
    wiring: WiringConnection[];
  };

  lessons?: {
    lessonId?: string;
    completedChecks?: string[];
  };

  settings: {
    editorMode: EditorMode;
    simulationSpeed: number;
    showAdvancedBlocks: boolean;
  };
};

export const APP_VERSION = '0.1.0';

export function createLocalProject(
  id: string,
  workspaceData: unknown,
  nowIso: string,
  title = 'My Pinboard Project',
  components: ComponentInstance[] = [],
  editorMode: EditorMode = 'beginner',
  simulationSpeed = 1,
): PinboardProjectDocument {
  return {
    schemaVersion: 1,
    appVersion: APP_VERSION,
    metadata: { id, title, createdAt: nowIso, updatedAt: nowIso },
    board: { id: 'arduino-uno', fqbn: 'arduino:avr:uno' },
    workspace: { format: 'blockly-json', data: workspaceData },
    hardware: { components, wiring: [] },
    settings: { editorMode, simulationSpeed, showAdvancedBlocks: false },
  };
}
