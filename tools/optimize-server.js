const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const appDir = path.join(root, 'lol-guess');
const serverFile = path.join(appDir, 'server.js');

if (!fs.existsSync(serverFile)) {
  console.error('未找到 lol-guess/server.js');
  process.exit(1);
}

let text = fs.readFileSync(serverFile, 'utf8');
let changed = false;

const oldHeartbeat = "const io = new Server(server, { pingInterval: 5000, pingTimeout: 5000, maxHttpBufferSize: 64 * 1024 });";
const newHeartbeat = "const io = new Server(server, { pingInterval: 20000, pingTimeout: 10000, maxHttpBufferSize: 64 * 1024 });";
if (text.includes(oldHeartbeat)) {
  text = text.replace(oldHeartbeat, newHeartbeat);
  changed = true;
  console.log('已优化 Socket.IO 心跳：5s/5s -> 20s/10s');
} else if (text.includes(newHeartbeat)) {
  console.log('Socket.IO 心跳已经是优化后的配置。');
} else {
  console.warn('未识别到标准 Socket.IO 心跳配置，跳过心跳修改。');
}

if (!text.includes("require('compression')")) {
  const marker = "const express = require('express');";
  if (!text.includes(marker)) {
    console.error('未找到 Express 引入位置，已停止，避免误改 server.js。');
    process.exit(1);
  }
  text = text.replace(marker, `${marker}\nconst compression = require('compression');`);
  changed = true;
  console.log('已加入 compression 模块。');
}

const compressionBlock = "app.use(compression({ threshold: 1024 }));";
if (!text.includes(compressionBlock)) {
  const marker = "app.disable('x-powered-by');";
  if (!text.includes(marker)) {
    console.error('未找到 Express 初始化位置，已停止，避免误改 server.js。');
    process.exit(1);
  }
  const cacheBlock = `${compressionBlock}\napp.use((req,res,next)=>{\n  if(req.method==='GET' && /\\.(?:css|js|jpg|jpeg|png|webp|gif|svg|ico|woff2?|ttf|otf|mp3|wav|ogg|webm|mp4)$/i.test(req.path)){\n    res.set('Cache-Control','public, max-age=3600');\n  }\n  next();\n});`;
  text = text.replace(marker, `${marker}\n${cacheBlock}`);
  changed = true;
  console.log('已开启 HTTP 压缩，并给本地静态资源加 1 小时浏览器缓存。');
}

if (changed) {
  fs.writeFileSync(serverFile, text, 'utf8');
} else {
  console.log('server.js 已经是当前优化配置，无需修改。');
}

const compressionPkg = path.join(appDir, 'node_modules', 'compression', 'package.json');
if (!fs.existsSync(compressionPkg)) {
  console.log('正在安装 compression 依赖...');
  try {
    execFileSync(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm.cmd install compression@^1.7.5 --save']
      : ['install', 'compression@^1.7.5', '--save'], {
      cwd: appDir,
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('compression 安装失败。请把上面的 npm 错误截图发给我。');
    process.exit(1);
  }
} else {
  console.log('compression 依赖已经安装。');
}

console.log('\n服务器优化完成：');
console.log('- Socket.IO 心跳 20s/10s');
console.log('- HTTP 响应压缩（>= 1KB）');
console.log('- 本地静态资源浏览器缓存 1 小时');
console.log('- API / Socket.IO 实时数据不会被静态缓存');
