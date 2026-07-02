export default function SerialMonitor({ output }: { output: string[] }) {
  return (
    <div className="flex flex-col h-64 border-t border-gray-200">
      <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center text-sm font-semibold text-gray-700">
        Serial Monitor
      </div>
      <div data-testid="serial-output" className="p-4 flex-1 overflow-y-auto bg-gray-900 text-green-400 font-mono text-sm whitespace-pre-wrap">
        {output.length === 0 ? <span className="text-gray-500 italic">No output...</span> : output.join('\n')}
      </div>
    </div>
  );
}
