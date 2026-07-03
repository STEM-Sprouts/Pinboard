# Domain: Hardware (board, components, pin picker, diagnostics)

Owns the **canonical types `BoardProfile`, `PinId`, `Diagnostic`**, the Arduino Uno profile, the dynamic component system, the pin picker, and the diagnostics engine.

## 1. Board profile (canonical)

```ts
type BoardProfile = {
  id: 'arduino-uno';
  displayName: 'Arduino Uno';
  fqbn: 'arduino:avr:uno';

  digitalPins: PinId[];
  analogPins: PinId[];
  pwmPins: PinId[];

  reservedPins: { serial: PinId[] };

  capabilities: {
    supportsInputPullup: boolean;
    supportsTone: boolean;
    supportsServo: boolean;
  };

  timerNotes: TimerConflictRule[];
};
```

`PinId` = `'D0'..'D13' | 'A0'..'A5'` (plus `'GND'`, `'5V'` as wiring targets). Audit every board against real docs before it drives validation — **do not drop D4, D7, D8.**

## 2. Arduino Uno profile (audited)

```ts
const arduinoUno: BoardProfile = {
  id: 'arduino-uno',
  displayName: 'Arduino Uno',
  fqbn: 'arduino:avr:uno',
  digitalPins: ['D0','D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13'],
  analogPins: ['A0','A1','A2','A3','A4','A5'],
  pwmPins: ['D3','D5','D6','D9','D10','D11'],
  reservedPins: { serial: ['D0','D1'] },
  capabilities: { supportsInputPullup: true, supportsTone: true, supportsServo: true },
  timerNotes: [
    {
      id: 'servo-timer1-pwm-9-10',
      when: { usesServo: true, usesPwmPins: ['D9', 'D10'] },
      severity: 'warning',
      message: 'On Arduino Uno, Servo uses Timer1 and can interfere with PWM behavior on D9/D10.'
    },
    {
      id: 'tone-timer2-pwm-3-11',
      when: { usesTone: true, usesPwmPins: ['D3', 'D11'] },
      severity: 'warning',
      message: 'tone() can interfere with PWM behavior on D3/D11 on Arduino Uno.'
    }
  ]
};
```

**Servo does not require a PWM pin.** It uses timers; the real caveat is the Timer1/PWM conflict on D9/D10 above. Never emit a "servo needs PWM" error.

## 3. Dynamic hardware component system

Students add hardware visually, then use blocks that target it: add LED → pick D13 → LED appears in the simulator → LED blocks target it → generated code writes D13 → simulator lights it.

**Component library (MVP+):** LED (P0), Button (P0), Potentiometer (P0), Buzzer (P1), Servo (P1); RGB LED / Ultrasonic / Photoresistor (P2); DHT, LCD/OLED (future).

**Rule of three:** implement LED, Button, Potentiometer concretely first; extract shared interfaces only after seeing what actually repeats. Do not design a component marketplace before three real components work.

Component definition shape (clean, not over-abstracted):

```ts
type HardwareComponentDefinition = {
  type: ComponentType;
  displayName: string;
  description: string;
  category: 'output' | 'input' | 'sensor' | 'actuator';
  defaultConfig: Record<string, unknown>;
  pins: PinRequirement[];
  toolboxBlocks: (instance: ComponentInstance) => ToolboxBlockDefinition[];
  validate: (ctx: ValidationContext, instance: ComponentInstance) => Diagnostic[];
  renderSimulator: React.ComponentType<ComponentSimulatorProps>;
  lowerComponentBlockToIR?: (block, instance, ctx) => StatementIR | ExpressionIR; // codegen.md
};
```

`ComponentInstance` (the placed component) is defined canonically in `persistence.md` (it is part of the project document).

**Blocks target instances, not raw pins.** Beginner block `turn Red LED on` lowers using the instance's pin and config; see `codegen.md` for the `activeHigh`/`pullMode` rules.

## 4. Board-aware pin picker

The picker shows context per pin, not a bare dropdown:

```txt
D3  Digital, PWM, available
D5  Digital, PWM, used by Buzzer
D0  Serial RX, avoid for beginner projects
A0  Analog input, available
```

## 5. Errors vs warnings

| Condition | Severity |
|---|---|
| Two output components on same signal pin | Error |
| Input + output component on same pin | Error/warning (component-dependent) |
| LED and button both on D2 | Error |
| `analogRead` on D13 (non-analog) | Error |
| `analogWrite` on non-PWM pin | Warning, model real degenerate behavior |
| Servo on non-PWM digital pin | Allowed |
| Use D0/D1 for a beginner component | Warning |
| Missing GND for component | Error |
| Buzzer tone + PWM conflict | Warning |

**`analogWrite` on non-PWM pins:** do not reject. Warn, but model the real degenerate behavior in the simulator: `analogWrite(D4, 200)` behaves like HIGH, `analogWrite(D4, 50)` like LOW. Teach that PWM pins are preferred.

## 6. Diagnostics engine (canonical `Diagnostic`)

```ts
type Diagnostic = {
  id: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  fix?: { label: string; action: DiagnosticFixAction };
  source?: { blockId?: string; componentId?: string; pin?: PinId };
};
```

Required diagnostics:

| Diagnostic | Severity |
|---|---|
| Component missing required pin | Error |
| Two components drive same output pin | Error |
| Block writes pin with no component | Warning |
| Component pin and block target mismatch | Warning |
| analogRead on non-analog pin | Error |
| analogWrite on non-PWM pin | Warning |
| Use D0/D1 | Warning |
| Button block without button component | Warning |
| Servo uses D9/D10 PWM conflict | Warning |
| tone uses D3/D11 PWM conflict | Warning |
| Program has no loop | Info |
| Program has no observable output | Info |
| Infinite/tight loop | Warning |
| LocalStorage save failed | Error |
| Cloud save failed but local save succeeded | Warning |

**Pin/component binding — the key teachable moment.** If a block writes a pin with no connected component:

```txt
Warning: Your program writes to D13, but no visible component is connected to D13.
The Arduino will still set the pin, but nothing in the simulator will visibly change.
```

If a component is on D12 but the block targets D13:

```txt
Mismatch: Red LED is connected to D12, but your LED block controls D13.
Either change the LED pin to D13 or update the block target.
```

Diagnose the mismatch; do **not** silently auto-fix — the mistake is the lesson.

**Diagnostics UX:** show in the hardware panel, the block gutter/selected-block inspector, the code-preview gutter, and the Run button status. Never bury them in console logs. Offer quick fixes (e.g. "Move LED to D13", "Change block pin to D12", "Use A0").

---

**Cross-refs:** `ComponentInstance` → `persistence.md`. Component simulation behavior → `runtime.md`. Lowering that reads component config → `codegen.md`. Timer-conflict warnings are surfaced by the diagnostics engine using `timerNotes`.
