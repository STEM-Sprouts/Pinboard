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
];
