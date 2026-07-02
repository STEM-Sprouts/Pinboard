/**
 * Board-aware pin picker (implemenation_plam/hardware.md §4): every option
 * shows context — capability, availability, and who is using it — never a
 * bare number.
 */
import type { BoardProfile, PinId } from '../hardware/types';

interface PinPickerProps {
  board: BoardProfile;
  allowed: PinId[];
  value: PinId | null;
  /** Pin → displayName of the component using it (excluding the owner). */
  usedBy: ReadonlyMap<PinId, string>;
  testId: string;
  onChange: (pin: PinId | null) => void;
}

function pinLabel(pin: PinId, board: BoardProfile, usedBy: ReadonlyMap<PinId, string>): string {
  const notes: string[] = [];
  if (board.analogPins.includes(pin)) notes.push('Analog');
  if (board.pwmPins.includes(pin)) notes.push('PWM');
  if (board.reservedPins.serial.includes(pin)) notes.push('Serial — avoid');
  const user = usedBy.get(pin);
  notes.push(user ? `used by ${user}` : 'available');
  return `${pin} · ${notes.join(' · ')}`;
}

export default function PinPicker({ board, allowed, value, usedBy, testId, onChange }: PinPickerProps) {
  return (
    <select
      data-testid={testId}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : (e.target.value as PinId))}
      className="w-full text-xs border border-gray-200 rounded-md px-1.5 py-1 bg-white text-gray-700"
    >
      <option value="">— pick a pin —</option>
      {allowed.map((pin) => (
        <option key={pin} value={pin}>
          {pinLabel(pin, board, usedBy)}
        </option>
      ))}
    </select>
  );
}
