/**
 * Dynamic hardware panel (implemenation_plam/hardware.md §3): students add
 * components, assign pins with the board-aware picker, and see them react
 * to the running program. Diagnostics are shown here, never buried in a
 * console.
 */
import LED from './LED';
import Button from './Button';
import PinPicker from './PinPicker';
import SerialMonitor from './SerialMonitor';
import { allowedPins, buttonUsesPullup, ledIsActiveHigh, signalPin, COMPONENT_LABELS, PLACEABLE_TYPES, type PlaceableComponentType } from '../hardware/components';
import type { BoardProfile, Diagnostic, PinId } from '../hardware/types';
import type { ComponentInstance } from '../persistence/projectDocument';

interface SimProps {
  board: BoardProfile;
  components: ComponentInstance[];
  /** Electrical digital level per pin, from the runtime's pin store. */
  pinStates: Record<string, boolean>;
  buttonPressed: Record<string, boolean>;
  potValues: Record<string, number>;
  serialOutput: string[];
  diagnostics: Diagnostic[];
  onAddComponent: (type: PlaceableComponentType) => void;
  onRemoveComponent: (id: string) => void;
  onSetComponentPin: (id: string, pin: PinId | null) => void;
  onSetLedActiveHigh: (id: string, activeHigh: boolean) => void;
  onButtonPress: (instance: ComponentInstance, pressed: boolean) => void;
  onPotChange: (instance: ComponentInstance, value: number) => void;
}

const SEVERITY_STYLES: Record<Diagnostic['severity'], string> = {
  error: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};

function pinTag(pin: PinId | null): string {
  return pin ? `PIN ${pin.startsWith('D') ? pin.slice(1) : pin}` : 'NO PIN';
}

export default function SimulationPanel({
  board,
  components,
  pinStates,
  buttonPressed,
  potValues,
  serialOutput,
  diagnostics,
  onAddComponent,
  onRemoveComponent,
  onSetComponentPin,
  onSetLedActiveHigh,
  onButtonPress,
  onPotChange,
}: SimProps) {
  const usedByFor = (self: ComponentInstance): Map<PinId, string> => {
    const used = new Map<PinId, string>();
    for (const other of components) {
      const pin = signalPin(other);
      if (other.id !== self.id && pin) used.set(pin, other.displayName);
    }
    return used;
  };

  const componentVisual = (instance: ComponentInstance) => {
    const pin = signalPin(instance);
    const pinSuffix = pin ? (pin.startsWith('D') ? pin.slice(1) : pin) : `unassigned-${instance.id}`;
    switch (instance.type) {
      case 'led': {
        const level = pin ? pinStates[pin] : undefined;
        const lit = level === undefined ? false : level === ledIsActiveHigh(instance);
        return <LED label={pinTag(pin)} state={lit} testId={`led-${pinSuffix}`} />;
      }
      case 'button':
        return (
          <Button
            label={pinTag(pin)}
            isPressed={buttonPressed[instance.id] ?? false}
            testId={`virtual-button-${pinSuffix}`}
            onPressChange={(pressed) => onButtonPress(instance, pressed)}
          />
        );
      case 'potentiometer': {
        const value = potValues[instance.id] ?? 512;
        return (
          <div className="flex flex-col items-center gap-2 p-3 border border-gray-100 rounded-lg bg-gray-50 shadow-sm w-full">
            <input
              type="range"
              min={0}
              max={1023}
              value={value}
              data-testid={`pot-${pinSuffix}`}
              onChange={(e) => onPotChange(instance, Number(e.target.value))}
              className="w-full"
            />
            <span className="text-xs font-mono font-bold text-gray-500">
              {pinTag(pin)} · {value}
            </span>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="p-4 flex-1 overflow-y-auto">
        <h2 className="font-bold text-gray-800 mb-4 text-lg border-b pb-2">Hardware Setup</h2>

        <div className="mb-4 flex flex-wrap gap-2">
          {PLACEABLE_TYPES.map((type) => (
            <button
              key={type}
              data-testid={`add-${type}`}
              onClick={() => onAddComponent(type)}
              className="text-xs px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium"
            >
              + {COMPONENT_LABELS[type]}
            </button>
          ))}
        </div>

        {components.length === 0 && (
          <p className="text-xs text-gray-400 mb-4">No components yet — add an LED to get started.</p>
        )}

        <div className="space-y-3 mb-6">
          {components.map((instance) => (
            <div key={instance.id} data-testid={`component-${instance.id}`} className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">{instance.displayName}</span>
                <button
                  data-testid={`remove-${instance.id}`}
                  onClick={() => onRemoveComponent(instance.id)}
                  title={`Remove ${instance.displayName}`}
                  className="text-gray-400 hover:text-red-500 text-sm font-bold px-1"
                >
                  ✕
                </button>
              </div>
              <div className="flex justify-center mb-2">{componentVisual(instance)}</div>
              <PinPicker
                board={board}
                allowed={allowedPins(instance.type as PlaceableComponentType, board)}
                value={signalPin(instance)}
                usedBy={usedByFor(instance)}
                testId={`pin-picker-${instance.id}`}
                onChange={(pin) => onSetComponentPin(instance.id, pin)}
              />
              {instance.type === 'led' && (
                <label className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={!ledIsActiveHigh(instance)}
                    onChange={(e) => onSetLedActiveHigh(instance.id, !e.target.checked)}
                  />
                  active-low wiring (LED to 5V)
                </label>
              )}
              {instance.type === 'button' && (
                <p className="mt-2 text-xs text-gray-400">
                  {buttonUsesPullup(instance) ? 'Internal pull-up: pressed reads LOW.' : 'External pull-down: pressed reads HIGH.'}
                </p>
              )}
            </div>
          ))}
        </div>

        {diagnostics.length > 0 && (
          <div className="mb-6" data-testid="diagnostics">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Diagnostics</h3>
            <ul className="space-y-2">
              {diagnostics.map((d) => (
                <li key={d.id} className={`text-xs rounded-md border p-2 ${SEVERITY_STYLES[d.severity]}`}>
                  <span className="font-semibold">{d.title}.</span> {d.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <SerialMonitor output={serialOutput} />
    </div>
  );
}
