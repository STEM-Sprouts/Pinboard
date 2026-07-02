# Lesson 5 — Blink Without Delay

**Builds:** a blink that never uses `delay()` — the program stays awake.
**Teaches:** why `delay()` is a problem, `millis()` as a clock, variables as memory.
**Component:** the starter LED on D13 (plus the button to prove responsiveness).
**Likely mistake:** forgetting to update `lastFlip`, so the condition stays true and the LED flickers every pass.
**Success looks like:** the LED blinks steadily *and* the program could react to a button at any moment.
**Extension:** two LEDs blinking at different speeds — impossible with `delay()`, easy with `millis()`.

## Steps (plain text draft)

1. Run the starter blink and hold the virtual button. Nothing can respond —
   during `delay(500)` the Arduino is frozen, on purpose. That is the problem
   this lesson fixes.
2. Switch the editor mode to Intermediate (top left). New categories appear:
   Variables and Time. The blocks were always real Arduino — you just earned
   more of them.
3. Make two variables: `lastFlip` and `ledOn`. Variables are the program's
   memory; they live above setup() in the code as globals.
4. Clear the loop and build: if `millis() - lastFlip >= 500` do → set
   `lastFlip` to `millis()`; if `ledOn == 0` do turn LED on, set `ledOn` to 1,
   else turn LED off, set `ledOn` to 0.
5. Read the preview: no `delay()` anywhere. Run it — the LED still blinks,
   because the loop checks the clock thousands of times a second and acts
   only when 500 ms have passed.
