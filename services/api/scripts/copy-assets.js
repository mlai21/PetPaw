// 把非 TS 资源（如 SQL migration 文件）从 src 拷贝到 dist，保证生产运行时可读取。
const fs = require('node:fs');
const path = require('node:path');

const SRC_ROOT = path.resolve(__dirname, '..', 'src');
const DIST_ROOT = path.resolve(__dirname, '..', 'dist');
const ASSET_EXTENSIONS = new Set(['.sql']);

function copyAssets(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const srcPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      copyAssets(srcPath);
      continue;
    }
    if (!ASSET_EXTENSIONS.has(path.extname(entry.name))) continue;
    const rel = path.relative(SRC_ROOT, srcPath);
    const destPath = path.join(DIST_ROOT, rel);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
  }
}

copyAssets(SRC_ROOT);
