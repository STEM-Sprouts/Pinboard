import type { BoardId, BoardProfile } from '../types';

/**
 * Audited Arduino Uno profile (implemenation_plam/hardware.md §2).
 * All of D0–D13 are present — do not drop D4, D7, D8.
 * Servo does not require a PWM pin; the real caveat is the Timer1/PWM
 * conflict captured in timerNotes.
 */
export const arduinoUno: BoardProfile = {
  id: 'arduino-uno',
  displayName: 'Arduino Uno',
  fqbn: 'arduino:avr:uno',
  digitalPins: ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13'],
  analogPins: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
  pwmPins: ['D3', 'D5', 'D6', 'D9', 'D10', 'D11'],
  reservedPins: { serial: ['D0', 'D1'] },
  capabilities: { supportsInputPullup: true, supportsTone: true, supportsServo: true },
  timerNotes: [
    {
      id: 'servo-timer1-pwm-9-10',
      when: { usesServo: true, usesPwmPins: ['D9', 'D10'] },
      severity: 'warning',
      message: 'On Arduino Uno, Servo uses Timer1 and can interfere with PWM behavior on D9/D10.',
    },
    {
      id: 'tone-timer2-pwm-3-11',
      when: { usesTone: true, usesPwmPins: ['D3', 'D11'] },
      severity: 'warning',
      message: 'tone() can interfere with PWM behavior on D3/D11 on Arduino Uno.',
    },
  ],
};

export function getBoardProfile(boardId: BoardId): BoardProfile {
  switch (boardId) {
    case 'arduino-uno':
      return arduinoUno;
  }
}
