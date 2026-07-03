/**
 * End-to-end stress tests for the Pinboard app: shell, Blockly workspace,
 * emulator lifecycle (Run/Stop/Reset), component system, rapid-cycling
 * stress, reload recovery, persistence, and virtual hardware interaction.
 *
 * Rules (implemenation_plam/testing.md §4): assert on observable state via
 * stable test ids, never sleep-and-hope. Any uncaught page error fails the
 * test that produced it.
 */
import { expect, test, type Page } from '@playwright/test';

const pageErrors: Error[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors.length = 0;
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.goto('/');
  // The app is ready when the header and the Blockly canvas are both up.
  await expect(page.getByRole('heading', { name: 'Pinboard' })).toBeVisible();
  await expect(page.locator('.blocklySvg')).toBeVisible();
});

test.afterEach(() => {
  expect(pageErrors, `Uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`).toEqual([]);
});

const status = (page: Page) => page.getByTestId('emulator-status');
const runButton = (page: Page) => page.getByRole('button', { name: 'Run' });
const stopButton = (page: Page) => page.getByRole('button', { name: 'Stop' });
const resetButton = (page: Page) => page.getByTitle('Reset simulation');
const led13 = (page: Page) => page.getByTestId('led-13');

async function startEmulator(page: Page) {
  await expect(runButton(page)).toBeEnabled();
  await runButton(page).click();
  await expect(status(page)).toHaveText('running');
  await expect(stopButton(page)).toBeEnabled();
}

test.describe('app shell', () => {
  test('loads with an idle emulator, starter hardware, and all panels', async ({ page }) => {
    await expect(status(page)).toHaveText('idle');
    await expect(runButton(page)).toBeEnabled();
    await expect(stopButton(page)).toBeDisabled();
    await expect(page.getByText('Hardware Setup')).toBeVisible();
    await expect(page.getByText('Serial Monitor')).toBeVisible();
    await expect(page.getByTestId('serial-output')).toContainText('No output');
    // Starter project ships with hardware pre-added: LED on D13, Button on D2.
    // (exact: the pin pickers also contain "used by LED 1" substrings)
    await expect(led13(page)).toHaveAttribute('data-state', 'off');
    await expect(page.getByTestId('virtual-button-2')).toBeVisible();
    await expect(page.getByText('LED 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Button 1', { exact: true })).toBeVisible();
  });

  test('code preview shows the generated C and is truly read-only', async ({ page }) => {
    const preview = page.getByTestId('code-preview');
    await expect(preview).toContainText('void setup()');
    await expect(preview).toContainText('void loop()');
    // One-way blocks → code (ADR-0004): typing must change nothing.
    await preview.click();
    await page.keyboard.type('HACKED');
    await expect(preview).not.toContainText('HACKED');
    await expect(preview).toContainText('void setup()');
  });

  test('renders the beginner toolbox and opens a flyout', async ({ page }) => {
    await expect(page.locator('.blocklyToolbox')).toBeVisible();
    // Default mode is beginner: guided categories only (persistence.md §2).
    for (const category of ['Structure', 'Components', 'Control', 'Logic', 'Math', 'Serial']) {
      await expect(page.getByRole('treeitem', { name: category })).toBeVisible();
    }
    await expect(page.getByRole('treeitem', { name: 'Pins' })).toHaveCount(0);
    await page.getByRole('treeitem', { name: 'Components' }).click();
    await expect(page.locator('.blocklyToolboxFlyout')).toBeVisible();
  });

  test('editor mode filters the toolbox only — loaded blocks and code survive', async ({ page }) => {
    const preview = page.getByTestId('code-preview');
    await expect(preview).toContainText('digitalWrite(13, HIGH);');

    // Intermediate offers Pins/Variables/Time.
    await page.getByTestId('editor-mode').selectOption('intermediate');
    await expect(page.getByRole('treeitem', { name: 'Pins' })).toBeVisible();
    await expect(page.getByRole('treeitem', { name: 'Variables' })).toBeVisible();

    // Back to beginner: the toolbox shrinks, but the workspace's set_pin
    // blocks are untouched and the generated C is identical.
    await page.getByTestId('editor-mode').selectOption('beginner');
    await expect(page.getByRole('treeitem', { name: 'Pins' })).toHaveCount(0);
    await expect(page.locator('[data-id="starter_on"]').first()).toBeVisible();
    await expect(preview).toContainText('digitalWrite(13, HIGH);');
  });
});

