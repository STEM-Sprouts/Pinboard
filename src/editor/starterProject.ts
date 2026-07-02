/**
 * Default starter project: a Blink program on D13 with the hardware
 * pre-added (an LED on D13 and a Button on D2). Students never open onto
 * a blank canvas (implemenation_plam/lessons.md §3).
 */
import type { ComponentInstance } from '../persistence/projectDocument';
import type { BlocklyWorkspaceJson } from './lowerBlocklyToIR';

export const starterComponents: ComponentInstance[] = [
  {
    id: 'starter-led',
    type: 'led',
    displayName: 'LED 1',
    position: { x: 0, y: 0 },
    config: { color: 'red', activeHigh: true },
    pins: { signal: 'D13' },
  },
  {
    id: 'starter-button',
    type: 'button',
    displayName: 'Button 1',
    position: { x: 0, y: 0 },
    config: { pullMode: 'internal_pullup' },
    pins: { signal: 'D2' },
  },
];

export const starterWorkspaceJson: BlocklyWorkspaceJson = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'arduino_loop',
        id: 'starter_loop',
        x: 40,
        y: 40,
        inputs: {
          DO: {
            block: {
              type: 'set_pin',
              id: 'starter_on',
              fields: { PIN: 13, STATE: 'HIGH' },
              next: {
                block: {
                  type: 'delay_ms',
                  id: 'starter_wait_on',
                  fields: { DELAY: 500 },
                  next: {
                    block: {
                      type: 'set_pin',
                      id: 'starter_off',
                      fields: { PIN: 13, STATE: 'LOW' },
                      next: {
                        block: {
                          type: 'delay_ms',
                          id: 'starter_wait_off',
                          fields: { DELAY: 500 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
  },
};
