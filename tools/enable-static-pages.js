const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cdn = 'https://wuyue1337.github.io/wuyue-static';
const staticExt = /\.(?:css|js|jpg|jpeg|png|webp|gif|svg|ico|woff2?|ttf|otf|mp3|wav|ogg|webm|mp4)(?:[?#].*)?$/i;
const skipDirs = new Set(['.git','_private','node_modules','wuyue-static-publish']);

function walk(dir, out=[]) {
  for (const ent of fs.readdirSync(dir, { withFileTypes:true })) {
    if (ent.isDirectory() && skipDirs.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(?:html|js)$/i.test(ent.name)) out.push(full);
  }
  return out;
}

function toCdnUrl(raw, sourceFile) {
  if (!raw) return raw;

  // Repair any old mistaken rewrite that sent Socket.IO to GitHub Pages.
  const mistakenSocketPrefix = `${cdn}/socket.io/`;
  if (raw.startsWith(mistakenSocketPrefix)) return raw.slice(cdn.length);

  if (/^(?:https?:|data:|blob:|#|mailto:|tel:|javascript:|\/\/)/i.test(raw)) return raw;
  if (!staticExt.test(raw)) return raw;
  if (/^\/(?:api|socket\.io)\//i.test(raw)) return raw;

  const match = raw.match(/^([^?#]*)([?#].*)?$/);
  const pathname = match[1];
  const suffix = match[2] || '';
  let sitePath;

  if (pathname.startsWith('/')) {
    sitePath = pathname;
  } else {
    const sourceDir = path.posix.dirname('/' + path.relative(root, sourceFile).replace(/\\/g,'/'));
    sitePath = path.posix.normalize(path.posix.join(sourceDir, pathname));
  }

  // Node 源码目录与公网 URL 的两个特殊映射。
  sitePath = sitePath.replace(/^\/lol-guess\/public\//, '/lol/');
  sitePath = sitePath.replace(/^\/lol-guess\/guess-room-public\//, '/guess/');

  return cdn + sitePath + suffix;
}

let changedFiles = 0;
for (const file of walk(root)) {
  let text = fs.readFileSync(file, 'utf8');
  const before = text;

  if (/\.html$/i.test(file)) {
    text = text.replace(/\b(src|href)=(['"])([^'"<>]+)\2/gi, (all, attr, quote, value) => {
      const next = toCdnUrl(value, file);
      return `${attr}=${quote}${next}${quote}`;
    });
  }

  if (/\.js$/i.test(file)) {
    // Only rewrite literal root-relative static assets in JS. API, navigation and Socket.IO stay on the site origin.
    text = text.replace(/(['"])(\/(?!api\/|socket\.io\/)[^'"\r\n]+\.(?:css|js|jpg|jpeg|png|webp|gif|svg|ico|woff2?|ttf|otf|mp3|wav|ogg|webm|mp4)(?:[?#][^'"\r\n]*)?)\1/gi,
      (all, quote, value) => `${quote}${toCdnUrl(value, file)}${quote}`);

    // Also repair previously rewritten absolute Socket.IO URLs in JS literals.
    text = text.replace(new RegExp(`(['"])${cdn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/socket\\.io/[^'"\\r\\n]+)\\1`, 'gi'),
      (all, quote, socketPath) => `${quote}${socketPath}${quote}`);
  }

  if (text !== before) {
    fs.writeFileSync(file, text, 'utf8');
    console.log('UPDATED', path.relative(root, file));
    changedFiles++;
  }
}

console.log(`\nDone. Updated ${changedFiles} HTML/JS file(s).`);
console.log('API / navigation / Socket.IO URLs were not changed.');
