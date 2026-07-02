/**
 * IR → Arduino C printer (implemenation_plam/codegen.md §7).
 *
 * A pure function of the IR: no clocks, no randomness, deterministic output
 * (snapshot/compile tests depend on it). Style: 2-space indent, includes
 * first, globals second, setup() third, loop() fourth, one statement per
 * line, no duplicate pinMode.
 */
import { getBoardProfile } from '../hardware/boards/arduinoUno';
import type { Diagnostic, PinId } from '../hardware/types';
import type { ExpressionIR, ProgramIR, StatementIR, ValueType } from '../ir/types';
import { analyzeProgram } from './pinModeInference';

export type PrintResult = {
  code: string;
  diagnostics: Diagnostic[];
};

const INDENT = '  ';

// C precedence, higher binds tighter.
const PREC_PRIMARY = 100;
const PREC_UNARY = 70;
const PREC_MUL = 60;
const PREC_ADD = 50;
const PREC_REL = 40;
const PREC_EQ = 35;
const PREC_AND = 30;
const PREC_OR = 25;

const BINARY_PREC: Record<string, number> = {
  '*': PREC_MUL, '/': PREC_MUL, '%': PREC_MUL,
  '+': PREC_ADD, '-': PREC_ADD,
  '<': PREC_REL, '<=': PREC_REL, '>': PREC_REL, '>=': PREC_REL,
  '==': PREC_EQ, '!=': PREC_EQ,
  '&&': PREC_AND,
  '||': PREC_OR,
};

const ASSOCIATIVE = new Set(['+', '*', '&&', '||']);

function pinToC(pin: PinId): string {
  return pin.startsWith('D') ? pin.slice(1) : pin;
}

function cType(valueType: ValueType): string {
  switch (valueType) {
    case 'number':
      return 'long';
    case 'boolean':
      return 'bool';
    case 'string':
      return 'String';
  }
}

