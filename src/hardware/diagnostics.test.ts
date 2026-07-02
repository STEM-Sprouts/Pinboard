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
import type { ComponentInstance } from '../persistence/projectDocument';
import type { PinId } from './types';
import { blinkProgram } from '../testing/fixtures';
import { arduinoUno } from './boards/arduinoUno';
import { analyzeComponentDiagnostics, analyzeProgramDiagnostics } from './diagnostics';

const instance = (
  id: string,
  type: ComponentInstance['type'],
  pin: PinId | null,
): ComponentInstance => ({
  id,
  type,
  displayName: id,
  position: { x: 0, y: 0 },
  config: {},
  pins: { signal: pin },
});

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

describe('component binding diagnostics', () => {
  it('two components on the same pin is an error', () => {
    const diagnostics = analyzeComponentDiagnostics(blinkProgram, [
      instance('led-1', 'led', 'D5'),
      instance('button-1', 'button', 'D5'),
    ]);
    const conflict = diagnostics.find((d) => d.id === 'pin-conflict:D5');
    expect(conflict?.severity).toBe('error');
    expect(conflict?.message).toContain('led-1');
    expect(conflict?.message).toContain('button-1');
  });

  it('an unconnected component is an error', () => {
    const diagnostics = analyzeComponentDiagnostics(blinkProgram, [instance('led-1', 'led', null)]);
    expect(diagnostics.some((d) => d.id === 'component-missing-pin:led-1' && d.severity === 'error')).toBe(true);
  });

  it('writing a pin with no component is the teachable warning', () => {
    const bare = analyzeComponentDiagnostics(blinkProgram, []);
    const warning = bare.find((d) => d.id === 'write-without-component:D13');
    expect(warning?.severity).toBe('warning');
    expect(warning?.message).toContain('writes to D13');

    const covered = analyzeComponentDiagnostics(blinkProgram, [instance('led-1', 'led', 'D13')]);
    expect(covered).toEqual([]);
  });
});

describe('timer-conflict warnings (hardware.md §2 timerNotes)', () => {
  it('warns when servo is used alongside PWM on D9/D10 (Timer1)', async () => {
    const { analyzeProgramDiagnostics } = await import('./diagnostics');
    const { arduinoUno } = await import('./boards/arduinoUno');
    const { program, servoAttach, servoWrite, analogWrite, num } = await import('../testing/builders');
    const prog = program({
      setup: [servoAttach('arm', 'D3')],
      loop: [servoWrite('arm', num(90)), analogWrite('D9', 128)],
    });
    const diagnostics = analyzeProgramDiagnostics(prog, arduinoUno);
    expect(diagnostics.some((d) => d.id === 'servo-timer1-pwm-9-10' && d.severity === 'warning')).toBe(true);
  });

  it('warns when tone is used alongside PWM on D3/D11 (Timer2)', async () => {
    const { analyzeProgramDiagnostics } = await import('./diagnostics');
    const { arduinoUno } = await import('./boards/arduinoUno');
    const { program, tone, analogWrite, num } = await import('../testing/builders');
    const prog = program({
      loop: [tone('D8', num(440)), analogWrite('D11', 100)],
    });
    const diagnostics = analyzeProgramDiagnostics(prog, arduinoUno);
    expect(diagnostics.some((d) => d.id === 'tone-timer2-pwm-3-11' && d.severity === 'warning')).toBe(true);
  });

  it('stays quiet when servo/tone do not share timer pins with PWM', async () => {
    const { analyzeProgramDiagnostics } = await import('./diagnostics');
    const { arduinoUno } = await import('./boards/arduinoUno');
    const { program, servoAttach, servoWrite, analogWrite, num } = await import('../testing/builders');
    const prog = program({
      setup: [servoAttach('arm', 'D9')],
      loop: [servoWrite('arm', num(90)), analogWrite('D6', 128)],
    });
    const diagnostics = analyzeProgramDiagnostics(prog, arduinoUno);
    expect(diagnostics.some((d) => d.title === 'Timer conflict')).toBe(false);
  });
});

describe('quick fixes (hardware.md §6): diagnose, offer, never auto-apply', () => {
  it('write-without-component offers "move the idle LED here" when exactly one candidate exists', async () => {
    const { analyzeComponentDiagnostics } = await import('./diagnostics');
    const { program, digitalWrite } = await import('../testing/builders');
    const led = {
      id: 'led-a',
      type: 'led' as const,
      displayName: 'LED 1',
      position: { x: 0, y: 0 },
      config: { activeHigh: true },
      pins: { signal: 'D12' as const },
    };
    const prog = program({ loop: [digitalWrite('D13', true)] });
    const diagnostics = analyzeComponentDiagnostics(prog, [led]);
    const warning = diagnostics.find((d) => d.id === 'write-without-component:D13');
    expect(warning?.fix).toEqual({
      label: 'Move LED 1 to D13',
      action: { kind: 'setComponentPin', componentId: 'led-a', pin: 'D13' },
    });
  });

  it('offers no fix when the candidate is ambiguous (two idle LEDs)', async () => {
    const { analyzeComponentDiagnostics } = await import('./diagnostics');
    const { program, digitalWrite } = await import('../testing/builders');
    const mk = (id: string, pin: 'D11' | 'D12') => ({
      id,
      type: 'led' as const,
      displayName: id,
      position: { x: 0, y: 0 },
      config: { activeHigh: true },
      pins: { signal: pin },
    });
    const prog = program({ loop: [digitalWrite('D13', true)] });
    const diagnostics = analyzeComponentDiagnostics(prog, [mk('led-a', 'D12'), mk('led-b', 'D11')]);
    const warning = diagnostics.find((d) => d.id === 'write-without-component:D13');
    expect(warning).toBeDefined();
    expect(warning?.fix).toBeUndefined();
  });
});
