export default function LED({ label, state, testId, color = 'red' }: { label: string; state: boolean; testId: string; color?: string }) {
  const isActive = state;
  const bgClass = isActive
    ? (color === 'red' ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'bg-primary shadow-[0_0_15px_rgba(27,79,219,0.8)]')
    : 'bg-gray-200 shadow-inner';

  return (
    <div
      data-testid={testId}
      data-state={isActive ? 'on' : 'off'}
      className="flex flex-col items-center gap-2 p-3 border border-gray-100 rounded-lg bg-gray-50 shadow-sm w-20"
    >
      <div className={`w-8 h-8 rounded-full transition-all duration-100 ${bgClass}`} />
      <span className="text-xs font-mono font-bold text-gray-500">{label}</span>
    </div>
  );
}
