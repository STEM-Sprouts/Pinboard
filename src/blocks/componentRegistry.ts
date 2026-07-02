/**
 * The component-block dropdowns read the placed components from here.
 * App keeps it in sync with editor state; Blockly's dropdown option
 * functions are evaluated lazily, so options are always current.
 */
import type { ComponentInstance } from '../persistence/projectDocument';

export const NO_COMPONENT = '__none__';

let registered: ComponentInstance[] = [];

export function setRegisteredComponents(components: ComponentInstance[]): void {
  registered = components;
}

export function getRegisteredComponents(): ComponentInstance[] {
  return registered;
}

export function componentDropdownOptions(type: ComponentInstance['type'], emptyLabel: string): [string, string][] {
  const matching = registered.filter((c) => c.type === type);
  if (matching.length === 0) return [[emptyLabel, NO_COMPONENT]];
  return matching.map((c) => [c.displayName, c.id]);
}
