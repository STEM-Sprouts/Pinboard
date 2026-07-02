/**
 * Lesson schema (implemenation_plam/lessons.md §3–4). Checks inspect the
 * project document, the IR, or a headless runtime trace — never the
 * generated code text, so they stay robust to formatting and honest about
 * behavior. Instructions are rendered as plain text (no HTML injection).
 */
import type { PinId } from '../hardware/types';
import type { StatementIR } from '../ir/types';
import type { ComponentInstance } from '../persistence/projectDocument';

export type LessonCheck =
  | { kind: 'hasComponent'; componentType: ComponentInstance['type'] }
  | { kind: 'componentOnPin'; componentType: ComponentInstance['type']; pinRole: string; expectedPin: PinId }
  | { kind: 'hasInstruction'; statementKind: StatementIR['kind']; pin?: PinId }
  | { kind: 'serialIncludes'; text: string }
  | { kind: 'lacksInstruction'; statementKind: StatementIR['kind'] }
  | { kind: 'runtimePinToggles'; pin: PinId }
  | { kind: 'runtimePinWritesPwm'; pin: PinId }
  | { kind: 'runtimeServoMoves'; pin: PinId }
  | { kind: 'runtimeTonePlays'; pin: PinId };

export type LessonCheckDef = {
  id: string;
  description: string;
  check: LessonCheck;
};

export type LessonStep = {
  id: string;
  title: string;
  instructions: string;
  hints: string[];
};

export type Lesson = {
  id: string;
  title: string;
  estimatedMinutes: number;
  targetGradeBand: 'middle' | 'high' | 'mixed';
  steps: LessonStep[];
  checks: LessonCheckDef[];
};
