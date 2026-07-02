# Lesson 3 — Change Blink Speed

**Builds:** the Blink program, but the student owns the timing.
**Teaches:** `delay()` controls rhythm; on-time and off-time are independent; one block can replace four.
**Component:** the starter LED on D13.
**Likely mistake:** changing only one of the two delays and thinking the program is broken — it isn't, the LED just spends longer on than off.
**Success looks like:** the LED visibly blinks at the new speed the student chose.
**Extension:** make an uneven heartbeat: 100 ms on, 900 ms off.

## Steps (plain text draft)

1. Run the starter program. Count the blinks for five seconds. Each delay is
   500 ms, so one full blink takes a second.
2. Change BOTH delay blocks to 100 and run again. The code preview shows
   `delay(100);` — the same number you typed.
3. Now change only the FIRST delay to 900 and run. The LED stays on much
   longer than it stays off. On-time and off-time are two different numbers,
   and now you control both.
4. Delete the four blocks and drag one "blink LED every 250 ms" block from
   Components into the loop. Look at the preview: it becomes the same four
   lines you just deleted. Blocks are shortcuts for code, never magic.

## Delay honesty (lessons.md §5)

delay() pauses the whole Arduino program. During the pause, your program is
not checking buttons or sensors. Later, you will learn millis(), which lets
the program keep checking inputs while time passes.
