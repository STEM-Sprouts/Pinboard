# Lesson 2 — Button Controls LED

**Grade band:** middle/high (mixed) · **Time:** ~20 minutes
**You build:** an LED that lights while a button is held down.
**You learn:** inputs, `if`, and the pull-up surprise.

## Before you start

Your project has an **LED on D13** and a **Button on D2**. The button card in
the hardware panel says: *Internal pull-up: pressed reads LOW.* Keep that in
mind — it is the twist in this lesson.

## Steps

1. **Clear the loop.** Remove the blink blocks from `loop` (drag them to the
   trash), keeping the `loop` block itself.
2. **Ask a question.** From **Logic**, drag an `if ... do` block into `loop`.
3. **Use the button.** From **Components**, put `Button 1 is pressed?` into
   the `if` slot, and `turn LED 1 on` into the `do` slot.
4. **Add a small wait.** Put a `delay 20 ms` block after the `if` block
   (still inside `loop`). Real programs check the button many times per
   second; a short delay keeps the checking calm.
5. **Press Run, then hold the virtual button.** The LED lights while you
   hold it… but it never turns off again!
   - *This is the likely mistake, and it is the lesson:* you told the
     program when to turn the LED **on**, but never when to turn it **off**.
6. **Fix it.** Add a second `if` that turns the LED off when the button is
   **not** pressed — or ask: what single change would make the LED copy the
   button exactly?

## The pull-up surprise (read the generated code)

Find this line in the code preview:

```cpp
if (digitalRead(2) == LOW) {
```

Pressed reads **LOW**?! Yes — with the Arduino's internal pull-up resistor,
the wire idles at HIGH and pressing the button connects it to ground. Most
beginner wiring works this way. The `is pressed?` block hides this for you,
but the C code tells the truth.

## What proves you did it

The LED copies the button: lit while held, dark when released — and you can
explain why the C code compares against `LOW`.

## Why delay() will bite you later

Try setting the delay to `2000`. Now the button feels broken — presses get
missed. `delay()` pauses the whole program, so during those 2 seconds the
Arduino is not checking the button at all. Later you will learn `millis()`,
which lets a program keep checking inputs while time passes.

## Try next (extension)

- Make the button **toggle** the LED (press once on, press again off).
  Hint: you will need a variable — and you will discover why "was it just
  pressed?" is trickier than "is it pressed?".
