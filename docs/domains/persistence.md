# Domain: Persistence (project document, local save, import/export)

Owns the **canonical types `PinboardProjectDocument` and `ComponentInstance`**, LocalStorage behavior, save/conflict/hash rules, and import/export/migration. Governs ADR-0002, ADR-0006. Cloud rows/RLS live in `supabase.md`.

## 1. Project document (canonical, source of truth on disk)

```ts
type PinboardProjectDocument = {
  schemaVersion: 1;
  appVersion: string;

  metadata: {
    id: string;
    title: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
    ownerDisplayName?: string;
  };

  board: {
    id: 'arduino-uno';
    fqbn: 'arduino:avr:uno';
  };

  workspace: {
    format: 'blockly-json';   // ADR-0002; XML only as one-way import migration
    data: unknown;            // Blockly JSON serialization
  };

  hardware: {
    components: ComponentInstance[];
    wiring: WiringConnection[];
  };

  lessons?: {
    lessonId?: string;
    completedChecks?: string[];
  };

  settings: {
    editorMode: 'beginner' | 'intermediate' | 'advanced';
    simulationSpeed: number;
    showAdvancedBlocks: boolean;
  };
};
```

```ts
type ComponentInstance = {
  id: string;
  type: 'led' | 'button' | 'potentiometer' | 'buzzer' | 'servo' | 'rgb-led' | 'ultrasonic';
  displayName: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;   // e.g. { activeHigh } for LED, { pullMode, pressedValue } for button
  pins: Record<string, PinId | null>; // e.g. { signal: 'D13', ground: 'GND' }
};
```

Example LED config: `{ color: 'red', resistorOhms: 220, activeHigh: true }`. Example button config: `{ pullMode: 'internal_pullup', pressedValue: 'LOW' }`. Generated code and IR are **derived** from this document, never stored as truth.

## 2. Editor mode is toolbox filtering only (invariant)

`settings.editorMode` controls **what blocks appear in the toolbox** and nothing else. It must never hide, delete, or fail to deserialize blocks already present in a saved workspace.

```txt
Beginner mode:     toolbox hides raw pinMode / low-level blocks; loaded workspace renders every saved block
Intermediate mode: toolbox exposes variables, millis, analog blocks; loaded workspace unchanged
Advanced mode:     toolbox exposes lower-level primitives; loaded workspace unchanged
```

Forbidden: open an intermediate project in beginner mode → advanced blocks disappear → save → project corrupted. The serializer is the source of truth; editor mode is a UI affordance only.

## 3. LocalStorage (primary, workshop-safe)

Stores the full `PinboardProjectDocument`. Keys:

```txt
pinboard:recent-project-ids
pinboard:project:<localId>
pinboard:last-opened-project-id
pinboard:user-preferences
```

**Autosave (debounced):**
```txt
Blockly change  → mark dirty → debounce ~750ms → serialize → save
Hardware change → mark dirty → debounce ~750ms → serialize → save
Settings change → save immediately
```

**Failure handling:** on a storage failure, show a non-blocking warning, offer `.pinboard.json` download, do not crash, do not silently discard work.

**Sync rule:** local save is authoritative until a cloud save succeeds. A failed Supabase write must never overwrite or clear local work.

## 4. Save states, cloud flow, conflict, hash

Save states: saved locally · saved to cloud · unsynced changes · sync error (local safe) · exported.

Cloud save flow (details in `supabase.md`): edit → local autosave → if signed in, debounce cloud save → validate with Zod → upsert row → store `updated_at`/hash.

Conflict (no auto-merge in MVP+): if cloud changed since the local copy, prompt "Keep my local copy / Use cloud copy / Save my local copy as duplicate."

**Project hash (skip no-op writes):** hash a **normalized** project document that **excludes volatile and derived fields** — timestamps (`updatedAt`, `generatedAt`), generated C, IR, source maps, caches. Hash only the semantic fields (board, workspace data, components, wiring, settings). Otherwise every autosave changes the hash and dedup does nothing.

## 5. Import / export

`.pinboard.json` is the durable, portable artifact — treat it as important as cloud save and promote it in the UI (it is the real backup for anonymous/local users).

**Never trust imported JSON.** Validate with Zod at the boundary, then migrate:

```ts
const parsed = PinboardProjectSchema.safeParse(rawJson);
if (!parsed.success) { showImportError(parsed.error); }
```

Migration always goes through a schema-versioned function that first asserts the value is an object and reads the version:

```ts
function migrateProject(doc: unknown): PinboardProjectDocument {
  const object = assertObject(doc);
  const version = readSchemaVersion(object);
  switch (version) {
    case 1:  return PinboardProjectSchema.parse(object);
    default: throw new Error(`Unsupported project version: ${version}`);
  }
}
```

A malformed import must fail safely with a user-facing error and leave the editor usable.

## 6. What is truth vs cache

- **Truth:** the project document (blocks, components, wiring, board, settings, lesson progress).
- **Cache (regenerable, excluded from hash):** generated Arduino C, IR, source maps, simulator state.

Simulator state is ephemeral — reset it on load; never persist it as truth.

---

**Cross-refs:** `PinId` → `hardware.md`. Cloud tables/RLS/anon caution → `supabase.md`. IR/generated-C are produced by `codegen.md`. Zod schemas live in `src/persistence/schemas.ts`.
