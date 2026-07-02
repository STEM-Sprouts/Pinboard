# Domain: Lessons (curriculum)

Curriculum is a **product dependency**, not decoration. The editor can be technically excellent and still fail if the lessons are weak or missing (a blank workspace kills beginner learning). **Assign a curriculum owner** before the lesson engine is built. Governs the "lessons define the IR" principle.

## 1. Content before engine

Write the first two lessons in plain text **before** building the lesson engine. The content shapes the schema, not the other way around. Add IR nodes / blocks only when a specific lesson needs them.

## 2. First lessons (MVP+: aim for four, ship two and workshop-test if short)

1. Blink LED
2. Change blink speed
3. Button controls LED
4. Potentiometer controls brightness

These cover output, timing, input, analog values, conditionals, and variables — a real ladder from nothing to a small project. (`blink-without-delay` and servo/buzzer lessons come with Phase 3.)

## 3. Lesson schema

```ts
type Lesson = {
  id: string;
  title: string;
  estimatedMinutes: number;
  targetGradeBand: 'middle' | 'high' | 'mixed';
  starterProject: PinboardProjectDocument;   // persistence.md — hardware pre-added, not a blank grid
  steps: LessonStep[];
  checks: LessonCheck[];
};

type LessonStep = {
  id: string;
  title: string;
  instructionsMarkdown: string;   // sanitized; raw HTML disabled
  hints: string[];
};
```

Every lesson opens onto a starter project (components already placed), never a blank canvas. Keep step text short; students learn by doing.

## 4. Lesson checks — inspect project state, not text

```ts
type LessonCheck =
  | { kind: 'hasComponent'; componentType: ComponentInstance['type'] }
  | { kind: 'componentOnPin'; componentType: string; pinRole: string; expectedPin: PinId }
  | { kind: 'hasInstruction'; statementKind: StatementIR['kind']; pin?: PinId }
  | { kind: 'serialIncludes'; text: string }
  | { kind: 'runtimePinToggles'; pin: PinId }
  | { kind: 'compilePasses' };
```

Example:
```ts
{
  id: 'led-on-d13',
  description: 'LED is connected to D13',
  check: { kind: 'componentOnPin', componentType: 'led', pinRole: 'signal', expectedPin: 'D13' }
}
```

Checks read the project document, IR, or runtime trace — never the generated text. This keeps checks robust to formatting and honest about behavior.

## 5. Delay honesty in lesson copy

Lessons carry the honest framing for blocking `delay()` (the runtime enforces the semantics — see `runtime.md` §8):

```txt
delay() pauses the whole Arduino program. During the pause, your program is not checking
the button. Later, you will learn millis(), which lets the program keep checking inputs
while time passes.
```

## 6. Content safety

Lesson markdown is sanitized: strip raw HTML, escape user-generated strings, apply a Content Security Policy, no arbitrary scripts/iframes/inline handlers.

## 7. Lesson quality bar

Every lesson answers: what does the student build? · what concept does it teach? · which component? · what mistake is likely? · what visual feedback proves success? · what can the student modify next (extension)?

---

**Cross-refs:** `PinboardProjectDocument`/`ComponentInstance` → `persistence.md`. `StatementIR` kinds → `codegen.md`. `PinId` → `hardware.md`. Check execution + lesson-completion storage → runtime/persistence.
