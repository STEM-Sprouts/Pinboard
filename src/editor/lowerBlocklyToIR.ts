/**
 * Blocks → IR lowering (implemenation_plam/codegen.md §6, ADR-0003).
 *
 * A pure function over the Blockly JSON serialization (never the live
 * workspace), so it runs headless and is trivially testable. The C printer
 * and the simulator both consume the ProgramIR this produces — one meaning
 * per program, no drift.
 *
 * Covers the current (v1) block set. `read_pin` implies INPUT_PULLUP —
 * matching the previous generator and real beginner wiring — so an
 * unpressed button reads HIGH and pressing it drives LOW. That is honest
 * Arduino behavior and is the teachable moment lessons build on.
 */
import type { Diagnostic, PinId } from '../hardware/types';
import type { ExpressionIR, ProgramIR, StatementIR } from '../ir/types';

export type BlocklyBlockJson = {
  type: string;
  id?: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlocklyBlockJson; shadow?: BlocklyBlockJson }>;
  next?: { block?: BlocklyBlockJson };
  x?: number;
  y?: number;
};

export type BlocklyWorkspaceJson = {
  blocks?: { languageVersion?: number; blocks?: BlocklyBlockJson[] };
  variables?: unknown[];
};

export type LowerResult = {
  program: ProgramIR;
  diagnostics: Diagnostic[];
};

type Ctx = {
  diagnostics: Diagnostic[];
  /** Pins read via read_pin — lowered to inferred INPUT_PULLUP in setup(). */
  pullupPins: Set<PinId>;
};

function numField(block: BlocklyBlockJson, name: string, fallback: number): number {
  const value = block.fields?.[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function strField(block: BlocklyBlockJson, name: string, fallback: string): string {
  const value = block.fields?.[name];
  return typeof value === 'string' ? value : fallback;
}

function digitalPin(raw: number, ctx: Ctx, blockId?: string): PinId {
  const clamped = Math.min(13, Math.max(0, Math.trunc(raw)));
  if (clamped !== raw) {
    ctx.diagnostics.push({
      id: `pin-out-of-range:${blockId ?? 'unknown'}`,
      severity: 'warning',
      title: 'Pin out of range',
      message: `Pin ${raw} is not a digital pin on the Arduino Uno; using D${clamped} instead.`,
      source: { blockId },
    });
  }
  return `D${clamped}` as PinId;
}

function inputBlock(block: BlocklyBlockJson, name: string): BlocklyBlockJson | undefined {
  const input = block.inputs?.[name];
  return input?.block ?? input?.shadow;
}

function lowerValue(block: BlocklyBlockJson | undefined, fallback: ExpressionIR, ctx: Ctx): ExpressionIR {
  if (!block) return fallback;
  switch (block.type) {
    case 'read_pin': {
      const pin = digitalPin(numField(block, 'PIN', 2), ctx, block.id);
      ctx.pullupPins.add(pin);
      return { kind: 'read', op: 'digital', pin };
    }
    case 'string_text':
      return { kind: 'string', value: strField(block, 'TEXT', '') };
    default:
      ctx.diagnostics.push({
        id: `unsupported-value-block:${block.type}`,
        severity: 'warning',
        title: 'Unsupported block',
        message: `The block "${block.type}" is not supported yet and was ignored.`,
        source: { blockId: block.id },
      });
      return fallback;
  }
}

function lowerStatement(block: BlocklyBlockJson, ctx: Ctx): StatementIR[] {
  switch (block.type) {
    case 'set_pin': {
      const pin = digitalPin(numField(block, 'PIN', 13), ctx, block.id);
      const high = strField(block, 'STATE', 'HIGH') === 'HIGH';
      return [{ kind: 'digitalWrite', pin, value: { kind: 'bool', value: high } }];
    }
    case 'delay_ms':
      return [{ kind: 'delay', ms: { kind: 'num', value: Math.max(0, numField(block, 'DELAY', 0)) } }];
    case 'repeat_times':
      return [
        {
          kind: 'repeat',
          times: { kind: 'num', value: Math.max(0, Math.trunc(numField(block, 'TIMES', 0))) },
          body: lowerChain(inputBlock(block, 'DO'), ctx),
        },
      ];
    case 'if_do':
      return [
        {
          kind: 'if',
          condition: lowerValue(inputBlock(block, 'CONDITION'), { kind: 'bool', value: false }, ctx),
          then: lowerChain(inputBlock(block, 'DO'), ctx),
        },
      ];
    case 'serial_print':
      return [
        {
          kind: 'serialPrint',
          value: lowerValue(inputBlock(block, 'VALUE'), { kind: 'string', value: '' }, ctx),
          newline: true,
        },
      ];
    default:
      ctx.diagnostics.push({
        id: `unsupported-statement-block:${block.type}`,
        severity: 'warning',
        title: 'Unsupported block',
        message: `The block "${block.type}" is not supported yet and was skipped.`,
        source: { blockId: block.id },
      });
      return [];
  }
}

function lowerChain(first: BlocklyBlockJson | undefined, ctx: Ctx): StatementIR[] {
  const statements: StatementIR[] = [];
  for (let block = first; block; block = block.next?.block) {
    statements.push(...lowerStatement(block, ctx));
  }
  return statements;
}

export function lowerWorkspaceToIR(json: BlocklyWorkspaceJson): LowerResult {
  const ctx: Ctx = { diagnostics: [], pullupPins: new Set() };
  const setup: StatementIR[] = [];
  const loop: StatementIR[] = [];

  for (const top of json.blocks?.blocks ?? []) {
    if (top.type === 'arduino_setup') {
      setup.push(...lowerChain(inputBlock(top, 'DO'), ctx));
    } else if (top.type === 'arduino_loop') {
      loop.push(...lowerChain(inputBlock(top, 'DO'), ctx));
    } else {
      // v1 behavior: orphan top-level statement blocks run in loop().
      const orphaned = lowerChain(top, ctx);
      if (orphaned.length > 0) {
        loop.push(...orphaned);
        ctx.diagnostics.push({
          id: `orphan-top-block:${top.id ?? top.type}`,
          severity: 'info',
          title: 'Block outside setup/loop',
          message: `"${top.type}" is not inside a setup or loop block; it will run in loop().`,
          source: { blockId: top.id },
        });
      }
    }
  }

  const pullupModes: StatementIR[] = [...ctx.pullupPins]
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    .map((pin) => ({ kind: 'pinMode', pin, mode: 'INPUT_PULLUP', explicit: false }));

  return {
    program: {
      schemaVersion: 1,
      boardId: 'arduino-uno',
      includes: [],
      globals: [],
      setup: [...pullupModes, ...setup],
      loop,
      // Fixed metadata: the printer must stay a deterministic function of
      // the workspace content (generated C is cache, not truth).
      metadata: {
        sourceProjectHash: 'workspace',
        generatedAt: '1970-01-01T00:00:00.000Z',
        generatorVersion: '0.1.0-phase1',
      },
    },
    diagnostics: ctx.diagnostics,
  };
}
