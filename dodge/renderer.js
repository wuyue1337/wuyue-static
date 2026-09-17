'use strict';

// Small, local WebGL renderer: real 3D meshes with an orthographic MOBA camera.
window.createDodgeRenderer = function createDodgeRenderer(canvas, labelsCanvas) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: true, powerPreference: 'low-power' });
  const labels = labelsCanvas.getContext('2d');
  const RIGHT = [0.894, 0, -0.447];
  const UP = [-0.349, 0.625, -0.698];
  const SX = .16, SY = .22;
  const toWorld = (x, y) => [(x - 500) / 100, (y - 300) / 100];
  function project(x, y, z) {
    return [500 + 500 * SX * (RIGHT[0] * x + RIGHT[2] * z),
      300 - 300 * SY * (UP[0] * x + UP[1] * y + UP[2] * z)];
  }
  function screenToArena(clientX, clientY, rect) {
    const u = (2 * (clientX - rect.left) / rect.width - 1) / SX;
    const v = (1 - 2 * (clientY - rect.top) / rect.height) / SY;
    const determinant = RIGHT[0] * UP[2] - RIGHT[2] * UP[0];
    const x = (u * UP[2] - RIGHT[2] * v) / determinant;
    const z = (RIGHT[0] * v - UP[0] * u) / determinant;
    return { x: Math.max(18, Math.min(982, 500 + x * 100)), y: Math.max(18, Math.min(582, 300 + z * 100)) };
  }
  if (!gl) {
    return { available: false, screenToArena, render() {
      labels.clearRect(0, 0, 1000, 600);
      labels.fillStyle = '#e5c785'; labels.font = 'bold 24px Microsoft YaHei'; labels.textAlign = 'center';
      labels.fillText('当前浏览器未启用 WebGL，无法显示立体训练场', 500, 300);
    } };
  }
  const vertexSource = `
    attribute vec3 a_position;
    attribute vec3 a_color;
    varying vec3 v_color;
    void main() {
      float x = dot(a_position, vec3(0.894, 0.0, -0.447)) * 0.16;
      float y = dot(a_position, vec3(-0.349, 0.625, -0.698)) * 0.22;
      float z = -dot(a_position, vec3(0.28, 0.78, 0.56)) * 0.06;
      gl_Position = vec4(x, y, z, 1.0);
      v_color = a_color;
    }
  `;
  const fragmentSource = `
    precision mediump float;
    varying vec3 v_color;
    void main() { gl_FragColor = vec4(v_color, 1.0); }
  `;
  function shader(type, source) {
    const item = gl.createShader(type);
    gl.shaderSource(item, source); gl.compileShader(item);
    if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(item));
    return item;
  }
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const colorLocation = gl.getAttribLocation(program, 'a_color');
  const staticBuffer = gl.createBuffer();
  const dynamicBuffer = gl.createBuffer();
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(.035, .085, .12, 1);

  function color(hex, light = 1) {
    const raw = hex.replace('#', '');
    return [parseInt(raw.slice(0, 2), 16) / 255 * light,
      parseInt(raw.slice(2, 4), 16) / 255 * light,
      parseInt(raw.slice(4, 6), 16) / 255 * light];
  }
  function vertex(out, p, rgb) { out.push(p[0], p[1], p[2], rgb[0], rgb[1], rgb[2]); }
  function tri(out, a, b, c, rgb) { vertex(out, a, rgb); vertex(out, b, rgb); vertex(out, c, rgb); }
  function quad(out, a, b, c, d, rgb) { tri(out, a, b, c, rgb); tri(out, a, c, d, rgb); }
  function plane(out, x1, x2, z1, z2, y, rgb) {
    quad(out, [x1, y, z1], [x2, y, z1], [x2, y, z2], [x1, y, z2], rgb);
  }
  function box(out, x, y, z, w, h, d, hex) {
    const a = x - w / 2, b = x + w / 2, c = z - d / 2, e = z + d / 2, top = y + h;
    const base = color(hex);
    quad(out, [a, top, c], [b, top, c], [b, top, e], [a, top, e], base);
    quad(out, [a, y, e], [b, y, e], [b, top, e], [a, top, e], base.map(v => v * .7));
    quad(out, [b, y, c], [b, y, e], [b, top, e], [b, top, c], base.map(v => v * .82));
    quad(out, [a, y, c], [a, y, e], [a, top, e], [a, top, c], base.map(v => v * .55));
    quad(out, [a, y, c], [b, y, c], [b, top, c], [a, top, c], base.map(v => v * .62));
  }
  function octa(out, x, y, z, r, hex) {
    const top = [x, y + r * 1.35, z], bottom = [x, y - r * .8, z];
    const ring = [[x + r, y, z], [x, y, z + r], [x - r, y, z], [x, y, z - r]];
    const base = color(hex);
    for (let i = 0; i < 4; i++) {
      tri(out, top, ring[i], ring[(i + 1) % 4], base.map(v => v * (1 - i * .09)));
      tri(out, bottom, ring[(i + 1) % 4], ring[i], base.map(v => v * (.55 + i * .055)));
    }
  }
  function disc(out, x, y, z, radius, hex, inner = 0) {
    const c = color(hex);
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8, b = (i + 1) * Math.PI / 8;
      const outerA = [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius];
      const outerB = [x + Math.cos(b) * radius, y, z + Math.sin(b) * radius];
      if (!inner) tri(out, [x, y, z], outerA, outerB, c);
      else quad(out, [x + Math.cos(a) * inner, y, z + Math.sin(a) * inner], outerA, outerB,
        [x + Math.cos(b) * inner, y, z + Math.sin(b) * inner], c);
    }
  }
  function tree(out, x, z, size) {
    box(out, x, -.03, z, .12 * size, .4 * size, .12 * size, '#574b38');
    octa(out, x, .5 * size, z, .42 * size, '#246b63');
    octa(out, x, .7 * size, z, .28 * size, '#368077');
  }
  const ground = [];
  // Tiled earth, stone lane and raised vegetation are built once and kept on the GPU.
  for (let ix = 0; ix < 12; ix++) for (let iz = 0; iz < 8; iz++) {
    const x1 = -5.4 + ix * .9, x2 = x1 + .89, z1 = -3.6 + iz * .9, z2 = z1 + .89;
    const lane = Math.abs((z1 + z2) / 2) < .94;
    const shade = (ix * 7 + iz * 11) % 4;
    plane(ground, x1, x2, z1, z2, -.09, color(lane ? ['#395459', '#405a5b', '#3c5658', '#496062'][shade]
      : ['#173c3e', '#1b4645', '#20504b', '#1c4442'][shade]));
  }
  for (let x = -5; x < 5; x += .75) {
    plane(ground, x, x + .18, -.025, .025, -.07, color('#b49865'));
  }
  for (const [x, z, size] of [[-4.7,-2.6,.8],[-3.7,-3,.65],[-1.8,-2.8,.7],[.6,-2.8,.7],[2.8,-2.9,.75],[4.7,-2.4,.7],[-4.6,2.7,.8],[-3,2.8,.65],[-.8,3,.65],[1.9,2.8,.8],[4.3,2.7,.8]]) tree(ground, x, z, size);
  for (const [x, z] of [[-4.8,-.95],[4.8,.95]]) {
    box(ground, x, -.08, z, .5, .22, .5, '#697874');
    box(ground, x, .14, z, .33, .65, .33, '#6d817d');
    octa(ground, x, .94, z, .22, '#b9a56f');
  }
  const groundData = new Float32Array(ground);
  gl.bindBuffer(gl.ARRAY_BUFFER, staticBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, groundData, gl.STATIC_DRAW);

  function draw(buffer, count) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 24, 12);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }
  function render(state, session, target, age) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    draw(staticBuffer, groundData.length / 6);
    labels.clearRect(0, 0, 1000, 600);
    if (!state) {
      labels.textAlign = 'center'; labels.fillStyle = '#f0d39b'; labels.font = 'bold 25px Microsoft YaHei';
      labels.fillText('峡谷走位训练', 500, 300);
      return;
    }
    const entities = [];
    if (target && state.phase === 'running') {
      const [tx, tz] = toWorld(target.x, target.y);
      disc(entities, tx, -.048, tz, .23, '#d9bb74', .19);
    }
    for (const bullet of state.bullets) {
      const x = bullet.x + (bullet.windup > 0 ? 0 : bullet.vx * age);
      const y = bullet.y + (bullet.windup > 0 ? 0 : bullet.vy * age);
      const [wx, wz] = toWorld(x, y);
      const kindColor = bullet.kind === 'heavy' ? '#f8a264' : bullet.kind === 'swift' ? '#f77a9f' : '#8ee6da';
      if (bullet.windup > 0) disc(entities, wx, -.045, wz, Math.max(.15, bullet.r / 80), kindColor, Math.max(.12, bullet.r / 100));
      else {
        const radius = Math.max(.11, bullet.r / 75);
        disc(entities, wx, -.045, wz, radius * 1.5, '#314e53');
        octa(entities, wx, .3, wz, radius, kindColor);
      }
    }
    for (const p of state.players) {
      const [x, z] = toWorld(p.x, p.y);
      const isMe = p.id === session?.playerId;
      const primary = p.hp ? isMe ? '#d8bd7d' : '#4ed1c4' : '#65757a';
      disc(entities, x, -.04, z, .32, isMe ? '#b59b63' : '#2b8f88', .28);
      // A simple armored champion silhouette: boots, cloak, torso, arms, head and weapon.
      quad(entities, [x - .2, .68, z + .13], [x + .2, .68, z + .13],
        [x + .34, .05, z + .34], [x - .34, .05, z + .34], color(isMe ? '#8d7558' : '#256c69'));
      box(entities, x - .11, 0, z, .16, .28, .2, '#394854');
      box(entities, x + .11, 0, z, .16, .28, .2, '#394854');
      box(entities, x, .25, z, .43, .48, .3, primary);
      box(entities, x - .3, .32, z, .13, .42, .16, isMe ? '#b59560' : '#349c99');
      box(entities, x + .3, .32, z, .13, .42, .16, isMe ? '#b59560' : '#349c99');
      box(entities, x, .72, z, .31, .12, .3, isMe ? '#f2d7a0' : '#92ece1');
      octa(entities, x, .93, z, .22, isMe ? '#f4e1ba' : '#b6f4e9');
      octa(entities, x, 1.16, z, .2, isMe ? '#c5a35c' : '#289d9b');
      box(entities, x + .42, .45, z - .02, .07, .8, .08, isMe ? '#dddbd0' : '#d3eee7');
      octa(entities, x + .42, 1.3, z - .02, .12, isMe ? '#e9c374' : '#6ad9d0');
      if (p.hitUntil > 0) disc(entities, x, -.025, z, .4, '#ecde9e', .37);
      const [px, py] = project(x, 1.52, z);
      labels.textAlign = 'center'; labels.font = 'bold 13px Microsoft YaHei';
      labels.fillStyle = isMe ? '#ffdf9c' : '#b8fff1';
      labels.fillText(p.name, px, py - 5);
      labels.fillStyle = '#071e28'; labels.fillRect(px - 20, py + 1, 40, 5);
      labels.fillStyle = p.hp > 1 ? '#69d8be' : '#e67683'; labels.fillRect(px - 20, py + 1, 40 * p.hp / 3, 5);
    }
    const data = new Float32Array(entities);
    gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    draw(dynamicBuffer, data.length / 6);
  }
  return { available: true, screenToArena, render };
};
