# Lesson 1 — Blink an LED

**Grade band:** middle/high (mixed) · **Time:** ~15 minutes
**You build:** an LED that blinks once per second.
**You learn:** outputs, `loop()`, and why timing needs `delay`.

## Before you start

Your project already has an **LED on pin D13**. Look at the hardware panel:
the LED card shows which pin it is connected to. Every block you run turns
into real Arduino code — watch the code preview at the bottom as you work.

## Steps

1. **Look at the starter blocks.** There is a `loop` block with four blocks
   inside: turn the pin on, wait, turn it off, wait. `loop` runs its blocks
   over and over, forever — that is exactly how a real Arduino works.
2. **Press Run.** The LED in the hardware panel blinks. In the code preview,
   find `digitalWrite(13, HIGH);` — that is the line your "on" block became.
3. **Make it blink faster.** Change both `delay` blocks from `500` to `100`
   and press Run again.
   - *Likely mistake:* changing only one delay. Then the LED is on longer
     than it is off (or the reverse). That asymmetry is real — try it on
     purpose and watch closely.
4. **Slow motion.** Set both delays to `2000`. Count along: on, two seconds,
   off, two seconds.

## What proves you did it

The LED visibly blinks, and you can point at the two lines of C code that
make it turn on and off.

## Why the wait blocks matter

Without `delay`, the Arduino switches the pin on and off millions of times
per second — far too fast for your eye. The LED would just look dimly "on".
`delay(500)` pauses the **whole program** for 500 ms. Nothing else happens
during a delay — remember that for Lesson 2.

## Try next (extension)

- Blink a pattern: short-short-long (like a heartbeat).
- Add a second LED on another pin and alternate them.
