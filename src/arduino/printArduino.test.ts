/**
 * Printer tests (implemenation_plam/testing.md §1, TASKS.md Phase 0):
 * golden output for the canonical fixtures, deterministic output, no
 * duplicate pinMode, and inference/conflict diagnostics.
 */
import { describe, expect, it } from 'vitest';
import {
  blinkExpectedC,
  blinkProgram,
  blinkWithoutDelayExpectedC,
  blinkWithoutDelayProgram,
  buttonControlsLedExpectedC,
  buttonControlsLedProgram,
  servoSweepExpectedC,
  servoSweepProgram,
} from '../testing/fixtures';
import {
  delayMs,
  digitalWrite,
  forRange,
  pinModeStmt,
  program,
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
