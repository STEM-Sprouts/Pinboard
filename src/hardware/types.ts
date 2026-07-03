/**
 * Canonical hardware types — the one home for `BoardProfile`, `PinId`,
 * and `Diagnostic` (see implemenation_plam/hardware.md).
 */

export type PinId =
  | 'D0' | 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7'
  | 'D8' | 'D9' | 'D10' | 'D11' | 'D12' | 'D13'
  | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5'
  | 'GND' | '5V';

export type BoardId = 'arduino-uno';

export type TimerConflictRule = {
  id: string;
  when: {
    usesServo?: boolean;
    usesTone?: boolean;
    usesPwmPins?: PinId[];
  };
  severity: 'info' | 'warning' | 'error';
  message: string;
};

export type BoardProfile = {
  id: BoardId;
  displayName: string;
  fqbn: string;

  digitalPins: PinId[];
  analogPins: PinId[];
  pwmPins: PinId[];

  reservedPins: { serial: PinId[] };

  capabilities: {
    supportsInputPullup: boolean;
    supportsTone: boolean;
    supportsServo: boolean;
  };

  timerNotes: TimerConflictRule[];
};

/** Quick-fix actions (hardware.md §6). Offered on the diagnostic, applied
 * only when the student clicks — never silently (the mistake is the lesson). */
export type DiagnosticFixAction = { kind: 'setComponentPin'; componentId: string; pin: PinId };

export type Diagnostic = {
  id: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  fix?: { label: string; action: DiagnosticFixAction };
  source?: { blockId?: string; componentId?: string; pin?: PinId };
};
