/**
 * Printer tests (implemenation_plam/testing.md §1, TASKS.md Phase 0):
 * golden output for the canonical fixtures, deterministic output, no
 * duplicate pinMode, and inference/conflict diagnostics.
 */
import { describe, expect, it } from 'vitest';
import {
  blinkExpectedC,
  buzzerAlarmExpectedC,
  buzzerAlarmProgram,
  potBrightnessExpectedC,
  potBrightnessProgram,
  blinkProgram,
  blinkWithoutDelayExpectedC,
  blinkWithoutDelayProgram,
  buttonControlsLedExpectedC,
  buttonControlsLedProgram,
  servoSweepExpectedC,
  servoSweepProgram,
} from '../testing/fixtures';
import {
  bin,
  bool,
  delayMs,
  digitalWrite,
  forRange,
  iff,
  pinModeStmt,
  program,
  readDigital,
  servoAttach,
  servoWrite,
  variable,
} from '../testing/builders';
import { printArduino } from './printArduino';

describe('IR → Arduino C printer', () => {
  it('prints the blink fixture', () => {
    expect(printArduino(blinkProgram).code).toBe(blinkExpectedC);
  });

  it('prints the blink-without-delay fixture', () => {
    expect(printArduino(blinkWithoutDelayProgram).code).toBe(blinkWithoutDelayExpectedC);
  });

  it('prints the button-controls-led fixture', () => {
    expect(printArduino(buttonControlsLedProgram).code).toBe(buttonControlsLedExpectedC);
  });

  it('prints the buzzer-alarm fixture', () => {
    expect(printArduino(buzzerAlarmProgram).code).toBe(buzzerAlarmExpectedC);
  });

  it('prints the potentiometer-brightness fixture', () => {
    expect(printArduino(potBrightnessProgram).code).toBe(potBrightnessExpectedC);
  });

  it('prints the servo-sweep fixture with hoisted include and declaration', () => {
    expect(printArduino(servoSweepProgram).code).toBe(servoSweepExpectedC);
  });

  it('output is deterministic across repeated prints and cloned IR', () => {
    const once = printArduino(blinkWithoutDelayProgram).code;
    const twice = printArduino(blinkWithoutDelayProgram).code;
    const cloned = printArduino(structuredClone(blinkWithoutDelayProgram)).code;
    expect(twice).toBe(once);
    expect(cloned).toBe(once);
  });

  it('never emits duplicate pinMode for a pin', () => {
    const doubleWrite = program({
      setup: [pinModeStmt('D13', 'OUTPUT', true)],
      loop: [digitalWrite('D13', true), delayMs(100), digitalWrite('D13', false), delayMs(100)],
    });
    const { code } = printArduino(doubleWrite);
    expect(code.match(/pinMode\(13, /g)).toHaveLength(1);
  });

  it('flags writes to a pin declared as input', () => {
    const conflicted = program({
      setup: [pinModeStmt('D5', 'INPUT', true)],
      loop: [digitalWrite('D5', true)],
    });
    const { diagnostics } = printArduino(conflicted);
    expect(diagnostics.some((d) => d.id === 'pinmode-write-conflict:D5')).toBe(true);
  });

  it('hoists a loop-placed servo attach into setup()', () => {
    const attachInLoop = program({
      loop: [servoAttach('arm', 'D9'), forRange('a', 0, 90, 30, [servoWrite('arm', variable('a')), delayMs(20)])],
    });
    const { code, diagnostics } = printArduino(attachInLoop);
    const setupBlock = code.slice(code.indexOf('void setup()'), code.indexOf('void loop()'));
    const loopBlock = code.slice(code.indexOf('void loop()'));
    expect(setupBlock).toContain('arm.attach(9);');
    expect(loopBlock).not.toContain('attach');
    expect(code).toContain('#include <Servo.h>');
    expect(diagnostics.some((d) => d.id === 'servo-attach-hoisted')).toBe(true);
  });
});

describe('code source map (codegen.md §9)', () => {
  it('maps a simple statement to its printed line, both directions', () => {
    const prog = program({
      loop: [
        { ...digitalWrite('D13', true), sourceBlockId: 'write-1' },
        { ...delayMs(500), sourceBlockId: 'delay-1' },
      ],
    });
    const { code, sourceMap } = printArduino(prog);
    const lines = code.split('\n');
    const writeLine = lines.findIndex((l) => l.includes('digitalWrite(13, HIGH);')) + 1;
    const delayLine = lines.findIndex((l) => l.includes('delay(500);')) + 1;
    expect(writeLine).toBeGreaterThan(0);
    expect(sourceMap.cLineToBlockId[writeLine]).toBe('write-1');
    expect(sourceMap.cLineToBlockId[delayLine]).toBe('delay-1');
    expect(sourceMap.blockIdToLineRange['write-1']).toEqual({ start: writeLine, end: writeLine });
    expect(sourceMap.blockIdToLineRange['delay-1']).toEqual({ start: delayLine, end: delayLine });
  });

  it('a container block spans its whole range while inner lines keep the inner block', () => {
    const inner = { ...digitalWrite('D13', true), sourceBlockId: 'inner-1' };
    const prog = program({
      loop: [{ ...iff(bin('==', readDigital('D2'), bool(false)), [inner]), sourceBlockId: 'if-1' }],
    });
    const { code, sourceMap } = printArduino(prog);
    const lines = code.split('\n');
    const ifLine = lines.findIndex((l) => l.trim().startsWith('if (')) + 1;
    const writeLine = lines.findIndex((l) => l.includes('digitalWrite(13, HIGH);')) + 1;
    expect(sourceMap.blockIdToLineRange['if-1']).toEqual({ start: ifLine, end: ifLine + 2 });
    expect(sourceMap.cLineToBlockId[ifLine]).toBe('if-1');
    expect(sourceMap.cLineToBlockId[writeLine]).toBe('inner-1');
    expect(sourceMap.cLineToBlockId[ifLine + 2]).toBe('if-1');
  });

  it('statements without a source block id stay unmapped', () => {
    const prog = program({ loop: [digitalWrite('D13', true)] });
    const { sourceMap } = printArduino(prog);
    expect(sourceMap.cLineToBlockId).toEqual({});
    expect(sourceMap.blockIdToLineRange).toEqual({});
  });
});