function escapeCString(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

type PrintedExpr = { text: string; prec: number };

function isDigitalRead(expr: ExpressionIR): boolean {
  return expr.kind === 'read' && expr.op === 'digital';
}

/**
 * `pinBool` controls how boolean literals print: HIGH/LOW in pin contexts
 * (digitalWrite values, comparisons against digitalRead), true/false elsewhere.
 */
function printExpr(expr: ExpressionIR, pinBool: boolean): PrintedExpr {
  switch (expr.kind) {
    case 'num':
      return { text: String(expr.value), prec: expr.value < 0 ? PREC_UNARY : PREC_PRIMARY };
    case 'bool':
      if (pinBool) return { text: expr.value ? 'HIGH' : 'LOW', prec: PREC_PRIMARY };
      return { text: expr.value ? 'true' : 'false', prec: PREC_PRIMARY };
    case 'string':
      return { text: `"${escapeCString(expr.value)}"`, prec: PREC_PRIMARY };
    case 'var':
      return { text: expr.name, prec: PREC_PRIMARY };
    case 'read':
      return {
        text: expr.op === 'digital' ? `digitalRead(${pinToC(expr.pin)})` : `analogRead(${pinToC(expr.pin)})`,
        prec: PREC_PRIMARY,
      };
    case 'millis':
      return { text: 'millis()', prec: PREC_PRIMARY };
    case 'unary': {
      const arg = printExpr(expr.arg, false);
      const argText = arg.prec < PREC_UNARY ? `(${arg.text})` : arg.text;
      return { text: `${expr.op === 'not' ? '!' : '-'}${argText}`, prec: PREC_UNARY };
    }
    case 'binary': {
      const myPrec = BINARY_PREC[expr.op];
      const equality = expr.op === '==' || expr.op === '!=';
      const childPinBool = equality && (isDigitalRead(expr.left) || isDigitalRead(expr.right));
      const left = printExpr(expr.left, childPinBool);
      const right = printExpr(expr.right, childPinBool);
      const leftText = left.prec < myPrec ? `(${left.text})` : left.text;
      const rightNeedsParens =
        right.prec < myPrec || (right.prec === myPrec && !ASSOCIATIVE.has(expr.op));
      const rightText = rightNeedsParens ? `(${right.text})` : right.text;
      return { text: `${leftText} ${expr.op} ${rightText}`, prec: myPrec };
    }
    case 'call': {
      const args = expr.args.map((arg) => printExpr(arg, false).text);
      return { text: `${expr.fn}(${args.join(', ')})`, prec: PREC_PRIMARY };
    }
  }
}

const ex = (expr: ExpressionIR, pinBool = false): string => printExpr(expr, pinBool).text;

type PrinterState = {
  usedNames: Set<string>;
  repeatDepth: number;
};

function collectUsedNames(program: ProgramIR): Set<string> {
  const names = new Set<string>();
  for (const g of program.globals) names.add(g.name);
  const visit = (statements: StatementIR[]) => {
    for (const stmt of statements) {
      switch (stmt.kind) {
        case 'declare':
          names.add(stmt.name);
          break;
        case 'forRange':
          names.add(stmt.varName);
          visit(stmt.body);
          break;
        case 'if':
          visit(stmt.then);
          if (stmt.else) visit(stmt.else);
          break;
        case 'repeat':
        case 'while':
          visit(stmt.body);
          break;
        default:
          break;
      }
    }
  };
  visit(program.setup);
  visit(program.loop);
  return names;
}

function repeatCounterName(state: PrinterState): string {
  const preferred = ['i', 'j', 'k', 'm', 'n'];
  const candidate = preferred[state.repeatDepth] ?? `i${state.repeatDepth + 1}`;
  if (!state.usedNames.has(candidate)) return candidate;
  let suffix = 2;
  while (state.usedNames.has(`${candidate}${suffix}`)) suffix++;
  return `${candidate}${suffix}`;
}

function printStatements(
  statements: StatementIR[],
  depth: number,
  state: PrinterState,
  lines: string[],
  skip?: (stmt: StatementIR) => boolean,
): void {
  for (const stmt of statements) {
    if (skip?.(stmt)) continue;
    printStatement(stmt, depth, state, lines);
  }
}

function printStatement(stmt: StatementIR, depth: number, state: PrinterState, lines: string[]): void {
  const pad = INDENT.repeat(depth);
  switch (stmt.kind) {
    case 'declare': {
      const init = stmt.initial !== undefined ? ` = ${ex(stmt.initial)}` : '';
      lines.push(`${pad}${cType(stmt.valueType)} ${stmt.name}${init};`);
      return;
    }
    case 'assign':
      lines.push(`${pad}${stmt.name} = ${ex(stmt.value)};`);
      return;
    case 'change':
      lines.push(`${pad}${stmt.name} += ${ex(stmt.delta)};`);
      return;
    case 'pinMode':
      lines.push(`${pad}pinMode(${pinToC(stmt.pin)}, ${stmt.mode});`);
      return;
    case 'digitalWrite':
      lines.push(`${pad}digitalWrite(${pinToC(stmt.pin)}, ${ex(stmt.value, true)});`);
      return;
    case 'analogWrite':
      lines.push(`${pad}analogWrite(${pinToC(stmt.pin)}, ${ex(stmt.value)});`);
      return;
    case 'delay':
      lines.push(`${pad}delay(${ex(stmt.ms)});`);
      return;
    case 'delayMicroseconds':
      lines.push(`${pad}delayMicroseconds(${ex(stmt.us)});`);
      return;
    case 'serialPrint':
      lines.push(`${pad}Serial.${stmt.newline ? 'println' : 'print'}(${ex(stmt.value)});`);
      return;
    case 'tone': {
      const duration = stmt.durationMs !== undefined ? `, ${ex(stmt.durationMs)}` : '';
      lines.push(`${pad}tone(${pinToC(stmt.pin)}, ${ex(stmt.frequency)}${duration});`);
      return;
    }
    case 'noTone':
      lines.push(`${pad}noTone(${pinToC(stmt.pin)});`);
      return;
    case 'servoAttach':
      lines.push(`${pad}${stmt.servoId}.attach(${pinToC(stmt.pin)});`);
      return;
    case 'servoWrite':
      lines.push(`${pad}${stmt.servoId}.write(${ex(stmt.angle)});`);
      return;
    case 'if': {
      lines.push(`${pad}if (${ex(stmt.condition)}) {`);
      printStatements(stmt.then, depth + 1, state, lines);
      if (stmt.else && stmt.else.length > 0) {
        lines.push(`${pad}} else {`);
        printStatements(stmt.else, depth + 1, state, lines);
      }
      lines.push(`${pad}}`);
      return;
    }
    case 'repeat': {
      const counter = repeatCounterName(state);
      state.usedNames.add(counter);
      state.repeatDepth++;
      lines.push(`${pad}for (int ${counter} = 0; ${counter} < ${ex(stmt.times)}; ${counter}++) {`);
      printStatements(stmt.body, depth + 1, state, lines);
      lines.push(`${pad}}`);
      state.repeatDepth--;
      state.usedNames.delete(counter);
      return;
    }
    case 'while': {
      if (stmt.body.length === 0) {
        // A real spin-wait, printed honestly (codegen.md §9).
        lines.push(`${pad}while (${ex(stmt.condition)}) { }`);
        return;
      }
      lines.push(`${pad}while (${ex(stmt.condition)}) {`);
      printStatements(stmt.body, depth + 1, state, lines);
      lines.push(`${pad}}`);
      return;
    }
    case 'forRange': {
      const from = ex(stmt.from);
      const to = ex(stmt.to);
      const descending = stmt.step.kind === 'num' && stmt.step.value < 0;
      const compare = descending ? '>=' : '<=';
      const stepText = descending
        ? `${stmt.varName} -= ${Math.abs((stmt.step as { kind: 'num'; value: number }).value)}`
        : `${stmt.varName} += ${ex(stmt.step)}`;
      lines.push(`${pad}for (long ${stmt.varName} = ${from}; ${stmt.varName} ${compare} ${to}; ${stepText}) {`);
      printStatements(stmt.body, depth + 1, state, lines);
      lines.push(`${pad}}`);
      return;
    }
    case 'comment':
      lines.push(`${pad}// ${stmt.text}`);
      return;
  }
}

export function printArduino(program: ProgramIR): PrintResult {
  const analysis = analyzeProgram(program);
  const board = getBoardProfile(program.boardId);
  const state: PrinterState = { usedNames: collectUsedNames(program), repeatDepth: 0 };
  const lines: string[] = [];

  lines.push('// Generated by Pinboard');
  lines.push(`// Board: ${board.displayName}`);
  lines.push('');

  const headers: string[] = [];
  for (const include of program.includes) {
    if (!headers.includes(include.header)) headers.push(include.header);
  }
  if (analysis.servoUsed && !headers.includes('Servo.h')) headers.push('Servo.h');
  if (headers.length > 0) {
    for (const header of headers) lines.push(`#include <${header}>`);
    lines.push('');
  }

  if (analysis.servoIds.length > 0) {
    for (const servoId of analysis.servoIds) lines.push(`Servo ${servoId};`);
    lines.push('');
  }

  if (program.globals.length > 0) {
    for (const g of program.globals) {
      const init = g.initial !== undefined ? ` = ${ex(g.initial)}` : '';
      lines.push(`${cType(g.valueType)} ${g.name}${init};`);
    }
    lines.push('');
  }

  lines.push('void setup() {');
  for (const { pin, mode } of analysis.pinModes) {
    lines.push(`${INDENT}pinMode(${pinToC(pin)}, ${mode});`);
  }
  if (analysis.serialUsed) lines.push(`${INDENT}Serial.begin(9600);`);
  for (const { servoId, pin } of analysis.hoistedLoopAttaches) {
    lines.push(`${INDENT}${servoId}.attach(${pinToC(pin)});`);
  }
  printStatements(program.setup, 1, state, lines, (stmt) => stmt.kind === 'pinMode');
  lines.push('}');
  lines.push('');

  lines.push('void loop() {');
  printStatements(program.loop, 1, state, lines, (stmt) => stmt.kind === 'servoAttach');
  lines.push('}');

  return { code: lines.join('\n') + '\n', diagnostics: analysis.diagnostics };
}
