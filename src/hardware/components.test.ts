import { describe, expect, it } from 'vitest';
import { ledBrightness } from './components';

describe('ledBrightness', () => {
  it('is off before the program has driven the pin', () => {
    expect(ledBrightness(undefined, undefined, true)).toBe(0);
  });

  it('follows the digital level for an active-high LED', () => {
    expect(ledBrightness(true, undefined, true)).toBe(1);
    expect(ledBrightness(false, undefined, true)).toBe(0);
  });

  it('inverts the digital level for an active-low LED', () => {
    expect(ledBrightness(false, undefined, false)).toBe(1);
    expect(ledBrightness(true, undefined, false)).toBe(0);
  });

  it('scales with the analogWrite duty cycle (0-255)', () => {
    expect(ledBrightness(undefined, 0, true)).toBe(0);
    expect(ledBrightness(undefined, 255, true)).toBe(1);
    expect(ledBrightness(undefined, 51, true)).toBeCloseTo(0.2, 5);
  });

  it('inverts the duty cycle for an active-low LED', () => {
    expect(ledBrightness(undefined, 255, false)).toBe(0);
    expect(ledBrightness(undefined, 51, false)).toBeCloseTo(0.8, 5);
  });

  it('prefers the PWM duty over a stale digital level', () => {
    expect(ledBrightness(true, 128, true)).toBeCloseTo(128 / 255, 5);
  });
});
