export default function SerialMonitor({ output }: { output: string[] }) {
  return (
    <div className="flex flex-col h-64 border-t-2 border-ink">
      <div className="px-4 py-2 bg-surface border-b-2 border-ink flex justify-between items-center text-sm font-bold text-ink">
        Serial Monitor
      </div>
      <div data-testid="serial-output" className="p-4 flex-1 overflow-y-auto bg-gray-900 text-green-400 font-mono text-sm whitespace-pre-wrap">
        {output.length === 0 ? <span className="text-gray-400 italic">No output...</span> : output.join('\n')}
      </div>
    </div>
  );
}
