import LED from './LED';
import Button from './Button';
import SerialMonitor from './SerialMonitor';
import type { Diagnostic } from '../hardware/types';

interface SimProps {
  pinStates: Record<number, boolean>;
  serialOutput: string[];
  diagnostics: Diagnostic[];
  onButtonPress: (pin: number, pressed: boolean) => void;
}

const SEVERITY_STYLES: Record<Diagnostic['severity'], string> = {
  error: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function SimulationPanel({ pinStates, serialOutput, diagnostics, onButtonPress }: SimProps) {
  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="p-4 flex-1 overflow-y-auto">
        <h2 className="font-bold text-gray-800 mb-6 text-lg border-b pb-2">Hardware Setup</h2>

        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Outputs</h3>
          <div className="flex flex-wrap gap-4">
            <LED pin={13} state={pinStates[13] || false} color="red" />
            <LED pin={12} state={pinStates[12] || false} color="primary" />
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Inputs</h3>
          <div className="flex flex-wrap gap-4">
            <Button pin={2} isPressed={pinStates[2] || false} onPressChange={(p) => onButtonPress(2, p)} />
          </div>
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
