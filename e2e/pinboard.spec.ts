/**
 * End-to-end stress tests for the Pinboard app: shell, Blockly workspace,
 * emulator lifecycle (Run/Stop/Reset), rapid-cycling stress, reload
 * recovery, and virtual hardware interaction.
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
  // compileMock takes ~600ms; land on "running" regardless of whether we
  // catch the transient "compiling" state.
  await expect(status(page)).toHaveText('running');
  await expect(stopButton(page)).toBeEnabled();
}

test.describe('app shell', () => {
  test('loads with an idle emulator and all panels', async ({ page }) => {
    await expect(status(page)).toHaveText('idle');
    await expect(runButton(page)).toBeEnabled();
    await expect(stopButton(page)).toBeDisabled();
    await expect(page.getByText('Hardware Setup')).toBeVisible();
    await expect(page.getByText('Serial Monitor')).toBeVisible();
    await expect(page.getByTestId('serial-output')).toContainText('No output');
    await expect(led13(page)).toHaveAttribute('data-state', 'off');
    await expect(page.getByTestId('led-12')).toHaveAttribute('data-state', 'off');
  });

  test('code preview shows the generated C skeleton', async ({ page }) => {
    const preview = page.getByTestId('code-preview');
    await expect(preview).toContainText('void setup()');
    await expect(preview).toContainText('void loop()');
  });

  test('renders the Blockly toolbox with all categories and opens a flyout', async ({ page }) => {
    await expect(page.locator('.blocklyToolbox')).toBeVisible();
    for (const category of ['Structure', 'Pins', 'Control', 'Logic', 'Serial']) {
      await expect(page.getByRole('treeitem', { name: category })).toBeVisible();
    }
    await page.getByRole('treeitem', { name: 'Pins' }).click();
    await expect(page.locator('.blocklyToolboxFlyout')).toBeVisible();
  });
});

test.describe('emulator lifecycle', () => {
  test('Run compiles and starts the emulator', async ({ page }) => {
    await startEmulator(page);
    await expect(runButton(page)).toBeDisabled();
  });

  test('the emulator blinks the pin 13 LED', async ({ page }) => {
    await startEmulator(page);
    // A full toggle cycle proves the AVR core is really executing:
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
    for (const category of ['Structure', 'Pins', 'Control', 'Logic', 'Serial', 'Pins', 'Control']) {
      await page.getByRole('treeitem', { name: category }).click();
      await expect(page.locator('.blocklyToolboxFlyout')).toBeVisible();
    }
    // The emulator kept running through all of it.
    await expect(status(page)).toHaveText('running');
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
