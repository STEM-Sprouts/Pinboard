/**
 * Browser wiring for the scheduler (implemenation_plam/runtime.md §2).
 * This is the ONLY place browser time sources are touched — the interpreter
 * and scheduler consume them solely through the injected deps (ADR-0005).
 */
import type { RuntimeSchedulerDeps } from './types';

export function createBrowserSchedulerDeps(): RuntimeSchedulerDeps {
  return {
    clockSource: { nowMs: () => performance.now() },
    frameScheduler: {
      nextFrame: () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => resolve());
        }),
    },
  };
}
