/**
 * 将 Vant Weapp 组件复制到 uni-app 的 wxcomponents 目录。
 *
 * 只复制项目实际使用的组件及其递归依赖，避免把 1.9MB 的完整组件库塞进 2MB 主包。
 * 依赖收集分两步：
 *   1. 组件声明依赖：递归解析 index.json 的 usingComponents
 *   2. 脚本依赖：扫描已收集目录里 js / wxs 的相对 import 和 require
 *      （例如 common/component.js -> ../mixins/basic，只复制目录名会漏掉 mixins）
 *
 * 复制完成后会再校验一遍：任何相对依赖找不到目标文件都直接报错退出，
 * 把「运行时报 module is not defined」的问题提前到构建阶段暴露。
 *
 * 新增组件时在 USED_COMPONENTS 中登记，并同步更新 pages.json 的 usingComponents。
 */
const fs = require('fs');
const path = require('path');

const USED_COMPONENTS = ['button', 'icon', 'stepper', 'switch'];

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'node_modules', '@vant', 'weapp', 'dist');
const destDir = path.join(root, 'src', 'wxcomponents', '@vant', 'weapp');

if (!fs.existsSync(srcDir)) {
  console.warn('[vant] 未找到 node_modules/@vant/weapp，跳过组件复制');
  process.exit(0);
}

/** 匹配 from './x'、from "../x"、require('./x') */
const RELATIVE_DEP = /(?:from|require\()\s*['"](\.[^'"]+)['"]/g;

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    return '';
  }
}

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  entries.forEach(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  });
  return out;
}

function isScript(file) {
  return /\.(js|wxs)$/.test(file);
}

/** 把某个绝对路径所在的目录（相对 dist 根）收进集合，返回是否有新增 */
function addDir(set, absPath) {
  const dir = fs.existsSync(absPath) && fs.statSync(absPath).isDirectory() ? absPath : path.dirname(absPath);
  const rel = path.relative(srcDir, dir).split(path.sep).join('/');
  if (!rel || rel.startsWith('..') || set.has(rel)) return false;
  set.add(rel);
  return true;
}

/** 第一步：按 index.json 的 usingComponents 递归收集组件目录 */
function collectComponent(name, set) {
  if (set.has(name)) return;
  const dir = path.join(srcDir, name);
  const jsonPath = path.join(dir, 'index.json');
  if (!fs.existsSync(jsonPath)) return;
  set.add(name);

  let json = {};
  try {
    json = JSON.parse(readText(jsonPath));
  } catch (e) {
    return;
  }
  const using = json.usingComponents || {};
  Object.keys(using).forEach(key => {
    const target = path.resolve(dir, using[key]);
    const depDir = fs.existsSync(target) && fs.statSync(target).isDirectory() ? target : path.dirname(target);
    const rel = path.relative(srcDir, depDir).split(path.sep).join('/');
    if (rel && !rel.startsWith('..')) collectComponent(rel, set);
  });
}

/** 第二步：扫描脚本里的相对依赖，直到集合不再增长 */
function collectScriptDeps(set) {
  let changed = true;
  while (changed) {
    changed = false;
    Array.from(set).forEach(rel => {
      walk(path.join(srcDir, rel))
        .filter(isScript)
        .forEach(file => {
          const content = readText(file);
          let match;
          RELATIVE_DEP.lastIndex = 0;
          while ((match = RELATIVE_DEP.exec(content))) {
            if (addDir(set, path.resolve(path.dirname(file), match[1]))) changed = true;
          }
        });
    });
  }
}

/** 复制后校验：相对依赖的目标必须存在 */
function verify() {
  const missing = [];
  walk(destDir)
    .filter(isScript)
    .forEach(file => {
      const content = readText(file);
      let match;
      RELATIVE_DEP.lastIndex = 0;
      while ((match = RELATIVE_DEP.exec(content))) {
        const spec = match[1];
        const base = path.resolve(path.dirname(file), spec);
        const candidates = [base, `${base}.js`, `${base}.wxs`, path.join(base, 'index.js')];
        if (!candidates.some(item => fs.existsSync(item))) {
          missing.push(`${path.relative(destDir, file)} -> ${spec}`);
        }
      }
    });

  if (missing.length) {
    console.error('[vant] 依赖缺失，打包后会在小程序里报 module is not defined：');
    missing.forEach(item => console.error(`  - ${item}`));
    process.exit(1);
  }
}

const collected = new Set();
USED_COMPONENTS.forEach(name => collectComponent(name, collected));
// 公共样式、工具与 wxs 脚本是所有组件共用的入口
['common', 'wxs'].forEach(name => {
  if (fs.existsSync(path.join(srcDir, name))) collected.add(name);
});
collectScriptDeps(collected);

fs.rmSync(destDir, { recursive: true, force: true });
fs.mkdirSync(destDir, { recursive: true });

const copied = [];
collected.forEach(rel => {
  const from = path.join(srcDir, rel);
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, path.join(destDir, rel), {
    recursive: true,
    filter: src => !src.endsWith('.d.ts') && !src.endsWith('.map')
  });
  copied.push(rel);
});

verify();

console.log(
  `[vant] 已复制 ${copied.length} 个目录（${USED_COMPONENTS.join(' / ')} 及其依赖，含 ${copied
    .filter(name => !USED_COMPONENTS.includes(name))
    .sort()
    .join(' / ')}）到 src/wxcomponents/@vant/weapp`
);