test.describe('emulator lifecycle', () => {
  test('Run compiles and starts the emulator', async ({ page }) => {
    await startEmulator(page);
    await expect(runButton(page)).toBeDisabled();
  });

  test('the emulator blinks the pin 13 LED', async ({ page }) => {
    await startEmulator(page);
    // A full toggle cycle proves the IR runtime is really executing:
    // on → off → on, each observed as a state change, never a sleep.
    await expect(led13(page)).toHaveAttribute('data-state', 'on', { timeout: 30_000 });
    await expect(led13(page)).toHaveAttribute('data-state', 'off', { timeout: 30_000 });
    await expect(led13(page)).toHaveAttribute('data-state', 'on', { timeout: 30_000 });
  });

  test('Stop halts the run and restores idle controls', async ({ page }) => {
    await startEmulator(page);
    await stopButton(page).click();
    await expect(status(page)).toHaveText('idle');
    await expect(stopButton(page)).toBeDisabled();
    await expect(runButton(page)).toBeEnabled();
  });

  test('Reset returns the hardware panel to a clean state', async ({ page }) => {
    await startEmulator(page);
    await expect(led13(page)).toHaveAttribute('data-state', 'on', { timeout: 30_000 });
    await resetButton(page).click();
    await expect(status(page)).toHaveText('idle');
    await expect(led13(page)).toHaveAttribute('data-state', 'off');
    await expect(page.getByTestId('serial-output')).toContainText('No output');
  });

  test('the emulator can be restarted after stopping', async ({ page }) => {
    await startEmulator(page);
    await expect(led13(page)).toHaveAttribute('data-state', 'on', { timeout: 30_000 });
    await stopButton(page).click();
    await expect(status(page)).toHaveText('idle');

    await resetButton(page).click();
    await startEmulator(page);
    await expect(led13(page)).toHaveAttribute('data-state', 'on', { timeout: 30_000 });
  });
});

test.describe('stress', () => {
  test('survives rapid run/stop cycling', async ({ page }) => {
    for (let cycle = 0; cycle < 5; cycle++) {
      await startEmulator(page);
      await stopButton(page).click();
      await expect(status(page)).toHaveText('idle');
      await expect(runButton(page)).toBeEnabled();
    }
  });

  test('recovers cleanly from a mid-run reload', async ({ page }) => {
    await startEmulator(page);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Pinboard' })).toBeVisible();
    await expect(page.locator('.blocklySvg')).toBeVisible();
    await expect(status(page)).toHaveText('idle');
    // The app must be fully functional again after the reload.
    await startEmulator(page);
    await expect(led13(page)).toHaveAttribute('data-state', 'on', { timeout: 30_000 });
  });

  test('repeated toolbox interaction while the emulator runs stays responsive', async ({ page }) => {
    await startEmulator(page);
    for (const category of ['Structure', 'Components', 'Control', 'Logic', 'Serial', 'Components', 'Control']) {
      await page.getByRole('treeitem', { name: category }).click();
      await expect(page.locator('.blocklyToolboxFlyout')).toBeVisible();
    }
    // The emulator kept running through all of it.
    await expect(status(page)).toHaveText('running');
  });
});

