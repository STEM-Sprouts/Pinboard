/**
 * The first lessons (implemenation_plam/lessons.md §2), distilled from the
 * plain-text drafts in src/lessons/content/ — content shaped this schema,
 * not the other way around. The default starter project already satisfies
 * Lesson 1's hardware, so a beginner starts inside the lesson, not before it.
 */
import type { Lesson } from './lessonTypes';

export const lessons: Lesson[] = [
  {
    id: 'blink-led',
    title: 'Blink an LED',
    estimatedMinutes: 15,
    targetGradeBand: 'mixed',
    steps: [
      {
        id: 'look',
        title: 'Read the starter blocks',
        instructions:
          'The loop block runs its blocks over and over, forever — exactly like a real Arduino. Find the four blocks inside: on, wait, off, wait.',
        hints: ['The code preview at the bottom shows the real Arduino C your blocks become.'],
      },
      {
        id: 'run',
        title: 'Press Run',
        instructions:
          'The LED in the hardware panel blinks. In the code preview, find digitalWrite(13, HIGH); — that is the line your "on" block became.',
        hints: ['If nothing blinks, check that the LED is connected to pin D13 in the hardware panel.'],
      },
      {
        id: 'faster',
        title: 'Make it blink faster',
        instructions: 'Change both delay blocks from 500 to 100 and press Run again.',
        hints: [
          'Changing only one delay makes the LED stay on longer than off — try it on purpose and watch closely.',
        ],
      },
    ],
    checks: [
      {
        id: 'led-exists',
        description: 'An LED is in the hardware panel',
        check: { kind: 'hasComponent', componentType: 'led' },
      },
      {
        id: 'led-on-d13',
        description: 'The LED is connected to D13',
        check: { kind: 'componentOnPin', componentType: 'led', pinRole: 'signal', expectedPin: 'D13' },
      },
      {
        id: 'writes-d13',
        description: 'Your program sets pin 13',
        check: { kind: 'hasInstruction', statementKind: 'digitalWrite', pin: 'D13' },
      },
      {
        id: 'uses-delay',
        description: 'Your program waits between changes',
        check: { kind: 'hasInstruction', statementKind: 'delay' },
      },
      {
        id: 'really-blinks',
        description: 'The LED really blinks when the program runs',
        check: { kind: 'runtimePinToggles', pin: 'D13' },
      },
    ],
  },
  {
    id: 'change-blink-speed',
    title: 'Change Blink Speed',
    estimatedMinutes: 10,
    targetGradeBand: 'mixed',
    steps: [
      {
        id: 'count',
        title: 'Count the blinks',
        instructions:
          'Run the starter program and count blinks for five seconds. Each delay is 500 ms, so one full blink takes a second.',
        hints: [],
      },
      {
        id: 'both',
        title: 'Change both delays',
        instructions: 'Change BOTH delay blocks to 100 and run again. The preview shows delay(100); — the number you typed.',
        hints: ['delay() pauses the whole program — while it waits, nothing else happens.'],
      },
      {
        id: 'uneven',
        title: 'Make it uneven',
        instructions:
          'Change only the FIRST delay to 900 and run. The LED stays on much longer than it stays off — on-time and off-time are two different numbers.',
        hints: ['Try a heartbeat: 100 ms on, 900 ms off.'],
      },
      {
        id: 'shortcut',
        title: 'One block instead of four',
        instructions:
          'Delete the four blocks and drag one "blink LED every 250 ms" block from Components into the loop. The preview becomes the same four lines you deleted.',
        hints: ['Blocks are shortcuts for code, never magic — the C is always the truth.'],
      },
    ],
    checks: [
      {
        id: 'led-on-d13',
        description: 'The LED is connected to D13',
        check: { kind: 'componentOnPin', componentType: 'led', pinRole: 'signal', expectedPin: 'D13' },
      },
      {
        id: 'uses-delay',
        description: 'Your program waits between changes',
        check: { kind: 'hasInstruction', statementKind: 'delay' },
      },
      {
        id: 'really-blinks',
        description: 'The LED really blinks when the program runs',
        check: { kind: 'runtimePinToggles', pin: 'D13' },
      },
    ],
  },
  {
    id: 'button-controls-led',
    title: 'Button Controls LED',
    estimatedMinutes: 20,
    targetGradeBand: 'mixed',
    steps: [
      {
        id: 'clear',
        title: 'Clear the loop',
        instructions: 'Remove the blink blocks from loop (drag them to the trash), keeping the loop block itself.',
        hints: [],
      },
      {
        id: 'ask',
        title: 'Ask a question',
        instructions:
          'From Logic, drag an "if … do" block into loop. From Components, put "Button 1 is pressed?" into the if slot and "turn LED 1 on" into the do slot.',
        hints: ['Add a "delay 20 ms" block after the if — real programs check the button many times per second.'],
      },
      {
        id: 'surprise',
        title: 'Find the surprise',
        instructions:
          'Run it and hold the virtual button. The LED lights — but it never turns off again! You told the program when to turn the LED on, but never when to turn it off. Fix it with a second if.',
        hints: [
          'Look at the code preview: if (digitalRead(2) == LOW). Pressed reads LOW — that is the internal pull-up resistor at work.',
        ],
      },
    ],
    checks: [
      {
        id: 'button-exists',
        description: 'A Button is in the hardware panel',
        check: { kind: 'hasComponent', componentType: 'button' },
      },
      {
        id: 'button-on-d2',
        description: 'The Button is connected to D2',
        check: { kind: 'componentOnPin', componentType: 'button', pinRole: 'signal', expectedPin: 'D2' },
      },
      {
        id: 'uses-if',
        description: 'Your program makes a decision with "if"',
        check: { kind: 'hasInstruction', statementKind: 'if' },
      },
      {
        id: 'controls-led',
        description: 'Your program controls pin 13',
        check: { kind: 'hasInstruction', statementKind: 'digitalWrite', pin: 'D13' },
      },
    ],
  },
  {
    id: 'potentiometer-brightness',
    title: 'Potentiometer Controls Brightness',
    estimatedMinutes: 25,
    targetGradeBand: 'mixed',
    steps: [
      {
        id: 'add-pot',
        title: 'Add a potentiometer',
        instructions:
          'In the hardware panel, add a Potentiometer and connect it to A0. Analog pins measure a range — the knob reads 0 to 1023.',
        hints: [],
      },
      {
        id: 'pwm-pin',
        title: 'Move the LED to a PWM pin',
        instructions:
          'Move the LED from D13 to D9. The pin picker marks D9 as PWM — only PWM pins can fake in-between voltages by switching very fast.',
        hints: [
          'Leave the LED on D13 on purpose first and read the warning — D13 cannot do brightness, only on/off.',
        ],
      },
      {
        id: 'wire-blocks',
        title: 'Map knob to brightness',
        instructions:
          'Clear the loop. Drag "set LED brightness to" into the loop and drop "map POT to 0 – 255" into its slot.',
        hints: ['The preview shows one line: analogWrite(9, map(analogRead(A0), 0, 1023, 0, 255));'],
      },
      {
        id: 'turn',
        title: 'Turn the knob',
        instructions: 'Run, then drag the potentiometer slider. The LED dims and brightens with the knob.',
        hints: ['Print the knob value to serial and watch the numbers move as you turn it.'],
      },
    ],
    checks: [
      {
        id: 'pot-exists',
        description: 'A Potentiometer is in the hardware panel',
        check: { kind: 'hasComponent', componentType: 'potentiometer' },
      },
      {
        id: 'pot-on-a0',
        description: 'The Potentiometer is connected to A0',
        check: { kind: 'componentOnPin', componentType: 'potentiometer', pinRole: 'signal', expectedPin: 'A0' },
      },
      {
        id: 'led-on-d9',
        description: 'The LED is connected to PWM pin D9',
        check: { kind: 'componentOnPin', componentType: 'led', pinRole: 'signal', expectedPin: 'D9' },
      },
      {
        id: 'writes-brightness',
        description: 'Your program writes a brightness to D9',
        check: { kind: 'hasInstruction', statementKind: 'analogWrite', pin: 'D9' },
      },
      {
        id: 'really-dims',
        description: 'The program really writes PWM when it runs',
        check: { kind: 'runtimePinWritesPwm', pin: 'D9' },
      },
    ],
  },
];
