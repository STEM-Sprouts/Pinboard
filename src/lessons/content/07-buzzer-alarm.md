# Lesson 7 — Buzzer Alarm

**Builds:** a two-tone alarm siren.
**Teaches:** `tone()` keeps sounding until stopped; sound is a wave with a frequency.
**Component:** Buzzer on D8.
**Likely mistake:** playing a tone with no wait after it — the next block changes it instantly and you hear only the last one.
**Success looks like:** the panel shows the buzzer alternating between two frequencies.
**Extension:** trigger the alarm only while the button is held (combine with Lesson 2's if).

## Steps (plain text draft)

1. Add a Buzzer. It defaults to D8, away from pins where `tone()` can fight
   the PWM timer (D3/D11 — try moving it there later and read the warning).
2. Build in loop: play Buzzer 1 at 880 Hz → wait 300 ms → play at 440 Hz →
   wait 300 ms.
3. Read the preview: `tone(8, 880);` — the tone keeps sounding on its own
   until you change or stop it. The waits set the rhythm, not the sound.
4. Run. The buzzer card alternates 880 Hz / 440 Hz. Add "stop Buzzer 1" and
   a wait to put silence in the pattern.