test.describe('components', () => {
  test('add, re-pin (conflict diagnostic), and remove a component', async ({ page }) => {
    // Add a second LED: D13 is taken, so it defaults to D12.
    await page.getByTestId('add-led').click();
    // Filter by the exact card header — pin-picker options contain
    // "used by LED 2" substrings in every card.
    const ledCard = page
      .locator('[data-testid^="component-"]')
      .filter({ has: page.getByText('LED 2', { exact: true }) });
    await expect(ledCard).toBeVisible();
    await expect(page.getByTestId('led-12')).toBeVisible();

    // Re-pin it onto D13 → pin-conflict error appears; back to D12 → clears.
    await ledCard.locator('select').selectOption('D13');
    await expect(page.getByTestId('diagnostics')).toContainText('Two components on D13');
    await ledCard.locator('select').selectOption('D12');
    await expect(page.getByTestId('diagnostics')).not.toBeVisible();

    // Add a potentiometer: analog pins only, defaults to A0.
    await page.getByTestId('add-potentiometer').click();
    await expect(page.getByTestId('pot-A0')).toBeVisible();

    // Remove the second LED.
    await ledCard.getByTitle('Remove LED 2').click();
    await expect(page.getByTestId('led-12')).not.toBeVisible();
  });

  test('removing the LED surfaces the write-without-component teaching warning', async ({ page }) => {
    await page.getByTestId('remove-starter-led').click();
    await expect(page.getByTestId('diagnostics')).toContainText('Nothing is connected to D13');
  });

  test('button controls LED — the full learning loop (acceptance §11)', async ({ page }) => {
    const doc = {
      schemaVersion: 1,
      appVersion: '0.1.0',
      metadata: {
        id: 'e2e-button-led',
        title: 'Button Controls LED',
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T00:00:00.000Z',
      },
      board: { id: 'arduino-uno', fqbn: 'arduino:avr:uno' },
      workspace: {
        format: 'blockly-json',
        data: {
          blocks: {
            languageVersion: 0,
            blocks: [
              {
                type: 'arduino_loop',
                id: 'bl_loop',
                x: 40,
                y: 40,
                inputs: {
                  DO: {
                    block: {
                      type: 'if_do',
                      id: 'bl_if',
                      inputs: {
                        CONDITION: {
                          block: { type: 'button_is_pressed', id: 'bl_cond', fields: { COMPONENT: 'imp-button' } },
                        },
                        DO: {
                          block: { type: 'led_set', id: 'bl_on', fields: { COMPONENT: 'imp-led', STATE: 'ON' } },
                        },
                      },
                      next: { block: { type: 'delay_ms', id: 'bl_delay', fields: { DELAY: 20 } } },
                    },
                  },
                },
              },
            ],
          },
        },
      },
      hardware: {
        components: [
          {
            id: 'imp-led',
            type: 'led',
            displayName: 'LED 1',
            position: { x: 0, y: 0 },
            config: { color: 'red', activeHigh: true },
            pins: { signal: 'D13' },
          },
          {
            id: 'imp-button',
            type: 'button',
            displayName: 'Button 1',
            position: { x: 0, y: 0 },
            config: { pullMode: 'internal_pullup' },
            pins: { signal: 'D2' },
          },
        ],
        wiring: [],
      },
      settings: { editorMode: 'beginner', simulationSpeed: 1, showAdvancedBlocks: false },
    };

    await page.getByTestId('import-input').setInputFiles({
      name: 'button-led.pinboard.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(doc)),
    });
    await expect(page.getByTestId('save-note')).toHaveText('Project imported');
    await expect(page.getByTestId('code-preview')).toContainText('if (digitalRead(2) == LOW) {');

    await startEmulator(page);
    await expect(led13(page)).toHaveAttribute('data-state', 'off');

    // Press the virtual button → pull-up line goes LOW → the program lights the LED.
    await page.getByTestId('virtual-button-2').dispatchEvent('mousedown');
    await expect(led13(page)).toHaveAttribute('data-state', 'on');
    await page.getByTestId('virtual-button-2').dispatchEvent('mouseup');
  });
});

test.describe('lessons', () => {
  test('the Blink lesson walks step-by-step and its checks pass', async ({ page }) => {
    await page.getByTestId('lessons-toggle').click();
    await expect(page.getByTestId('lesson-panel')).toBeVisible();
    // The lesson panel docks beside the workspace — the toolbox stays usable.
    await expect(page.locator('.blocklyToolbox')).toBeVisible();
    await page.getByTestId('lesson-item-blink-led').click();

    // Tutorial flow: one step at a time, hints hidden until asked.
    await expect(page.getByTestId('lesson-progress')).toContainText('Step 1 of');
    await expect(page.getByTestId('lesson-prev')).toBeDisabled();
    const next = page.getByTestId('lesson-next');
    while (await next.isEnabled()) {
      await next.click();
    }
    // Last stage is "check my work".
    await page.getByTestId('check-work').click();
    // "really-blinks" runs the program headless on the synthetic clock.
    for (const id of ['led-exists', 'led-on-d13', 'writes-d13', 'uses-delay', 'really-blinks']) {
      await expect(page.getByTestId(`check-${id}`)).toHaveAttribute('data-passed', 'true', { timeout: 20_000 });
    }
    // All green → the celebration shows; progress persists locally.
    await expect(page.getByTestId('lesson-complete')).toBeVisible();
    await expect(page.getByTestId('save-note')).toHaveText('Saved locally');
  });

  test('hardware explainers match the editor mode', async ({ page }) => {
    await page.getByTestId('explain-starter-led').click();
    const explainer = page.getByTestId('explainer-starter-led');
    await expect(explainer).toContainText('A tiny light');

    await page.getByTestId('editor-mode').selectOption('advanced');
    await expect(explainer).toContainText('series resistor');

    await page.getByTestId('explain-starter-led').click();
    await expect(explainer).toHaveCount(0);
  });
});

