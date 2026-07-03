/**
 * Zod boundary validation (implemenation_plam/persistence.md §5).
 * Never trust imported JSON: shape-validate here; pin-validity and wiring
 * correctness are diagnostics concerns, not parse failures, so pins are
 * validated as strings — a wrong pin should warn in the editor, not nuke
 * the whole import.
 */
import { z } from 'zod';

const componentInstanceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['led', 'button', 'potentiometer', 'buzzer', 'servo', 'rgb-led', 'ultrasonic']),
  displayName: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.string(), z.unknown()),
  pins: z.record(z.string(), z.string().nullable()),
});

const wiringConnectionSchema = z.object({
  id: z.string().min(1),
  componentId: z.string().min(1),
  pinRole: z.string().min(1),
  boardPin: z.string(),
});

export const PinboardProjectSchema = z.object({
  schemaVersion: z.literal(1),
  appVersion: z.string(),
  metadata: z.object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    ownerDisplayName: z.string().optional(),
    cloudProjectId: z.string().optional(),
  }),
  board: z.object({
    id: z.literal('arduino-uno'),
    fqbn: z.literal('arduino:avr:uno'),
  }),
  workspace: z.object({
    format: z.literal('blockly-json'),
    data: z.unknown(),
  }),
  hardware: z.object({
    components: z.array(componentInstanceSchema),
    wiring: z.array(wiringConnectionSchema),
  }),
  lessons: z
    .object({
      lessonId: z.string().optional(),
      completedChecks: z.array(z.string()).optional(),
    })
    .optional(),
  settings: z.object({
    editorMode: z.enum(['beginner', 'intermediate', 'advanced']),
    simulationSpeed: z.number(),
    showAdvancedBlocks: z.boolean(),
  }),
});
