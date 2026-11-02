/**
 * 核心数据逻辑冒烟测试（不依赖微信运行时，用内存 mock 小程序存储 API）。
 * 运行：npm run test
 */
const assert = require('assert');
const path = require('path');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, '.smoke.bundle.cjs');

buildSync({
  entryPoints: [path.join(__dirname, 'smoke.case.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: out,
  alias: { '@': path.join(root, 'src') },
  logLevel: 'warning'
});

const results = require(out);

let passed = 0;
let failed = 0;
Object.keys(results).forEach(name => {
  const fn = results[name];
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
