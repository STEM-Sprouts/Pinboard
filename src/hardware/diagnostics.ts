/**
 * Board-level diagnostics engine (implemenation_plam/hardware.md §5–6).
 *
 * Diagnostics teach: they state what is wrong, why it matters, and whether
 * it is fatal — surfaced in the hardware panel, never buried in a console.
 * Component-binding rules (block-writes-unconnected-pin, pin mismatch)
 * arrive with the dynamic component system.
 */
import type { ProgramIR } from '../ir/types';
import { walkExpressions, walkStatements } from '../ir/walk';
import type { BoardProfile, Diagnostic, PinId } from './types';

export function analyzeProgramDiagnostics(program: ProgramIR, board: BoardProfile): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const pwmWritten = new Set<PinId>();
  const touchedPins = new Set<PinId>();
  let usesServo = false;
  let usesTone = false;
  let hasObservableOutput = false;

  walkStatements([...program.setup, ...program.loop], (stmt) => {
    switch (stmt.kind) {
      case 'digitalWrite':
        touchedPins.add(stmt.pin);
        hasObservableOutput = true;
        break;
      case 'analogWrite':
        touchedPins.add(stmt.pin);
        pwmWritten.add(stmt.pin);
        hasObservableOutput = true;
        if (!board.pwmPins.includes(stmt.pin)) {
          diagnostics.push({
            id: `analogwrite-non-pwm:${stmt.pin}`,
            severity: 'warning',
            title: 'analogWrite on a non-PWM pin',
            message:
              `${stmt.pin} does not support PWM on the ${board.displayName}. ` +
              'The pin will act digital: values 128 and above behave like HIGH, below like LOW. ' +
              `Prefer a PWM pin (${board.pwmPins.join(', ')}).`,
            source: { pin: stmt.pin },
          });
        }
        break;
      case 'pinMode':
        touchedPins.add(stmt.pin);
        break;
      case 'serialPrint':
        hasObservableOutput = true;
        break;
      case 'tone':
        usesTone = true;
        touchedPins.add(stmt.pin);
        hasObservableOutput = true;
        break;
      case 'noTone':
        usesTone = true;
        break;
      case 'servoAttach':
        usesServo = true;
        touchedPins.add(stmt.pin);
        break;
      case 'servoWrite':
        usesServo = true;
        hasObservableOutput = true;
        break;
      default:
        break;
    }
    walkExpressions(stmt, (expr) => {
      if (expr.kind !== 'read') return;
      touchedPins.add(expr.pin);
      if (expr.op === 'analog' && !board.analogPins.includes(expr.pin)) {
        diagnostics.push({
          id: `analogread-non-analog:${expr.pin}`,
          severity: 'error',
          title: 'analogRead needs an analog pin',
          message: `${expr.pin} cannot read analog values on the ${board.displayName}. Use ${board.analogPins.join(', ')}.`,
          source: { pin: expr.pin },
        });
      }
    });
  });

  for (const pin of board.reservedPins.serial) {
    if (touchedPins.has(pin)) {
      diagnostics.push({
        id: `serial-reserved-pin:${pin}`,
        severity: 'warning',
        title: 'Serial pin in use',
        message: `${pin} is shared with USB serial on the ${board.displayName}. Using it can break uploads and the serial monitor — avoid it in beginner projects.`,
        source: { pin },
      });
    }
  }

  for (const rule of board.timerNotes) {
    const servoOk = rule.when.usesServo === undefined || rule.when.usesServo === usesServo;
    const toneOk = rule.when.usesTone === undefined || rule.when.usesTone === usesTone;
    const pwmOk =
      rule.when.usesPwmPins === undefined || rule.when.usesPwmPins.some((pin) => pwmWritten.has(pin));
    if (servoOk && toneOk && pwmOk && (rule.when.usesServo || rule.when.usesTone)) {
      diagnostics.push({
        id: rule.id,
        severity: rule.severity,
        title: 'Timer conflict',
        message: rule.message,
      });
    }
  }

  if (program.loop.length === 0) {
    diagnostics.push({
      id: 'no-loop',
      severity: 'info',
      title: 'Nothing runs forever',
      message: 'Your program has no blocks in loop(), so it runs setup once and then does nothing.',
    });
  }
  if (!hasObservableOutput) {
    diagnostics.push({
      id: 'no-observable-output',
      severity: 'info',
      title: 'No visible output',
      message: 'Your program never writes a pin or prints to serial, so nothing in the simulator will change.',
    });
  }

  return diagnostics;
}