test.describe('persistence', () => {
  test('autosaves the project locally and restores it after reload', async ({ page }) => {
    await expect(page.getByTestId('save-note')).toHaveText('Saved locally');
    const firstId = await page.evaluate(() => localStorage.getItem('pinboard:last-opened-project-id'));
    expect(firstId).toBeTruthy();

    await page.reload();
    await expect(page.locator('.blocklySvg')).toBeVisible();
    const secondId = await page.evaluate(() => localStorage.getItem('pinboard:last-opened-project-id'));
    expect(secondId).toBe(firstId);
    await expect(page.getByTestId('code-preview')).toContainText('digitalWrite(13, HIGH);');
  });

  test('exports a .pinboard.json download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pinboard\.json$/);
  });

  test('imports a project: preview, simulator, and serial all reflect it', async ({ page }) => {
    const importedDoc = {
      schemaVersion: 1,
      appVersion: '0.1.0',
      metadata: {
        id: 'e2e-import',
        title: 'Imported Serial Demo',
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T00:00:00.000Z',
      },
      board: { id: 'arduino-uno', fqbn: 'arduino:avr:uno' },
      workspace: {
        format: 'blockly-json',
        data: {
          blocks: {
            languageVersion: 0,
            blocks: [
              {
                type: 'arduino_loop',
                id: 'imp_loop',
                x: 40,
                y: 40,
                inputs: {
                  DO: {
                    block: {
                      type: 'serial_print',
                      id: 'imp_print',
                      inputs: {
                        VALUE: { block: { type: 'string_text', id: 'imp_text', fields: { TEXT: 'hello import' } } },
                      },
                      next: { block: { type: 'delay_ms', id: 'imp_delay', fields: { DELAY: 200 } } },
                    },
                  },
                },
              },
            ],
          },
        },
      },
      hardware: { components: [], wiring: [] },
      settings: { editorMode: 'beginner', simulationSpeed: 1, showAdvancedBlocks: false },
    };

    await page.getByTestId('import-input').setInputFiles({
      name: 'demo.pinboard.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importedDoc)),
    });
    await expect(page.getByTestId('save-note')).toHaveText('Project imported');
    await expect(page.getByTestId('code-preview')).toContainText('Serial.println("hello import");');

    await startEmulator(page);
    await expect(page.getByTestId('serial-output')).toContainText('hello import');
  });

  test('a malformed import fails safely and the editor stays usable', async ({ page }) => {
    await page.getByTestId('import-input').setInputFiles({
      name: 'bad.pinboard.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{this is not json'),
    });
    await expect(page.getByTestId('save-note')).toContainText('Import failed');
    await expect(page.getByTestId('code-preview')).toContainText('void loop()');
    await startEmulator(page);
    await expect(status(page)).toHaveText('running');
  });
});

test.describe('virtual hardware', () => {
  test('the virtual button reflects press and release', async ({ page }) => {
    const button = page.getByTestId('virtual-button-2');
    await expect(button).toHaveAttribute('data-pressed', 'false');
    // dispatchEvent targets the React handlers directly: the pressed state
    // re-renders the element (scale/translate), which real cursor events
    // race against via onMouseLeave.
    await button.dispatchEvent('mousedown');
    await expect(button).toHaveAttribute('data-pressed', 'true');
    await button.dispatchEvent('mouseup');
    await expect(button).toHaveAttribute('data-pressed', 'false');
  });
});

