/**
 * Emits the canonical fixtures as Arduino sketches for the CI compile job
 * (implemenation_plam/compiler.md §5). Also asserts the printer is
 * deterministic — the same IR must always print the same C.
 *
 * Run with: npm run generate:arduino-fixtures
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { printArduino } from '../src/arduino/printArduino';
import {
  blinkProgram,
  blinkWithoutDelayProgram,
  buttonControlsLedProgram,
  potBrightnessProgram,
  servoSweepProgram,
} from '../src/testing/fixtures';
import type { ProgramIR } from '../src/ir/types';

const fixtures: Record<string, ProgramIR> = {
  blink: blinkProgram,
  'blink-without-delay': blinkWithoutDelayProgram,
  'button-controls-led': buttonControlsLedProgram,
  'potentiometer-brightness': potBrightnessProgram,
  'servo-sweep': servoSweepProgram,
};

const outRoot = join(process.cwd(), 'build', 'arduino-fixtures');
let failed = false;

for (const [name, program] of Object.entries(fixtures)) {
  const first = printArduino(program);
  const second = printArduino(structuredClone(program));
  if (first.code !== second.code) {
    console.error(`✗ printer output is not deterministic for ${name}`);
    failed = true;
    continue;
  }
  // arduino-cli requires the .ino name to match its sketch directory.
  const sketchDir = join(outRoot, name);
  mkdirSync(sketchDir, { recursive: true });
  writeFileSync(join(sketchDir, `${name}.ino`), first.code);
  console.log(`✓ ${name}.ino (${first.code.length} bytes)`);
}

if (failed) process.exit(1);
