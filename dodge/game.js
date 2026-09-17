'use strict';

const socket = io('/dodge', { reconnection: true });
const canvas = document.getElementById('arena');
const renderer = createDodgeRenderer(canvas, document.getElementById('arena-labels'));
const setupPanel = document.getElementById('setup-panel');
const playPanel = document.getElementById('play-panel');
const setupStatus = document.getElementById('setup-status');
const playStatus = document.getElementById('play-status');
const playerNameInput = document.getElementById('player-name');
const roomInput = document.getElementById('room-code');
const overlay = document.getElementById('arena-overlay');
const startButton = document.getElementById('start-button');
const dialog = document.getElementById('result-dialog');
const scoreForm = document.getElementById('score-form');
const scoreName = document.getElementById('score-name');
const scoreStatus = document.getElementById('score-status');
const leaderboard = createLeaderboard('dodge', document.getElementById('dodge-board'), document.getElementById('dodge-board-meta'));
const storedName = localStorage.getItem('wuyue-dodge-name') || '';
playerNameInput.value = storedName;

let session = null;
let state = null;
let proof = null;
let resultScore = null;
let lastStateAt = performance.now();
let target = null;
let submitting = false;
let renderedResult = false;
let roomMode = null;
let lastRound = 0;
let lastPlayerList = '';
let animationFrame = 0;
let lastPaint = 0;