test.describe('code source map', () => {
  // Click a block by its label. Stacked blocks nest their SVG groups and
  // selection reorders the DOM, so resolve the text element whose *nearest*
  // [data-id] ancestor is the target block and click its real coordinates.
  async function clickBlockLabel(page: Page, blockId: string, label: string) {
    // page.evaluate does not auto-wait; make sure the block has rendered.
    await expect(page.locator(`[data-id="${blockId}"]`).first()).toBeVisible();
    const point = await page.evaluate(
      ([id, text]) => {
        const el = [...document.querySelectorAll('svg text')].find(
          (t) =>
            // Blockly renders labels with non-breaking spaces; normalize.
            t.textContent?.replace(/\u00A0/g, ' ').trim() === text &&
            t.closest('[data-id]')?.getAttribute('data-id') === id,
        );
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      },
      [blockId, label],
    );
    if (!point) throw new Error(`block ${blockId} with label "${label}" not found`);
    await page.mouse.click(point.x, point.y);
  }

  test('selecting a block highlights its printed lines; deselecting clears them', async ({ page }) => {
    // The starter loop has two "set pin 13" blocks; each must highlight
    // exactly its own printed line.
    const highlighted = page.locator('.cm-block-highlight');
    await clickBlockLabel(page, 'starter_on', 'set pin');
    await expect(highlighted).toHaveCount(1);
    await expect(highlighted).toContainText('digitalWrite(13, HIGH);');

    await clickBlockLabel(page, 'starter_off', 'set pin');
    await expect(highlighted).toHaveCount(1);
    await expect(highlighted).toContainText('digitalWrite(13, LOW);');

    // Clicking empty workspace deselects; the highlight must clear.
    await page.locator('.blocklySvg').first().click({ position: { x: 600, y: 380 } });
    await expect(highlighted).toHaveCount(0);
  });
});

test.describe('routes', () => {
  test('/editor/new opens a fresh starter project; /projects lists local projects', async ({ page }) => {
    await page.goto('/editor/new');
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId('emulator-status')).toHaveText('idle');
    await expect(page.getByTestId('code-preview')).toContainText('digitalWrite(13, HIGH);');
    // Let the debounced autosave land before navigating away.
    await expect(page.getByTestId('save-note')).toHaveText('Saved locally');

    await page.goto('/projects');
    await expect(page.getByTestId('project-list')).toBeVisible();
    await expect(page.getByTestId('project-list').getByRole('link').first()).toContainText('My Pinboard Project');

    // Clicking a project opens the editor for that id.
    await page.getByTestId('project-list').getByRole('link').first().click();
    await expect(page).toHaveURL(/\/editor\//);
    await expect(page.getByTestId('code-preview')).toContainText('digitalWrite(13, HIGH);');
  });

  test('/auth/callback never blocks local use — it returns to the editor', async ({ page }) => {
    await page.goto('/auth/callback');
    await expect(page.getByTestId('emulator-status')).toHaveText('idle');
  });
});

test.describe('cloud is optional (ADR-0006/0007)', () => {
  test('without Supabase env keys, no sign-in UI exists and the editor is fully local', async ({ page }) => {
    await expect(page.getByTestId('sign-in')).toHaveCount(0);
    await expect(page.getByTestId('save-note')).toHaveText('Saved locally');
  });
});

test.describe('buzzer and servo components (Phase 3)', () => {
  test('add a buzzer and a servo: visuals render with default pins', async ({ page }) => {
    await page.getByTestId('add-buzzer').click();
    await expect(page.getByTestId('buzzer-8')).toBeVisible();
    await expect(page.getByTestId('buzzer-8')).toContainText('silent');

    await page.getByTestId('add-servo').click();
    await expect(page.getByTestId('servo-9')).toBeVisible();
    await expect(page.getByTestId('servo-9')).toContainText('90°');
  });
});

test.describe('diagnostic quick fixes (hardware.md §6)', () => {
  test('LED-on-wrong-pin offers "Move LED 1 to D13" and applies only on click', async ({ page }) => {
    // Move the starter LED off D13 — the program still writes D13.
    await page.getByTestId('pin-picker-starter-led').selectOption('D12');
    const fix = page.getByTestId('fix-write-without-component:D13');
    await expect(fix).toBeVisible();
    await expect(fix).toHaveText('Move LED 1 to D13');
    // Diagnosed, not auto-fixed: the LED is still on D12 until the click.
    await expect(page.getByTestId('led-12')).toBeVisible();

    await fix.click();
    await expect(page.getByTestId('led-13')).toBeVisible();
    await expect(fix).toHaveCount(0);
  });
});

test.describe('accessibility (testing.md §5 fitness function)', () => {
  test('no serious/critical axe violations in the app UI', async ({ page }) => {
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    const results = await new AxeBuilder({ page })
      // Blockly's SVG internals are third-party; our UI must stay clean.
      .exclude('.blocklyDiv')
      .exclude('.blocklySvg')
      .analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  });
});
