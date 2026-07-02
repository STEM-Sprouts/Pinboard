/**
 * Deterministic RNG (mulberry32). The interpreter's `random()` reads only
 * from this — never `Math.random()` — so runtime traces are reproducible
 * (implemenation_plam/runtime.md §8, CLAUDE.md determinism rule).
 */
export class SeededRandom {
  private state: number;
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [minInclusive, maxExclusive) — Arduino `random(min, max)` semantics. */
  nextInt(minInclusive: number, maxExclusive: number): number {
    const lo = Math.ceil(minInclusive);
    const hi = Math.floor(maxExclusive);
    if (hi <= lo) return lo;
    return lo + Math.floor(this.next() * (hi - lo));
  }

  reset(): void {
    this.state = this.seed;
  }
}
