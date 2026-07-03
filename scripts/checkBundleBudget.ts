/**
 * Bundle budget fitness function (docs/domains/testing.md §5, §7 —
 * Chromebook-first). Fails CI when the gzipped JS grows past the budget.
 * Current baseline ~433 KB gzip (Blockly + CodeMirror + supabase-js in one
 * chunk); the budget leaves headroom but catches a runaway dependency.
 * Getting under the baseline again means lazy-loading Blockly/CodeMirror.
 *
 * Run with: npm run check:bundle (after npm run build)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_GZIP_KB = 600;

const assetsDir = join(process.cwd(), 'dist', 'assets');
let files: string[];
try {
  files = readdirSync(assetsDir).filter((name) => name.endsWith('.js'));
} catch {
  console.error('✗ dist/assets not found — run `npm run build` first');
  process.exit(1);
}

let totalGzip = 0;
for (const name of files) {
  const gz = gzipSync(readFileSync(join(assetsDir, name))).length;
  totalGzip += gz;
  console.log(`  ${name}: ${(gz / 1024).toFixed(1)} KB gzip`);
}

const totalKb = totalGzip / 1024;
console.log(`Total JS: ${totalKb.toFixed(1)} KB gzip (budget ${BUDGET_GZIP_KB} KB)`);
if (totalKb > BUDGET_GZIP_KB) {
  console.error(`✗ bundle budget exceeded by ${(totalKb - BUDGET_GZIP_KB).toFixed(1)} KB`);
  process.exit(1);
}
console.log('✓ within budget');
