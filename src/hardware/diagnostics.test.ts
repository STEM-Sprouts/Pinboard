/**
 * Diagnostics engine tests (implemenation_plam/hardware.md §5–6 rules table).
 */
import { describe, expect, it } from 'vitest';
import {
  analogWrite,
  delayMs,
  digitalWrite,
  program,
  readAnalog,
  serialPrintln,
  servoAttach,
  servoWrite,
  str,
} from '../testing/builders';
import { blinkProgram } from '../testing/fixtures';
import { arduinoUno } from './boards/arduinoUno';
import { analyzeProgramDiagnostics } from './diagnostics';

const ids = (programUnderTest: Parameters<typeof analyzeProgramDiagnostics>[0]) =>
  analyzeProgramDiagnostics(programUnderTest, arduinoUno).map((d) => d.id);

describe('board diagnostics', () => {
  it('a healthy blink program has no diagnostics', () => {
    expect(ids(blinkProgram)).toEqual([]);
  });

  it('warns on analogWrite to a non-PWM pin (models degenerate behavior, does not reject)', () => {
    const p = program({ loop: [analogWrite('D4', 200), delayMs(100)] });
    const diagnostics = analyzeProgramDiagnostics(p, arduinoUno);
    const hit = diagnostics.find((d) => d.id === 'analogwrite-non-pwm:D4');
    expect(hit?.severity).toBe('warning');
    expect(hit?.message).toContain('128');
  });

  it('errors on analogRead of a non-analog pin', () => {
    const p = program({ loop: [serialPrintln(readAnalog('D13')), delayMs(100)] });
    const hit = analyzeProgramDiagnostics(p, arduinoUno).find((d) => d.id === 'analogread-non-analog:D13');
    expect(hit?.severity).toBe('error');
  });

  it('warns when D0/D1 (USB serial) are used', () => {
    const p = program({ loop: [digitalWrite('D1', true), delayMs(100)] });
    expect(ids(p)).toContain('serial-reserved-pin:D1');
  });

  it('fires the servo/Timer1 PWM conflict on D9/D10', () => {
    const p = program({
      setup: [servoAttach('arm', 'D5')],
      loop: [servoWrite('arm', 90), analogWrite('D9', 128), delayMs(100)],
    });
    expect(ids(p)).toContain('servo-timer1-pwm-9-10');
  });

  it('does not fire the servo conflict without PWM on D9/D10', () => {
    const p = program({
      setup: [servoAttach('arm', 'D5')],
      loop: [servoWrite('arm', 90), analogWrite('D6', 128), delayMs(100)],
    });
    expect(ids(p)).not.toContain('servo-timer1-pwm-9-10');
  });

  it('flags an empty loop and invisible programs as info', () => {
    const idle = program({ setup: [serialPrintln(str('setup only'))] });
    expect(ids(idle)).toContain('no-loop');

    const invisible = program({ loop: [delayMs(100)] });
    expect(ids(invisible)).toContain('no-observable-output');
  });
});
