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
    const toolbox = page.locator('.blocklyToolboxDiv');
    await expect(toolbox).toBeVisible();
    for (const category of ['Structure', 'Pins', 'Control', 'Logic', 'Serial']) {
      await expect(toolbox.getByText(category, { exact: true })).toBeVisible();
    }
    await toolbox.getByText('Pins', { exact: true }).click();
    await expect(page.locator('.blocklyFlyout')).toBeVisible();
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
    const toolbox = page.locator('.blocklyToolboxDiv');
    for (const category of ['Structure', 'Pins', 'Control', 'Logic', 'Serial', 'Pins', 'Control']) {
      await toolbox.getByText(category, { exact: true }).click();
      await expect(page.locator('.blocklyFlyout')).toBeVisible();
    }
    // The emulator kept running through all of it.
    await expect(status(page)).toHaveText('running');
  });
});

test.describe('virtual hardware', () => {
  test('the virtual button reflects press and release', async ({ page }) => {
    const button = page.getByTestId('virtual-button-2');
    await expect(button).toHaveAttribute('data-pressed', 'false');
    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(button).toHaveAttribute('data-pressed', 'true');
    await page.mouse.up();
    await expect(button).toHaveAttribute('data-pressed', 'false');
  });
});
