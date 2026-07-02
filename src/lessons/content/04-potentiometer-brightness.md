# Lesson 4 — Potentiometer Controls Brightness

**Builds:** a dimmer: turning the knob changes the LED's brightness.
**Teaches:** analog input (0–1023), PWM output (0–255), and `map()` as the bridge between two ranges.
**Components:** Potentiometer on A0, LED moved to D9 (a PWM pin).
**Likely mistake:** leaving the LED on D13 — it is not a PWM pin, so brightness degenerates to on/off. The diagnostic explains it; the pin picker shows which pins say "PWM".
**Success looks like:** dragging the pot slider smoothly dims and brightens the LED.
**Extension:** print the knob value to serial and watch numbers move as you turn it.

## Steps (plain text draft)

1. In the hardware panel, add a Potentiometer and connect it to A0. Analog
   pins measure a range, not just on/off — the knob reads 0 to 1023.
2. Move the LED from D13 to D9. Watch the pin picker: D9 says "PWM". Only
   PWM pins can fake in-between voltages by switching very fast. (Leave the
   LED on D13 on purpose first if you want to see the warning that explains
   this.)
3. Clear the loop. From Components drag "set LED brightness to" into the
   loop, and drop "map POT to 0 – 255" into its slot.
4. Read the preview: `analogWrite(9, map(analogRead(A0), 0, 1023, 0, 255));`
   One line of C — read the knob, rescale it, write the brightness.
5. Run, then drag the potentiometer slider. The LED dims and brightens with
   the knob.
