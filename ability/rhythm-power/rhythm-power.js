(() => {
  'use strict';

  const durationOptions = [5, 10, 15, 20];
  const keyCountOptions = [4, 5, 6, 7];
  const boardRows = 700;
  const bindingsKey = 'rhythmPowerKeysV3';
  const defaultKeysByCount = {
    4: ['s', 'd', 'l', ';'],
    5: ['s', 'd', ' ', 'l', ';'],
    6: ['a', 's', 'd', 'l', ';', "'"],
    7: ['a', 's', 'd', ' ', 'l', ';', "'"]
  };
  const modeDefs = {
    random: { name: '纯随机', detail: '完全随机生成目标；成绩可提交到对应键数与时长排行榜。', ranked: true },
    'no-repeat': { name: '无纵连的随机', detail: '随机生成，但不会连续出现同一轨道。', ranked: false },
    'short-jack': { name: '短纵', detail: '同一轨连续出现两次，再切换到别的轨道。', ranked: false },
    'full-jack': { name: '全纵连', detail: '整局固定在同一条轨道，测试持续纵连处理。', ranked: false },
    alternation: { name: '交互', detail: '随机选两条不同轨道，整局持续来回交替。', ranked: false },
    stairs: { name: '楼梯', detail: '全部轨道按楼梯顺序往返循环。', ranked: false },
    'triple-jack': { name: '三纵', detail: '同一轨连续出现三次，再切换到别的轨道。', ranked: false }
  };

  const $ = id => document.getElementById(id);
  const pageShell = $('page-shell');
  const gameSession = $('game-session');
  const modeGrid = $('mode-grid');
  const keyCountRow = $('key-count-row');
  const durationRow = $('duration-row');
  const setupModeName = $('setup-mode-name');
  const setupModeDetail = $('setup-mode-detail');
  const startSessionButton = $('start-session');
  const leaveSessionButton = $('leave-session');
  const keyBindRow = $('key-bind-row');
  const resetKeysButton = $('reset-keys');

  const gameShell = $('game-shell');
  const tileBoard = $('tile-board');
  const tileTrack = $('tile-track');
  const startCover = $('start-cover');
  const coverTitle = $('cover-title');
  const coverDetail = $('cover-detail');
  const laneHead = $('lane-head');
  const keyPad = $('key-pad');

  const sessionMode = $('session-mode');
  const sessionRanked = $('session-ranked');
  const scoreText = $('score-text');
  const timeText = $('time-text');
  const speedText = $('speed-text');

  const boardTitle = $('power-board-title');

  const dialog = $('result-dialog');
  const resultMode = $('result-mode');
  const resultScore = $('result-score');
  const resultTime = $('result-time');
  const resultSpeed = $('result-speed');
  const resultBpm = $('result-bpm');
  const resultBest = $('result-best');
  const resultNote = $('result-note');
  const resultMenu = $('result-menu');
  const resultAgain = $('result-again');
  const submitLine = $('submit-line');
  const submitScoreButton = $('submit-score');
  const submitStatus = $('submit-status');

  let selectedMode = 'random';
  let selectedKeyCount = 4;
  let selectedDuration = 20;
  let bindings = loadBindings();
  let keys = keysForCount(selectedKeyCount);
  let rows = [];
  let activeIndex = 0;
  let rowHeight = 170;
  let armed = false;
  let started = false;
  let over = false;
  let score = 0;
  let startedAt = 0;
  let endedAt = 0;
  let lastResultStats = null;
  let timerRaf = 0;
  let readyTimer = 0;
  let bindingLane = null;
  let bindingStartLane = null;

  let displayOffset = 0;
  let targetOffset = 0;
  let motionVelocity = 0;
  let motionRaf = 0;
  let lastMotionAt = 0;

  function loadBindings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(bindingsKey));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}
    return {};
  }

  function normalizeKey(value) {
    if (value === 'Spacebar' || value === 'Space') return ' ';
    return typeof value === 'string' ? value.toLowerCase() : '';
  }

  function isBindableKey(value) { return typeof value === 'string' && value.length === 1; }
  function keysForCount(count) {
    const saved = bindings[count];
    if (Array.isArray(saved) && saved.length === count && saved.every(isBindableKey) && new Set(saved).size === count) return saved.map(normalizeKey);
    return [...defaultKeysByCount[count]];
  }
  function saveCurrentKeys() { bindings[selectedKeyCount] = [...keys]; localStorage.setItem(bindingsKey, JSON.stringify(bindings)); }
  function labelForKey(key) { if (key === ' ') return 'SPACE'; return key.toUpperCase(); }
  function labelForLane(lane) { return labelForKey(keys[lane]); }
  function keySummary() { return keys.map(labelForKey).join(' · '); }

  function renderKeyControls() {
    keyBindRow.innerHTML = ''; laneHead.innerHTML = ''; keyPad.innerHTML = '';
    gameShell.style.setProperty('--lanes', String(selectedKeyCount));
    for (let lane = 0; lane < selectedKeyCount; lane++) {
      const label = labelForLane(lane);
      const bind = document.createElement('button'); bind.type = 'button'; bind.className = 'key-bind'; bind.dataset.bindLane = String(lane); bind.textContent = label; keyBindRow.appendChild(bind);
      const head = document.createElement('span'); head.textContent = label; laneHead.appendChild(head);
      const pad = document.createElement('button'); pad.type = 'button'; pad.dataset.lane = String(lane); pad.textContent = label; keyPad.appendChild(pad);
    }
    resetKeysButton.title = `默认：${defaultKeysByCount[selectedKeyCount].map(labelForKey).join(' / ')}`;
  }

  function updateSetupSummary() {
    setupModeName.textContent = `${selectedKeyCount}K · ${modeDefs[selectedMode].name} · ${selectedDuration} 秒`;
    setupModeDetail.textContent = modeDefs[selectedMode].ranked
      ? `完全随机生成目标；成绩可提交到 ${selectedKeyCount}K / ${selectedDuration} 秒排行榜。当前键位：${keySummary()}`
      : `${modeDefs[selectedMode].detail} 练习模式不计入排行榜。`;
    boardTitle.textContent = `纯随机排行榜 · ${selectedKeyCount}K · ${selectedDuration} 秒`;
  }
  function selectMode(mode) {
    if (!modeDefs[mode]) return; selectedMode = mode;
    for (const card of modeGrid.querySelectorAll('[data-mode]')) { const active = card.dataset.mode === mode; card.classList.toggle('active', active); card.setAttribute('aria-pressed', String(active)); }
    updateSetupSummary();
  }
  function selectKeyCount(count) {
    if (!keyCountOptions.includes(count)) return; endBinding(); selectedKeyCount = count; keys = keysForCount(count);
    for (const button of keyCountRow.querySelectorAll('[data-keys]')) button.classList.toggle('active', Number(button.dataset.keys) === count);
    renderKeyControls(); updateSetupSummary(); loadLeaderboard();
  }
  function selectDuration(seconds) {
    if (!durationOptions.includes(seconds)) return; selectedDuration = seconds;
    for (const button of durationRow.querySelectorAll('[data-duration]')) button.classList.toggle('active', Number(button.dataset.duration) === seconds);
    updateSetupSummary(); loadLeaderboard();
  }
  function endBinding() { bindingLane = null; bindingStartLane = null; renderKeyControls(); updateSetupSummary(); }
  function beginBinding(lane) {
    bindingLane = lane; bindingStartLane = lane;
    for (const button of keyBindRow.querySelectorAll('.key-bind')) button.classList.remove('waiting', 'done');
    const button = keyBindRow.querySelector(`[data-bind-lane="${lane}"]`); if (button) { button.classList.add('waiting'); button.textContent = '…'; }
  }
  function advanceBinding() {
    const finishedLane = bindingLane, finishedButton = keyBindRow.querySelector(`[data-bind-lane="${finishedLane}"]`);
    if (finishedButton) { finishedButton.classList.remove('waiting'); finishedButton.classList.add('done'); finishedButton.textContent = labelForLane(finishedLane); }
    bindingLane += 1;
    if (bindingLane >= selectedKeyCount) {
      saveCurrentKeys(); bindingLane = null; bindingStartLane = null;
      setTimeout(() => { renderKeyControls(); updateSetupSummary(); }, 180); return;
    }
    const next = keyBindRow.querySelector(`[data-bind-lane="${bindingLane}"]`); if (next) { next.classList.add('waiting'); next.textContent = '…'; }
  }

  function bestStorageKey() { return `rhythmPowerBest:${selectedKeyCount}:${selectedMode}:${selectedDuration}`; }
  function getBest() { const value = Number(localStorage.getItem(bestStorageKey())); return Number.isSafeInteger(value) && value >= 0 ? value : 0; }
  function setBest(value) { if (value > getBest()) localStorage.setItem(bestStorageKey(), String(value)); }
  function randomLane(except = -1) { let lane = Math.floor(Math.random() * selectedKeyCount); if (selectedKeyCount > 1 && except >= 0) while (lane === except) lane = Math.floor(Math.random() * selectedKeyCount); return lane; }

  function createPlaySequence(mode, count) {
    const seq = [];
    if (mode === 'random') { for (let i = 0; i < count; i++) seq.push(randomLane()); return seq; }
    if (mode === 'no-repeat') { let previous = -1; for (let i = 0; i < count; i++) { const lane = randomLane(previous); seq.push(lane); previous = lane; } return seq; }
    if (mode === 'full-jack') { const lane = randomLane(); return Array.from({ length: count }, () => lane); }
    if (mode === 'alternation') { const a = randomLane(), b = randomLane(a); for (let i = 0; i < count; i++) seq.push(i % 2 === 0 ? a : b); return seq; }
    if (mode === 'stairs') {
      const forward = Array.from({ length: selectedKeyCount }, (_, i) => i), backward = Array.from({ length: Math.max(0, selectedKeyCount - 2) }, (_, i) => selectedKeyCount - 2 - i), base = [...forward, ...backward];
      const pattern = Math.random() < .5 ? base : base.map(lane => selectedKeyCount - 1 - lane); for (let i = 0; i < count; i++) seq.push(pattern[i % pattern.length]); return seq;
    }
    const group = mode === 'triple-jack' ? 3 : 2; let previousLane = -1;
    while (seq.length < count) { const lane = randomLane(previousLane); previousLane = lane; for (let i = 0; i < group && seq.length < count; i++) seq.push(lane); }
    return seq;
  }
  function isAlternateToneLane(lane) { if (selectedKeyCount === 5) return lane === 1 || lane === 3; if (selectedKeyCount === 6) return lane === 1 || lane === 4; if (selectedKeyCount === 7) return lane === 1 || lane === 3 || lane === 5; return false; }
  function createRow(lane) {
    const row = document.createElement('div'); row.className = 'tile-row'; row.dataset.lane = String(lane);
    for (let i = 0; i < selectedKeyCount; i++) { const cell = document.createElement('div'), target = i === lane; cell.className = `tile-cell${target ? ' target' : ''}${target && isAlternateToneLane(i) ? ' tone-alt' : ''}`; cell.dataset.lane = String(i); row.appendChild(cell); }
    return row;
  }
  function syncGeometry() { const width = tileBoard?.clientWidth || 680; rowHeight = width / selectedKeyCount; tileBoard.style.setProperty('--row-size', `${rowHeight}px`); }
  function refreshActiveRow() { tileTrack.querySelector('.tile-row.active')?.classList.remove('active'); tileTrack.children[activeIndex]?.classList.add('active'); }
  function buildBoard() {
    syncGeometry(); const playSequence = createPlaySequence(selectedMode, boardRows); rows = [...playSequence].reverse(); activeIndex = rows.length - 1; tileTrack.innerHTML = '';
    const fragment = document.createDocumentFragment(); for (const lane of rows) fragment.appendChild(createRow(lane)); tileTrack.appendChild(fragment);
    displayOffset = 0; targetOffset = 0; motionVelocity = 0; tileTrack.style.transform = 'translate3d(0,0,0)'; refreshActiveRow();
  }

  function durationMs() { return selectedDuration * 1000; }
  function elapsedMs(now = performance.now()) { if (!started) return 0; return Math.max(0, Math.min(durationMs(), now - startedAt)); }
  function speed(now = performance.now()) { const elapsed = elapsedMs(now); return elapsed > 0 ? score / (elapsed / 1000) : 0; }
  function updateHud(now = performance.now()) { scoreText.textContent = String(score); const total = durationMs(), left = started ? Math.max(0, total - (now - startedAt)) : total; timeText.textContent = (left / 1000).toFixed(1); speedText.textContent = speed(now).toFixed(2); }
  function timerLoop(now) { if (!started || over) return; updateHud(now); if (now - startedAt >= durationMs()) { finish('time'); return; } timerRaf = requestAnimationFrame(timerLoop); }

  function motionLoop(now) {
    const dt = Math.min(0.028, (lastMotionAt ? now - lastMotionAt : 16.67) / 1000); lastMotionAt = now; const distance = targetOffset - displayOffset;
    const spring = 330, damping = 33, acceleration = distance * spring - motionVelocity * damping;
    motionVelocity += acceleration * dt; displayOffset += motionVelocity * dt;
    if (displayOffset > targetOffset) { displayOffset = targetOffset; motionVelocity = 0; }
    if (Math.abs(targetOffset - displayOffset) < .05 && Math.abs(motionVelocity) < .8) { displayOffset = targetOffset; motionVelocity = 0; tileTrack.style.transform = `translate3d(0,${displayOffset.toFixed(3)}px,0)`; motionRaf = 0; lastMotionAt = 0; return; }
    tileTrack.style.transform = `translate3d(0,${displayOffset.toFixed(3)}px,0)`; motionRaf = requestAnimationFrame(motionLoop);
  }
  function kickMotion() { if (!motionRaf) { lastMotionAt = 0; motionRaf = requestAnimationFrame(motionLoop); } }
  function activeLane() { return rows[activeIndex]; }
  function pulseKey(lane) { const button = keyPad.querySelector(`[data-lane="${lane}"]`); if (!button) return; button.classList.add('pressed'); setTimeout(() => button.classList.remove('pressed'), 55); }
  function markWrong(lane) { tileTrack.children[activeIndex]?.querySelector(`[data-lane="${lane}"]`)?.classList.add('bad'); }
  function advanceRow() { tileTrack.children[activeIndex]?.querySelector('.target')?.classList.add('hit'); activeIndex -= 1; if (activeIndex < 0) { finish('time'); return; } targetOffset += rowHeight; refreshActiveRow(); kickMotion(); }
  function beginTimer() { if (started) return; started = true; startedAt = performance.now(); cancelAnimationFrame(timerRaf); timerRaf = requestAnimationFrame(timerLoop); }
  function pressLane(lane) {
    if (!armed || over) return; pulseKey(lane); const correct = lane === activeLane(); if (!started && !correct) return;
    if (!correct) { markWrong(lane); finish('wrong'); return; }
    if (!started) beginTimer(); score += 1; updateHud(); advanceRow();
  }

  function laneFromPointer(event) {
    const rect = tileBoard.getBoundingClientRect();
    if (!rect.width) return -1;
    const x = Math.max(0, Math.min(rect.width - 0.001, event.clientX - rect.left));
    return Math.max(0, Math.min(selectedKeyCount - 1, Math.floor(x / (rect.width / selectedKeyCount))));
  }

  function handleTrackPointer(event) {
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
    if (event.pointerType === 'mouse' && !coarsePointer) return;
    if (gameSession.hidden || over) return;
    const lane = laneFromPointer(event);
    if (lane < 0) return;
    event.preventDefault();
    pressLane(lane);
  }

  function prepareRound() {
    clearTimeout(readyTimer); cancelAnimationFrame(timerRaf); cancelAnimationFrame(motionRaf); timerRaf = 0; motionRaf = 0; lastMotionAt = 0; motionVelocity = 0;
    armed = false; started = false; over = false; score = 0; startedAt = 0; endedAt = 0; lastResultStats = null;
    renderKeyControls(); buildBoard(); updateHud(); sessionMode.textContent = `${selectedKeyCount}K · ${modeDefs[selectedMode].name}`; sessionRanked.hidden = !modeDefs[selectedMode].ranked;
    startCover.hidden = false; coverTitle.textContent = `${selectedKeyCount}K · ${modeDefs[selectedMode].name}`; coverDetail.textContent = `准备 · 看最底下一格，按对第一键后开始 ${selectedDuration} 秒计时`;
    readyTimer = setTimeout(() => { startCover.hidden = true; armed = true; }, 520);
  }
  function enterSession() { endBinding(); gameSession.hidden = false; pageShell.classList.add('session-hidden'); document.body.classList.add('session-active'); prepareRound(); }
  function leaveSession() { clearTimeout(readyTimer); cancelAnimationFrame(timerRaf); cancelAnimationFrame(motionRaf); armed = false; started = false; over = true; if (dialog.open) dialog.close(); gameSession.hidden = true; pageShell.classList.remove('session-hidden'); document.body.classList.remove('session-active'); loadLeaderboard(); }

  function finish(reason) {
    if (over || !armed) return; over = true; armed = false; endedAt = performance.now(); cancelAnimationFrame(timerRaf);
    const elapsed = started ? Math.min(durationMs(), Math.max(0, endedAt - startedAt)) : 0, avg = elapsed > 0 ? score / (elapsed / 1000) : 0, bpm = elapsed > 0 ? score * 15000 / elapsed : 0;
    lastResultStats = { elapsedMs: Math.round(elapsed), avgSpeed: avg, bpm };
    setBest(score); updateHud(endedAt); if (reason === 'time') timeText.textContent = '0.0';
    resultMode.textContent = `${selectedKeyCount}K · ${modeDefs[selectedMode].name} · ${selectedDuration} 秒`; resultScore.textContent = String(score); resultTime.textContent = `${(elapsed / 1000).toFixed(2)}s`; resultSpeed.textContent = `${avg.toFixed(2)}/s`; resultBpm.textContent = bpm.toFixed(1); resultBest.textContent = String(getBest());
    submitLine.hidden = !modeDefs[selectedMode].ranked; submitScoreButton.disabled = false; submitStatus.textContent = '';
    resultNote.textContent = modeDefs[selectedMode].ranked ? `${selectedKeyCount}K / ${selectedDuration} 秒纯随机使用独立排行榜。登录账号后可以提交本局成绩。` : `${modeDefs[selectedMode].name}目前作为练习模式，不计入正式排行榜。`;
    setTimeout(() => { if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); }, reason === 'wrong' ? 170 : 40);
  }

  function loadLeaderboard() {
    window.dispatchEvent(new CustomEvent('wuyue:rhythm-power-leaderboard-refresh'));
  }

  async function submitScore() {
    if (!modeDefs[selectedMode].ranked || !lastResultStats?.elapsedMs) return;
    try {
      if (!window.WuyueScoreAuth?.ensureAccount) throw new Error('账号组件加载失败，请刷新页面重试');
      await window.WuyueScoreAuth.ensureAccount();
    } catch (error) {
      submitStatus.textContent = error.message;
      return;
    }
    submitScoreButton.disabled = true; submitStatus.textContent = '提交中…';
    try {
      const response = await fetch('/api/leaderboard/rhythm-power', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duration: selectedDuration, keys: selectedKeyCount, score, elapsedMs: lastResultStats.elapsedMs }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '提交失败'); const personal = data.viewer?.personal; submitStatus.textContent = data.improved === false ? '未超过已有个人最好纪录' : personal?.total > 1 ? `个人最好纪录已更新 · 超过 ${personal.percentile}% 的上榜玩家` : '个人最好纪录已更新'; await loadLeaderboard();
    } catch (error) { submitStatus.textContent = error.message; submitScoreButton.disabled = false; }
  }

  modeGrid.addEventListener('click', event => { const card = event.target.closest('[data-mode]'); if (card) selectMode(card.dataset.mode); });
  keyCountRow.addEventListener('click', event => { const button = event.target.closest('[data-keys]'); if (button) selectKeyCount(Number(button.dataset.keys)); });
  durationRow.addEventListener('click', event => { const button = event.target.closest('[data-duration]'); if (button) selectDuration(Number(button.dataset.duration)); });
  keyBindRow.addEventListener('click', event => { const button = event.target.closest('[data-bind-lane]'); if (button) beginBinding(Number(button.dataset.bindLane)); });
  resetKeysButton.addEventListener('click', () => { bindingLane = null; bindingStartLane = null; keys = [...defaultKeysByCount[selectedKeyCount]]; saveCurrentKeys(); renderKeyControls(); updateSetupSummary(); });

  document.addEventListener('keydown', event => {
    const key = normalizeKey(event.key);
    if (bindingLane !== null && gameSession.hidden) {
      event.preventDefault(); if (key === 'escape') { endBinding(); return; } if (event.ctrlKey || event.altKey || event.metaKey || !isBindableKey(key)) return;
      const previousKey = keys[bindingLane];
      const duplicateLane = keys.findIndex((value, index) => value === key && index !== bindingLane);
      if (duplicateLane !== -1) {
        keys[duplicateLane] = previousKey;
        const swappedButton = keyBindRow.querySelector(`[data-bind-lane="${duplicateLane}"]`);
        if (swappedButton && duplicateLane !== bindingLane) swappedButton.textContent = labelForLane(duplicateLane);
      }
      keys[bindingLane] = key;
      const currentButton = keyBindRow.querySelector(`[data-bind-lane="${bindingLane}"]`); if (currentButton) currentButton.textContent = labelForLane(bindingLane); advanceBinding(); return;
    }
    if (!gameSession.hidden) {
      if (key === 'escape') { event.preventDefault(); leaveSession(); return; } if (event.repeat) return;
      const lane = keys.indexOf(key); if (lane !== -1) { event.preventDefault(); pressLane(lane); return; }
      if (key === 'r') { event.preventDefault(); if (dialog.open) dialog.close(); prepareRound(); }
    }
  });

  tileBoard.addEventListener('pointerdown', handleTrackPointer, { passive: false });
  keyPad.addEventListener('pointerdown', event => { const button = event.target.closest('[data-lane]'); if (!button) return; event.preventDefault(); pressLane(Number(button.dataset.lane)); });
  startSessionButton.addEventListener('click', enterSession); leaveSessionButton.addEventListener('click', leaveSession); submitScoreButton.addEventListener('click', submitScore); resultMenu.addEventListener('click', leaveSession); resultAgain.addEventListener('click', () => { dialog.close(); prepareRound(); });
  window.addEventListener('resize', () => { if (gameSession.hidden) return; syncGeometry(); const steps = rows.length - 1 - activeIndex; targetOffset = steps * rowHeight; displayOffset = targetOffset; motionVelocity = 0; tileTrack.style.transform = `translate3d(0,${displayOffset}px,0)`; });
  window.addEventListener('touchmove', event => { if (!gameSession.hidden) event.preventDefault(); }, { passive: false });

  renderKeyControls(); selectMode('random');
  {
    const params = new URLSearchParams(location.search);
    const linkedKeys = Number(params.get('keys'));
    const linkedDuration = Number(params.get('duration'));
    if (keyCountOptions.includes(linkedKeys)) selectKeyCount(linkedKeys);
    if (durationOptions.includes(linkedDuration)) selectDuration(linkedDuration);
  }
  updateSetupSummary(); loadLeaderboard();
})();
