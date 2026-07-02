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
