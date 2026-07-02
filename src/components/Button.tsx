export default function Button({ pin, isPressed, onPressChange }: { pin: number, isPressed: boolean, onPressChange: (pressed: boolean) => void }) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 border border-gray-100 rounded-lg bg-gray-50 shadow-sm w-20">
      <button
        data-testid={`virtual-button-${pin}`}
        data-pressed={isPressed ? 'true' : 'false'}
        onMouseDown={() => onPressChange(true)}
        onMouseUp={() => onPressChange(false)}
        onMouseLeave={() => onPressChange(false)}
        className={`w-10 h-10 rounded-full border-4 border-gray-300 transition-all ${isPressed ? 'bg-gray-800 scale-95 shadow-inner' : 'bg-white shadow-[0_4px_0_#d1d5db] translate-y-[-2px]'}`}
      />
      <span className="text-xs font-mono font-bold text-gray-500 mt-1">PIN {pin}</span>
    </div>
  );
}
