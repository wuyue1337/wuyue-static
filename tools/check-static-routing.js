'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cdn = 'https://wuyue1337.github.io/wuyue-static';
const skipDirs = new Set(['.git', '_private', 'node_modules', 'wuyue-static-publish']);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory() && skipDirs.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(?:html|js)$/i.test(ent.name)) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

const problems = [];

for (const file of walk(root)) {
  const text = fs.readFileSync(file, 'utf8');
  const fileName = rel(file);

  if (text.includes(`${cdn}/socket.io/`)) {
    problems.push({
      file: fileName,
      message: 'Socket.IO 被错误指向 GitHub Pages；必须使用 /socket.io/... 主站同源地址。'
    });
  }

  if (text.includes(`${cdn}/api/`)) {
    problems.push({
      file: fileName,
      message: 'API 被错误指向 GitHub Pages；/api/... 必须留在主站。'
    });
  }

  if (/\.html$/i.test(file)) {
    const assetRe = /\b(?:src|href)=(['"])(\/(?!api\/|socket\.io\/)[^'"<>]+\.(?:css|js|jpg|jpeg|png|webp|gif|svg|ico|woff2?|ttf|otf|mp3|wav|ogg|webm|mp4)(?:[?#][^'"<>]*)?)\1/gi;
    for (const match of text.matchAll(assetRe)) {
      problems.push({
        file: fileName,
        message: `HTML 仍有未切到 GitHub Pages 的公共静态资源：${match[2]}`
      });
    }
  }
}

if (problems.length) {
  console.error('\n[STATIC ROUTING CHECK FAILED]');
  for (const problem of problems) {
    console.error(`- ${problem.file}: ${problem.message}`);
  }
  console.error('\n已停止发布。请先修复以上静态资源路由问题。\n');
  process.exit(1);
}

console.log('[STATIC ROUTING CHECK OK]');
console.log('Socket.IO / API 均保留在主站，HTML 公共静态资源已正确切到 GitHub Pages。');
