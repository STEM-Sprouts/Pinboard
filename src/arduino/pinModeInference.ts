/**
 * Beginner-mode `pinMode` inference (implemenation_plam/codegen.md §6, ADR-0010).
 *
 * The printer collects pin usage and emits one mode per pin in `setup()`:
 * written pins become OUTPUT; pinMode nodes already present in the IR (what
 * lowering emits from component config, e.g. a pull-up button) are kept and
 * win over inference. Pins that are only read get no line — that is the real
 * Arduino default. analogRead needs no pinMode at all.
 */
import type { Diagnostic, PinId } from '../hardware/types';
import type { ProgramIR, StatementIR } from '../ir/types';
import { walkStatements } from '../ir/walk';

export type InferredPinMode = {
  pin: PinId;
  mode: 'INPUT' | 'INPUT_PULLUP' | 'OUTPUT';
  declared: boolean;
};

export type ProgramAnalysis = {
  pinModes: InferredPinMode[];
  serialUsed: boolean;
  servoUsed: boolean;
  toneUsed: boolean;
  /** Servo ids in first-appearance order — printed as `Servo <id>;` decls. */
  servoIds: string[];
  /** servoAttach statements found in loop() — hoisted into setup() when printed. */
  hoistedLoopAttaches: Array<{ servoId: string; pin: PinId }>;
  diagnostics: Diagnostic[];
};

const PIN_ORDER: PinId[] = [
  'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13',
  'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'GND', '5V',
];

export function analyzeProgram(program: ProgramIR): ProgramAnalysis {
  const declaredOrder: PinId[] = [];
  const declared = new Map<PinId, 'INPUT' | 'INPUT_PULLUP' | 'OUTPUT'>();
  const written = new Set<PinId>();
  const servoIds: string[] = [];
  const hoistedLoopAttaches: Array<{ servoId: string; pin: PinId }> = [];
  const diagnostics: Diagnostic[] = [];
  let serialUsed = false;
  let toneUsed = false;

  const recordServoId = (servoId: string) => {
    if (!servoIds.includes(servoId)) servoIds.push(servoId);
  };

  const visit = (inLoop: boolean) => (stmt: StatementIR) => {
    switch (stmt.kind) {
      case 'pinMode': {
        const existing = declared.get(stmt.pin);
        if (existing === undefined) {
          declared.set(stmt.pin, stmt.mode);
          declaredOrder.push(stmt.pin);
        } else if (existing !== stmt.mode) {
          diagnostics.push({
            id: `pinmode-conflict:${stmt.pin}`,
            severity: 'warning',
            title: 'Conflicting pin modes',
            message: `${stmt.pin} is set to ${existing} and later to ${stmt.mode}. Only ${existing} is kept.`,
            source: { pin: stmt.pin },
          });
        }
        break;
      }
      case 'digitalWrite':
      case 'analogWrite':
        written.add(stmt.pin);
        break;
      case 'serialPrint':
        serialUsed = true;
        break;
      case 'tone':
      case 'noTone':
        toneUsed = true;
        break;
      case 'servoAttach':
        recordServoId(stmt.servoId);
        if (inLoop) hoistedLoopAttaches.push({ servoId: stmt.servoId, pin: stmt.pin });
        break;
      case 'servoWrite':
        recordServoId(stmt.servoId);
        break;
      default:
        break;
    }
  };

  walkStatements(program.setup, visit(false));
  walkStatements(program.loop, visit(true));

  if (hoistedLoopAttaches.length > 0) {
    diagnostics.push({
      id: 'servo-attach-hoisted',
      severity: 'info',
      title: 'Servo attach moved to setup()',
      message: 'Attaching a servo belongs in setup(); Pinboard moved it there in the generated code.',
    });
  }

  const pinModes: InferredPinMode[] = declaredOrder.map((pin) => ({
    pin,
    mode: declared.get(pin)!,
    declared: true,
  }));

  for (const { pin, mode } of pinModes) {
    if (mode !== 'OUTPUT' && written.has(pin)) {
      diagnostics.push({
        id: `pinmode-write-conflict:${pin}`,
        severity: 'warning',
        title: 'Writing to an input pin',
        message: `${pin} is configured as ${mode} but the program writes to it.`,
        source: { pin },
      });
    }
  }

  const inferred = [...written]
    .filter((pin) => !declared.has(pin))
    .sort((a, b) => PIN_ORDER.indexOf(a) - PIN_ORDER.indexOf(b))
    .map((pin): InferredPinMode => ({ pin, mode: 'OUTPUT', declared: false }));

  return {
    pinModes: [...pinModes, ...inferred],
    serialUsed,
    servoUsed: servoIds.length > 0,
    toneUsed,
    servoIds,
    hoistedLoopAttaches,
    diagnostics,
  };
}
