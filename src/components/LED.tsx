const GLOW_RGB: Record<string, string> = {
  red: '239, 68, 68',
  blue: '27, 79, 219',
};

/** `brightness` is 0–1: 0 = off, 1 = fully lit, in between = PWM dimming. */
export default function LED({ label, brightness, testId, color = 'red' }: { label: string; brightness: number; testId: string; color?: string }) {
  const level = Math.min(1, Math.max(0, brightness));
  const isActive = level > 0;
  const rgb = GLOW_RGB[color] ?? GLOW_RGB.red;
  const style = isActive
    ? { backgroundColor: `rgba(${rgb}, ${0.25 + 0.75 * level})`, boxShadow: `0 0 ${15 * level}px rgba(${rgb}, ${0.8 * level})` }
    : undefined;

  return (
    <div
      data-testid={testId}
      data-state={isActive ? 'on' : 'off'}
      data-brightness={level.toFixed(2)}
      className="flex flex-col items-center gap-2 p-3 border border-gray-100 rounded-lg bg-gray-50 shadow-sm w-20"
    >
      <div className={`w-8 h-8 rounded-full transition-all duration-100 ${isActive ? '' : 'bg-gray-200 shadow-inner'}`} style={style} />
      <span className="text-xs font-mono font-bold text-gray-500">{label}</span>
    </div>
  );
}
