# Lesson 6 — Servo Sweep

**Builds:** a servo arm that sweeps 0° → 180° and repeats.
**Teaches:** counting loops (`for`), using the loop variable as a value, servo angles.
**Component:** Servo on D9.
**Likely mistake:** no wait inside the loop — the sweep finishes faster than the eye (or a real servo) can follow.
**Success looks like:** the arm in the panel steps smoothly across its range.
**Extension:** sweep back down (180 → 0 by -30, or a second for-loop).

## Steps (plain text draft)

1. Add a Servo in the hardware panel. It defaults to D9. Servos don't need a
   PWM pin — they get told an angle, not a brightness.
2. Switch to Intermediate mode and find "for … from … to … by" in Control.
3. Build: for `angle` from 0 to 180 by 30 → set Servo 1 angle to `angle`,
   wait 200 ms.
4. Read the preview: `#include <Servo.h>` and `servo1.attach(9)` appeared in
   setup() by themselves — the code a servo always needs, written for you.
5. Run. The arm steps 0, 30, 60 … 180, then starts over, because loop()
   runs the whole for-loop again.
