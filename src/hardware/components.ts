/**
 * Dynamic hardware components — LED, Button, Potentiometer first, concrete
 * and unabstracted (implemenation_plam/hardware.md §3, "rule of three").
 *
 * A ComponentInstance (persistence.md) is the placed component; blocks
 * target instances, not raw pins, and lowering reads instance config
 * (`activeHigh`, `pullMode`) — never hardcoded polarity (codegen.md §6).
 */
import type { ComponentInstance, ComponentType } from '../persistence/projectDocument';
import type { BoardProfile, PinId } from './types';

export type PlaceableComponentType = Extract<ComponentType, 'led' | 'button' | 'potentiometer' | 'buzzer' | 'servo'>;

export const PLACEABLE_TYPES: PlaceableComponentType[] = ['led', 'button', 'potentiometer', 'buzzer', 'servo'];

export const COMPONENT_LABELS: Record<PlaceableComponentType, string> = {
  led: 'LED',
  button: 'Button',
  potentiometer: 'Potentiometer',
  buzzer: 'Buzzer',
  servo: 'Servo',
};

const DEFAULT_CONFIG: Record<PlaceableComponentType, Record<string, unknown>> = {
  led: { color: 'red', activeHigh: true },
  button: { pullMode: 'internal_pullup' },
  potentiometer: {},
  buzzer: {},
  servo: {},
};

/** Pins a component's signal may attach to on this board. */
export function allowedPins(type: PlaceableComponentType, board: BoardProfile): PinId[] {
  return type === 'potentiometer' ? board.analogPins : board.digitalPins;
}

export function signalPin(instance: ComponentInstance): PinId | null {
  return instance.pins.signal ?? null;
}

export function ledIsActiveHigh(instance: ComponentInstance): boolean {
  return instance.config.activeHigh !== false;
}

export function buttonUsesPullup(instance: ComponentInstance): boolean {
  return instance.config.pullMode !== 'external_pulldown';
}

function pinsInUse(components: ComponentInstance[]): Set<PinId> {
  const used = new Set<PinId>();
  for (const component of components) {
    const pin = signalPin(component);
    if (pin) used.add(pin);
  }
  return used;
}

function firstFreePin(candidates: PinId[], components: ComponentInstance[]): PinId | null {
  const used = pinsInUse(components);
  return candidates.find((pin) => !used.has(pin)) ?? null;
}

/**
 * Creates a placed component with a friendly name and a sensible default
 * pin: LEDs prefer D13 (the classic first circuit), buttons prefer D2,
 * potentiometers prefer A0 — falling back to the first free allowed pin.
 * D0/D1 are never suggested (serial-reserved).
 */
export function createComponent(
  type: PlaceableComponentType,
  id: string,
  existing: ComponentInstance[],
  board: BoardProfile,
): ComponentInstance {
  // Servo prefers D9 (a classic wiring; it does NOT need PWM — hardware.md §2);
  // the buzzer avoids D3/D11 so tone() stays clear of Timer2 PWM by default.
  const preferred: Record<PlaceableComponentType, PinId[]> = {
    led: ['D13', 'D12', 'D11', 'D10'],
    button: ['D2', 'D3', 'D4', 'D7'],
    potentiometer: ['A0', 'A1', 'A2'],
    buzzer: ['D8', 'D7', 'D4'],
    servo: ['D9', 'D6', 'D5'],
  };
  const safeAllowed = allowedPins(type, board).filter((pin) => !board.reservedPins.serial.includes(pin));
  const pin =
    firstFreePin(preferred[type], existing) ?? firstFreePin(safeAllowed, existing);

  const count = existing.filter((c) => c.type === type).length + 1;
  return {
    id,
    type,
    displayName: `${COMPONENT_LABELS[type]} ${count}`,
    position: { x: 0, y: 0 },
    config: { ...DEFAULT_CONFIG[type] },
    pins: { signal: pin },
  };
}

/**
 * "What is this?" explainers, keyed to the editor mode: beginner text is for
 * a kid meeting the part for the first time; intermediate adds the
 * electrical idea; advanced talks real numbers (shown via the ⓘ popup in
 * the hardware panel).
 */
export const COMPONENT_EXPLAINERS: Record<
  PlaceableComponentType,
  Record<'beginner' | 'intermediate' | 'advanced', string>
> = {
  led: {
    beginner: 'A tiny light! Turn its pin ON and it glows. Great for showing that your program is doing something.',
    intermediate:
      'A Light-Emitting Diode — it glows when electricity flows through it one way. Writing HIGH to its pin lights it (unless it is wired active-low). Real LEDs need a resistor so they do not burn out.',
    advanced:
      'A diode that emits light. Forward voltage ≈2 V, so a series resistor (220 Ω from 5 V) limits current to ~15 mA. Active-low wiring inverts the logic: LOW = lit, and brightness 255 means off.',
  },
  button: {
    beginner: 'A push button — press it to tell your program something, like a doorbell!',
    intermediate:
      'A switch that connects the pin to ground while pressed. With the internal pull-up resistor, the pin reads HIGH when idle and LOW when pressed — that is why "is pressed?" checks for LOW.',
    advanced:
      'A momentary switch. INPUT_PULLUP holds the line HIGH through ~20 kΩ; pressing shorts it to GND (reads LOW). External pull-down flips the logic. Real buttons bounce for a few ms — debounce if you count presses.',
  },
  potentiometer: {
    beginner: 'A twisty knob! Turn it and your program gets a number from 0 (one end) to 1023 (the other end).',
    intermediate:
      'A variable resistor. Its middle pin outputs a voltage between 0 V and 5 V as you turn it, and analogRead turns that voltage into a number from 0 to 1023.',
    advanced:
      'A voltage divider: the wiper taps a fraction of 5 V. The Uno’s 10-bit ADC maps 0–5 V to 0–1023. Use map() to rescale, and expect ±1 count of jitter on real hardware.',
  },
  buzzer: {
    beginner: 'A little speaker. Tell it a note and it beeps until you tell it to stop!',
    intermediate:
      'A piezo buzzer. tone(pin, frequency) makes it vibrate that many times per second — 440 is the musical note A. noTone() makes it quiet again.',
    advanced:
      'A passive piezo driven by the square wave from tone() (Timer2 on the Uno — it can disturb PWM on D3/D11). Useful range is roughly 31 Hz to a few kHz; volume is fixed.',
  },
  servo: {
    beginner: 'A robot-arm motor! Tell it an angle from 0 to 180 and it turns right there and holds on.',
    intermediate:
      'A motor with position control built in. servo.write(angle) sends the arm to that angle. It needs attach() in setup() — Pinboard writes that line for you.',
    advanced:
      'A hobby servo: a 50 Hz control pulse of 1–2 ms maps to 0–180°. The Servo library uses Timer1 (can disturb PWM on D9/D10). On real hardware, power it from 5 V, never from a signal pin.',
  },
};
