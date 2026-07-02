/**
 * Pin state store (implemenation_plam/runtime.md §9).
 *
 * The interpreter writes output state here; UI/tests inject input state via
 * the `setExternal*` methods between resumes. Reads always consult current
 * state (never cached) — that is what makes "wait until button pressed" work.
 *
 * Timestamps are passed in by callers (virtual time); the store itself never
 * consults a clock, keeping it deterministic and headless.
 */
import type { PinId } from '../hardware/types';

export type PinMode = 'INPUT' | 'INPUT_PULLUP' | 'OUTPUT';

export type PinState = {
  mode?: PinMode;
  digitalValue?: boolean;
  analogValue?: number;
  pwmValue?: number;
  servoAngle?: number;
  toneHz?: number;
  toneUntilMs?: number;
  lastUpdatedAtMs: number;
  writers: string[];
};

export type PinChangeEvent = {
  timeMs: number;
  pin: PinId;
  kind: 'mode' | 'digital' | 'pwm' | 'servo' | 'tone';
  value: PinMode | boolean | number | null;
};

export const SERVO_MIN_ANGLE = 0;
export const SERVO_MAX_ANGLE = 180;

export class PinStateStore {
  private states = new Map<PinId, PinState>();
  private externalDigital = new Map<PinId, boolean>();
  private externalAnalog = new Map<PinId, number>();
  private listeners: Array<(event: PinChangeEvent) => void> = [];

  private stateFor(pin: PinId, timeMs: number): PinState {
    let state = this.states.get(pin);
    if (!state) {
      state = { lastUpdatedAtMs: timeMs, writers: [] };
      this.states.set(pin, state);
    }
    return state;
  }

  private emit(event: PinChangeEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private touch(state: PinState, timeMs: number, writer: string): void {
    state.lastUpdatedAtMs = timeMs;
    if (!state.writers.includes(writer)) state.writers.push(writer);
  }

  setMode(pin: PinId, mode: PinMode, timeMs: number, writer = 'pinMode'): void {
    const state = this.stateFor(pin, timeMs);
    const changed = state.mode !== mode;
    state.mode = mode;
    this.touch(state, timeMs, writer);
    if (changed) this.emit({ timeMs, pin, kind: 'mode', value: mode });
  }

  writeDigital(pin: PinId, value: boolean, timeMs: number, writer = 'digitalWrite'): void {
    const state = this.stateFor(pin, timeMs);
    if (state.mode === undefined) state.mode = 'OUTPUT';
    const changed = state.digitalValue !== value;
    state.digitalValue = value;
    this.touch(state, timeMs, writer);
    if (changed) this.emit({ timeMs, pin, kind: 'digital', value });
  }

  writePwm(pin: PinId, value: number, timeMs: number, writer = 'analogWrite'): void {
    const clamped = Math.min(255, Math.max(0, Math.round(value)));
    const state = this.stateFor(pin, timeMs);
    if (state.mode === undefined) state.mode = 'OUTPUT';
    const changed = state.pwmValue !== clamped;
    state.pwmValue = clamped;
    this.touch(state, timeMs, writer);
    if (changed) this.emit({ timeMs, pin, kind: 'pwm', value: clamped });
  }

  writeServoAngle(pin: PinId, angleDeg: number, timeMs: number, writer = 'servoWrite'): void {
    const clamped = Math.min(SERVO_MAX_ANGLE, Math.max(SERVO_MIN_ANGLE, Math.round(angleDeg)));
    const state = this.stateFor(pin, timeMs);
    const changed = state.servoAngle !== clamped;
    state.servoAngle = clamped;
    this.touch(state, timeMs, writer);
    if (changed) this.emit({ timeMs, pin, kind: 'servo', value: clamped });
  }

  setTone(pin: PinId, frequencyHz: number, timeMs: number, durationMs?: number): void {
    const state = this.stateFor(pin, timeMs);
    state.toneHz = frequencyHz;
    state.toneUntilMs = durationMs === undefined ? undefined : timeMs + durationMs;
    this.touch(state, timeMs, 'tone');
    this.emit({ timeMs, pin, kind: 'tone', value: frequencyHz });
  }

  clearTone(pin: PinId, timeMs: number): void {
    const state = this.stateFor(pin, timeMs);
    if (state.toneHz === undefined) return;
    state.toneHz = undefined;
    state.toneUntilMs = undefined;
    this.touch(state, timeMs, 'noTone');
    this.emit({ timeMs, pin, kind: 'tone', value: null });
  }

  /** UI/test input: externally drive a digital pin (button). `undefined` releases it. */
  setExternalDigital(pin: PinId, value: boolean | undefined): void {
    if (value === undefined) this.externalDigital.delete(pin);
    else this.externalDigital.set(pin, value);
  }

  /** UI/test input: externally drive an analog pin (potentiometer), 0–1023. */
  setExternalAnalog(pin: PinId, value: number): void {
    this.externalAnalog.set(pin, Math.min(1023, Math.max(0, Math.round(value))));
  }

  /**
   * digitalRead semantics: an externally driven value wins; otherwise an
   * OUTPUT pin reads back its own written value; otherwise INPUT_PULLUP
   * floats HIGH and plain INPUT floats LOW.
   */
  readDigital(pin: PinId): boolean {
    const external = this.externalDigital.get(pin);
    if (external !== undefined) return external;
    const state = this.states.get(pin);
    if (!state) return false;
    if (state.mode === 'OUTPUT') return state.digitalValue ?? false;
    if (state.mode === 'INPUT_PULLUP') return true;
    return false;
  }

  readAnalog(pin: PinId): number {
    return this.externalAnalog.get(pin) ?? 0;
  }

  get(pin: PinId): PinState | undefined {
    return this.states.get(pin);
  }

  onChange(listener: (event: PinChangeEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  reset(): void {
    this.states.clear();
    this.externalDigital.clear();
    this.externalAnalog.clear();
  }
}