function seconds(ms) { return (Math.max(0, ms) / 1000).toFixed(1); }
function setStatus(text, where = setupStatus) { where.textContent = text; }
function remember() {
  const name = playerNameInput.value.trim();
  if (name) localStorage.setItem('wuyue-dodge-name', name);
  else localStorage.removeItem('wuyue-dodge-name');
  return name;
}
function saveSession(value) {
  session = value;
  if (value) sessionStorage.setItem('wuyue-dodge-session', JSON.stringify(value));
  else sessionStorage.removeItem('wuyue-dodge-session');
}
function emitAck(event, data) {
  return new Promise((resolve, reject) => {
    if (!socket.connected) return reject(new Error('连接中，请稍后再试'));
    socket.timeout(6000).emit(event, data, (error, response) => {
      if (error) reject(new Error('连接超时，请重试'));
      else if (!response?.ok) reject(new Error(response?.error || '操作失败'));
      else resolve(response);
    });
  });
}
function enter(response, mode) {
  saveSession({ code: response.code, playerId: response.playerId, token: response.token });
  roomMode = mode;
  setupPanel.hidden = true;
  playPanel.hidden = false;
  document.getElementById('room-pill').textContent = `${mode === 'solo' ? '单人训练' : '联机房间'} · ${response.code}`;
  proof = response.proof || null;
  resultScore = null;
  renderedResult = false;
  lastRound = 0;
  target = null;
  scoreForm.hidden = false;
  scoreForm.querySelector('button').disabled = false;
  scoreForm.querySelector('button').textContent = '提交成绩';
  scoreStatus.textContent = '';
  if (response.state) renderState(response.state);
  else if (state?.code === response.code) renderState(state);
  schedulePaint();
  playPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function create(mode) {
  if (!renderer.available) return setStatus('当前浏览器未开启 3D 图形加速，暂时无法开始训练。');
  setStatus('正在连接训练场…');
  try {
    const response = await emitAck('dodge_create', { mode, name: remember() });
    enter(response, mode);
    setStatus('');
  } catch (error) { setStatus(error.message); }
}
async function join() {
  if (!renderer.available) return setStatus('当前浏览器未开启 3D 图形加速，暂时无法加入训练。');
  const code = roomInput.value.trim().toUpperCase();
  if (!/^[A-F0-9]{6}$/.test(code)) return setStatus('请输入正确的 6 位房间码');
  setStatus('正在加入房间…');
  try {
    const response = await emitAck('dodge_join', { code, name: remember() });
    enter(response, 'multi'); setStatus('');
  } catch (error) { setStatus(error.message); }
}
function leave() {
  if (socket.connected) socket.emit('dodge_leave');
  saveSession(null); session = null; state = null; proof = null; resultScore = null;
  if (dialog.open) dialog.close();
  playPanel.hidden = true; setupPanel.hidden = false;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  setupPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderState(next) {
  if (next.phase === 'running' && next.round > lastRound && lastRound > 0) renderedResult = false;
  lastRound = next.round;
  state = next;
  lastStateAt = performance.now();
  schedulePaint();
  if (!session) return;
  roomMode = next.mode;
  document.getElementById('room-pill').textContent = `${next.mode === 'solo' ? '单人训练' : '联机房间'} · ${next.code}`;
  document.getElementById('arena-title').textContent = next.phase === 'lobby' ? '等待召唤师集结' : next.phase === 'running' ? 'DODGE' : '本局已结束';
  document.getElementById('time-display').innerHTML = `${seconds(next.elapsed)} <span>秒</span>`;
  document.getElementById('bullet-display').textContent = String(next.bullets.length);
  const me = next.players.find(p => p.id === session.playerId);
  document.getElementById('health-display').textContent = me ? `${'● '.repeat(me.hp)}${'○ '.repeat(3 - me.hp)}`.trim() : '—';
  document.getElementById('player-count').textContent = `${next.players.length} / 6`;
  const list = document.getElementById('players-list');
  const listSignature = next.phase + next.hostId + next.players.map(p => `${p.id}:${p.name}:${p.hp}:${p.connected}:${p.hp ? '' : Math.floor(p.score / 1000)}`).join('|');
  if (listSignature !== lastPlayerList) {
    lastPlayerList = listSignature;
    list.replaceChildren();
    for (const p of next.players) {
      const row = document.createElement('li');
      const dot = document.createElement('span'); dot.className = `player-dot${p.hp ? '' : ' dead'}`;
      const name = document.createElement('span'); name.className = 'player-name'; name.textContent = p.name + (p.id === session.playerId ? '（你）' : '');
      const badge = document.createElement('span'); badge.className = 'player-badge'; badge.textContent = p.id === next.hostId ? '房主' : !p.connected ? '离线' : '';
      const hp = document.createElement('span'); hp.className = 'player-hp'; hp.textContent = next.phase === 'lobby' ? '' : p.hp ? '●'.repeat(p.hp) : `${seconds(p.score)}s`;
      row.append(dot, name, badge, hp); list.append(row);
    }
  }
  overlay.hidden = next.phase !== 'lobby';
  startButton.hidden = next.hostId !== session.playerId;
  startButton.disabled = next.players.length < 2 || next.players.some(p => !p.connected);
  if (next.phase === 'running') {
    setStatus(me?.hp ? '右键点击地面移动。没有冲刺，只有走位。' : '你已被淘汰，可以继续观看朋友走位。', playStatus);
  } else if (next.phase === 'finished') {
    setStatus(next.mode === 'multi' ? '本局结束。房主可以带大家再来一局。' : '本局结束。可在结算弹窗中重新挑战。', playStatus);
  } else setStatus('分享房间码，等朋友加入后由房主开始。', playStatus);
  if (next.phase === 'finished' && renderedResult && next.mode === 'multi') {
    const rank = next.results?.findIndex(item => item.id === session.playerId) ?? -1;
    if (rank >= 0) document.getElementById('result-rank').textContent = `本房间第 ${rank + 1} / ${next.results.length} 名`;
  }
  if (next.phase === 'finished' && me && !renderedResult && (proof || resultScore !== null)) showResult();
}
function showResult() {
  if (renderedResult || resultScore === null) return;
  renderedResult = true;
  const rank = state?.results?.findIndex(item => item.id === session?.playerId) ?? -1;
  document.getElementById('result-time').textContent = seconds(resultScore);
  document.getElementById('result-rank').textContent = state?.mode === 'multi' ? rank >= 0 ? `本房间第 ${rank + 1} / ${state.results.length} 名` : '等待本房间最终名次' : '挑战你的个人最佳纪录';
  if (!scoreName.readOnly) scoreName.value = playerNameInput.value.trim() || storedName;
  document.getElementById('again-button').textContent = state?.mode === 'multi' ? (state.hostId === session?.playerId ? '房主再开一局' : '等待房主重开') : '再来一局';
  document.getElementById('again-button').disabled = state?.mode === 'multi' && state.hostId !== session?.playerId;
  if (!dialog.open) dialog.showModal();
}
socket.on('connect', async () => {
  setStatus('');
  if (!session) {
    try { session = JSON.parse(sessionStorage.getItem('wuyue-dodge-session') || 'null'); } catch { session = null; }
  }
  if (!session) return;
  try {
    const response = await emitAck('dodge_resume', session);
    enter(response, response.state.mode);
    if (response.state.phase === 'finished' && response.proof) {
      proof = response.proof;
      const me = response.state.players.find(p => p.id === session.playerId);
      resultScore = me?.score ?? null;
      showResult();
    }
  } catch (error) { saveSession(null); setStatus(error.message + '，请重新创建或加入房间。'); }
});
socket.on('disconnect', () => { if (session) setStatus('连接中断，正在尝试重连…', playStatus); else setStatus('连接中断，正在尝试重连…'); });
socket.on('dodge_replaced', () => { saveSession(null); leave(); setStatus('这个房间已在另一标签页打开。'); });
socket.on('dodge_state', renderState);
socket.on('dodge_hit', data => { if (data.hp) setStatus(`被命中！还剩 ${data.hp} 点生命。`, playStatus); });
socket.on('dodge_result', data => { proof = data.proof; resultScore = data.score; showResult(); });

document.getElementById('solo-button').addEventListener('click', () => create('solo'));
document.getElementById('create-button').addEventListener('click', () => create('multi'));
document.getElementById('join-button').addEventListener('click', join);
roomInput.addEventListener('keydown', event => { if (event.key === 'Enter') join(); });
document.getElementById('leave-room').addEventListener('click', leave);
document.getElementById('copy-room').addEventListener('click', async () => {
  if (!session) return;
  try { await navigator.clipboard.writeText(session.code); setStatus('房间码已复制。', playStatus); }
  catch { setStatus(`房间码：${session.code}`, playStatus); }
});
startButton.addEventListener('click', async () => {
  try { await emitAck('dodge_start', {}); }
  catch (error) { setStatus(error.message, playStatus); }
});
function move(event) {
  if (!state || state.phase !== 'running' || !session) return;
  const me = state.players.find(p => p.id === session.playerId);
  if (!me?.hp) return;
  target = renderer.screenToArena(event.clientX, event.clientY, canvas.getBoundingClientRect());
  socket.emit('dodge_move', target);
}
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointerdown', event => {
  const mobile = event.pointerType === 'touch' || event.pointerType === 'pen';
  if (!mobile && event.button !== 2) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  move(event);
});
document.getElementById('spectate-button').addEventListener('click', () => dialog.close());
document.getElementById('again-button').addEventListener('click', async () => {
  if (state?.mode === 'multi') {
    try { await emitAck('dodge_restart', {}); dialog.close(); renderedResult = false; }
    catch (error) { scoreStatus.textContent = error.message; }
  } else { dialog.close(); leave(); create('solo'); }
});
scoreForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || !proof || resultScore === null) return;
  submitting = true; scoreStatus.textContent = '正在提交…';
  const button = scoreForm.querySelector('button'); button.disabled = true;
  try {
    const response = await leaderboard.submit(scoreName.value.trim(), resultScore, undefined, proof);
    scoreStatus.textContent = response.improved ? `提交成功！当前排名第 ${response.rank} 名。` : `已保留此前更好的成绩（第 ${response.rank} 名）。`;
    proof = null; button.textContent = '已提交';
  } catch (error) { scoreStatus.textContent = error.message; button.disabled = false; }
  finally { submitting = false; }
});

function paint(now) {
  animationFrame = 0;
  if (playPanel.hidden || document.hidden) return;
  if (now - lastPaint >= 32 || state?.phase !== 'running') {
    lastPaint = now;
    const age = state?.phase === 'running' ? Math.min((now - lastStateAt) / 1000, .1) : 0;
    renderer.render(state, session, target, age);
  }
  if (state?.phase === 'running') animationFrame = requestAnimationFrame(paint);
}
function schedulePaint() {
  if (!animationFrame && !playPanel.hidden && !document.hidden) animationFrame = requestAnimationFrame(paint);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = 0; }
  else schedulePaint();
});
leaderboard.load();
