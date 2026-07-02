/**
 * Default starter workspace: a Blink program on D13. Students never open
 * onto a blank canvas (implemenation_plam/lessons.md §3).
 */
import type { BlocklyWorkspaceJson } from './lowerBlocklyToIR';

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
