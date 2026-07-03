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
        locate: 'loop',
      },
      {
        id: 'run',
        title: 'Press Run',
        instructions:
          'The LED in the hardware panel blinks. In the code preview, find digitalWrite(13, HIGH); — that is the line your "on" block became.',
        hints: ['If nothing blinks, check that the LED is connected to pin D13 in the hardware panel.'],
        locate: 'set pin 13 to HIGH',
      },
      {
        id: 'faster',
        title: 'Make it blink faster',
        instructions: 'Change both delay blocks from 500 to 100 and press Run again.',
        hints: [
          'Changing only one delay makes the LED stay on longer than off — try it on purpose and watch closely.',
        ],
        locate: 'delay',
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
        locate: 'delay',
      },
      {
        id: 'both',
        title: 'Change both delays',
        instructions: 'Change BOTH delay blocks to 100 and run again. The preview shows delay(100); — the number you typed.',
        hints: ['delay() pauses the whole program — while it waits, nothing else happens.'],
        locate: 'delay',
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
        locate: 'blink',
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
        locate: 'loop',
      },
      {
        id: 'ask',
        title: 'Ask a question',
        instructions:
          'From Logic, drag an "if … do" block into loop. From Components, put "Button 1 is pressed?" into the if slot and "turn LED 1 on" into the do slot.',
        hints: ['Add a "delay 20 ms" block after the if — real programs check the button many times per second.'],
        locate: 'if',
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
        locate: 'potentiometer',
      },
      {
        id: 'pwm-pin',
        title: 'Move the LED to a PWM pin',
        instructions:
          'Move the LED from D13 to D9. The pin picker marks D9 as PWM — only PWM pins can fake in-between voltages by switching very fast.',
        hints: [
          'Leave the LED on D13 on purpose first and read the warning — D13 cannot do brightness, only on/off.',
        ],
        locate: 'turn LED 1 on',
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
  {
    id: 'blink-without-delay',
    title: 'Blink Without Delay',
    estimatedMinutes: 30,
    targetGradeBand: 'mixed',
    steps: [
      {
        id: 'freeze',
        title: 'Feel the freeze',
        instructions:
          'Run the starter blink and hold the virtual button. Nothing can respond — during delay(500) the Arduino is frozen, on purpose. This lesson fixes that.',
        hints: [],
        locate: 'delay',
      },
      {
        id: 'level-up',
        title: 'Switch to Intermediate',
        instructions:
          'Change the editor mode (top left) to Intermediate. Variables and Time categories appear — the blocks were always real Arduino, you just earned more of them.',
        hints: [],
      },
      {
        id: 'memory',
        title: 'Give the program memory',
        instructions: 'Create two variables: lastFlip and ledOn. They live above setup() as globals — check the preview.',
        hints: ['Variables keep their value between loop() passes because they are globals.'],
        locate: 'variables',
      },
      {
        id: 'clockwatch',
        title: 'Watch the clock instead of sleeping',
        instructions:
          'Clear the loop and build: if millis() - lastFlip ≥ 500 do → set lastFlip to millis(); if ledOn = 0 do turn LED on, set ledOn to 1, else turn LED off, set ledOn to 0.',
        hints: [
          'Forgot to set lastFlip inside the if? The condition stays true and the LED flickers every pass — watch for it.',
        ],
        locate: 'millis',
      },
      {
        id: 'prove',
        title: 'Prove there is no delay',
        instructions: 'Read the preview: no delay() anywhere. Run — the LED still blinks, because loop() checks the clock thousands of times a second.',
        hints: ['Extension: two LEDs at different speeds — impossible with delay(), easy with millis().'],
      },
    ],
    checks: [
      {
        id: 'led-on-d13',
        description: 'The LED is connected to D13',
        check: { kind: 'componentOnPin', componentType: 'led', pinRole: 'signal', expectedPin: 'D13' },
      },
      {
        id: 'no-delay',
        description: 'Your program never uses delay()',
        check: { kind: 'lacksInstruction', statementKind: 'delay' },
      },
      {
        id: 'still-blinks',
        description: 'The LED really blinks anyway',
        check: { kind: 'runtimePinToggles', pin: 'D13' },
      },
    ],
  },
  {
    id: 'servo-sweep',
    title: 'Servo Sweep',
    estimatedMinutes: 20,
    targetGradeBand: 'mixed',
    steps: [
      {
        id: 'add-servo',
        title: 'Add a servo',
        instructions:
          'Add a Servo in the hardware panel — it defaults to D9. Servos are told an angle, not a brightness, so they do not need a PWM pin.',
        hints: [],
        locate: 'servo',
      },
      {
        id: 'for-loop',
        title: 'Count with a for-loop',
        instructions:
          'Switch to Intermediate mode. From Control, build: for angle from 0 to 180 by 30 → set Servo 1 angle to angle, wait 200 ms.',
        hints: ['No wait inside the loop? The sweep finishes faster than the eye can follow.'],
        locate: 'for',
      },
      {
        id: 'free-code',
        title: 'Find the code you did not write',
        instructions:
          'Read the preview: #include <Servo.h> and servo1.attach(9) appeared in setup() by themselves — the code a servo always needs.',
        hints: [],
        locate: 'servo',
      },
      {
        id: 'run',
        title: 'Run the sweep',
        instructions: 'Run. The arm steps 0, 30, 60 … 180, then repeats because loop() runs the for-loop again.',
        hints: ['Extension: sweep back down with a second for-loop from 180 to 0 by -30.'],
        locate: 'for',
      },
    ],
    checks: [
      {
        id: 'servo-exists',
        description: 'A Servo is in the hardware panel',
        check: { kind: 'hasComponent', componentType: 'servo' },
      },
      {
        id: 'servo-on-d9',
        description: 'The Servo is connected to D9',
        check: { kind: 'componentOnPin', componentType: 'servo', pinRole: 'signal', expectedPin: 'D9' },
      },
      {
        id: 'uses-for',
        description: 'Your program counts with a for-loop',
        check: { kind: 'hasInstruction', statementKind: 'forRange' },
      },
      {
        id: 'really-sweeps',
        description: 'The arm really sweeps through angles',
        check: { kind: 'runtimeServoMoves', pin: 'D9' },
      },
    ],
  },
  {
    id: 'buzzer-alarm',
    title: 'Buzzer Alarm',
    estimatedMinutes: 15,
    targetGradeBand: 'mixed',
    steps: [
      {
        id: 'add-buzzer',
        title: 'Add a buzzer',
        instructions:
          'Add a Buzzer — it defaults to D8, away from pins where tone() can fight the PWM timer (D3/D11 — move it there later and read the warning).',
        hints: [],
        locate: 'buzzer',
      },
      {
        id: 'siren',
        title: 'Build the siren',
        instructions: 'In loop: play Buzzer 1 at 880 Hz → wait 300 ms → play at 440 Hz → wait 300 ms.',
        hints: ['A tone with no wait after it gets replaced instantly — you would hear only the last one.'],
        locate: 'tone',
      },
      {
        id: 'sound-is-state',
        title: 'Sound keeps going by itself',
        instructions:
          'Read the preview: tone(8, 880); keeps sounding until you change or stop it. The waits set the rhythm, not the sound.',
        hints: ['Add "stop Buzzer 1" and a wait to put silence in the pattern.'],
        locate: 'tone',
      },
    ],
    checks: [
      {
        id: 'buzzer-exists',
        description: 'A Buzzer is in the hardware panel',
        check: { kind: 'hasComponent', componentType: 'buzzer' },
      },
      {
        id: 'buzzer-on-d8',
        description: 'The Buzzer is connected to D8',
        check: { kind: 'componentOnPin', componentType: 'buzzer', pinRole: 'signal', expectedPin: 'D8' },
      },
      {
        id: 'uses-tone',
        description: 'Your program plays a tone',
        check: { kind: 'hasInstruction', statementKind: 'tone' },
      },
      {
        id: 'really-sounds',
        description: 'A tone really sounds when the program runs',
        check: { kind: 'runtimeTonePlays', pin: 'D8' },
      },
    ],
  },
];
