/**
 * Canonical IR types — the one home for `ProgramIR`, `ExpressionIR`,
 * and `StatementIR` (see implemenation_plam/codegen.md).
 *
 * Everything downstream (simulator, C printer, compile check) consumes
 * this IR, so behavior and generated code cannot drift (ADR-0003).
 * Add IR nodes only when a lesson or supported component needs them.
 */
import type { BoardId, PinId } from '../hardware/types';

export type ValueType = 'number' | 'boolean' | 'string';

export type IncludeIR = { header: string };

export type GlobalIR = {
  name: string;
  valueType: ValueType;
  initial?: ExpressionIR;
};

export type ProgramIR = {
  schemaVersion: 1;
  boardId: BoardId;
  includes: IncludeIR[];
  globals: GlobalIR[];
  setup: StatementIR[];
  loop: StatementIR[];
  metadata: {
    sourceProjectHash: string;
    generatedAt: string;
    generatorVersion: string;
  };
};

export type BinaryOp =
  | '+' | '-' | '*' | '/' | '%'
  | '==' | '!=' | '<' | '<=' | '>' | '>='
  | '&&' | '||';

export type CallFn = 'map' | 'constrain' | 'min' | 'max' | 'abs' | 'random';

export type ExpressionIR =
  | { kind: 'num'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'string'; value: string }
  | { kind: 'var'; name: string }
  | { kind: 'read'; op: 'digital'; pin: PinId }
  | { kind: 'read'; op: 'analog'; pin: PinId }
  | { kind: 'millis' }
  | { kind: 'unary'; op: 'not' | 'neg'; arg: ExpressionIR }
  | { kind: 'binary'; op: BinaryOp; left: ExpressionIR; right: ExpressionIR }
  | { kind: 'call'; fn: CallFn; args: ExpressionIR[] };

/**
 * Statements optionally carry the Blockly block id that produced them so the
 * printer can emit a line↔block CodeSourceMap (codegen.md §9). Metadata only:
 * the runtime and printer semantics never read it.
 */
export type StatementIR = StatementNodeIR & { sourceBlockId?: string };

type StatementNodeIR =
  | { kind: 'declare'; name: string; valueType: ValueType; initial?: ExpressionIR; scope: 'global' | 'local' }
  | { kind: 'assign'; name: string; value: ExpressionIR }
  | { kind: 'change'; name: string; delta: ExpressionIR }
  | { kind: 'pinMode'; pin: PinId; mode: 'INPUT' | 'INPUT_PULLUP' | 'OUTPUT'; explicit: boolean }
  | { kind: 'digitalWrite'; pin: PinId; value: ExpressionIR }
  | { kind: 'analogWrite'; pin: PinId; value: ExpressionIR }
  | { kind: 'delay'; ms: ExpressionIR }
  | { kind: 'delayMicroseconds'; us: ExpressionIR }
  | { kind: 'serialPrint'; value: ExpressionIR; newline: boolean }
  | { kind: 'tone'; pin: PinId; frequency: ExpressionIR; durationMs?: ExpressionIR }
  | { kind: 'noTone'; pin: PinId }
  | { kind: 'servoAttach'; servoId: string; pin: PinId }
  | { kind: 'servoWrite'; servoId: string; angle: ExpressionIR }
  | { kind: 'if'; condition: ExpressionIR; then: StatementIR[]; else?: StatementIR[] }
  | { kind: 'repeat'; times: ExpressionIR; body: StatementIR[] }
  | { kind: 'while'; condition: ExpressionIR; body: StatementIR[] }
  | { kind: 'forRange'; varName: string; from: ExpressionIR; to: ExpressionIR; step: ExpressionIR; body: StatementIR[] }
  | { kind: 'comment'; text: string };
