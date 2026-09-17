'use strict';

(() => {
  const modeButtons = [...document.querySelectorAll('[data-mode]')];
  const durationButtons = [...document.querySelectorAll('#duration-row [data-seconds]')];
  const boardTabs = [...document.querySelectorAll('#board-tabs [data-duration]')];
  const key1Bind = document.getElementById('key1-bind');
  const key2Bind = document.getElementById('key2-bind');
  const visualKey1 = document.getElementById('visual-key1');
  const visualKey2 = document.getElementById('visual-key2');
  const mouseEnabled = document.getElementById('mouse-enabled');
  const customWrap = document.getElementById('custom-time-wrap');
  const customTime = document.getElementById('custom-time');
  const startButton = document.getElementById('start-button');
  const stopButton = document.getElementById('stop-button');
  const stage = document.getElementById('tap-stage');
  const stageKicker = document.getElementById('stage-kicker');
  const stageMain = document.getElementById('stage-main');
  const stageDetail = document.getElementById('stage-detail');
  const status = document.getElementById('test-status');
  const timeLeft = document.getElementById('time-left');
  const tapCount = document.getElementById('tap-count');
  const currentBpm = document.getElementById('current-bpm');
  const averageBpm = document.getElementById('average-bpm');
  const peakBpm = document.getElementById('peak-bpm');
  const alternation = document.getElementById('alternation');
  const chart = document.getElementById('bpm-chart');
  const resultDialog = document.getElementById('result-dialog');
  const resultBpm = document.getElementById('result-bpm');
  const resultTaps = document.getElementById('result-taps');
  const resultPeak = document.getElementById('result-peak');
  const resultUr = document.getElementById('result-ur');
  const resultAlt = document.getElementById('result-alt');
  const resultNote = document.getElementById('result-note');
  const submitScore = document.getElementById('submit-score');
  const submitStatus = document.getElementById('submit-status');
  const resultClose = document.getElementById('result-close');
  const resultAgain = document.getElementById('result-again');
  const boardList = document.getElementById('osu-board-list');
  const boardMeta = document.getElementById('osu-board-meta');
  const boardPage = document.getElementById('board-page');
  const boardPrev = document.getElementById('board-prev');
  const boardNext = document.getElementById('board-next');
  const boardTitle = document.getElementById('osu-board-title');

  let mode = 'stream';
  let duration = 10;
  let key1 = localStorage.getItem('osu-stream-k1') || 'KeyZ';
  let key2 = localStorage.getItem('osu-stream-k2') || 'KeyX';
  let bindingSlot = null;
  let armed = false;
  let running = false;
  let startedAt = 0;
  let endAt = 0;
  let taps = [];
  let allMappedPresses = 0;
  let invalidAlternations = 0;
  let lastAcceptedSlot = null;
  let tickTimer = null;
  let chartTimer = null;
  let chartSamples = [];
  let latestResult = null;
  let boardDuration = 10;
  let boardCurrentPage = 1;
  let boardTotalPages = 1;

  function codeLabel(code) {
    if (!code) return '?';
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    return code.replace(/^Numpad/, 'Num ').replace(/^Arrow/, '').replace(/^Mouse/, 'M');
  }

  function syncKeys() {
    key1Bind.textContent = codeLabel(key1);
    key2Bind.textContent = codeLabel(key2);
    visualKey1.textContent = codeLabel(key1);
    visualKey2.textContent = codeLabel(key2);
  }

  function selectedDuration() {
    const active = durationButtons.find(button => button.classList.contains('active'));
    if (!active) return 10;
    if (active.dataset.seconds === 'custom') return Math.max(3, Math.min(120, Number(customTime.value) || 15));
    return Number(active.dataset.seconds);
  }

  function resetStats() {
    taps = [];
    allMappedPresses = 0;
    invalidAlternations = 0;
    lastAcceptedSlot = null;
    chartSamples = [];
    latestResult = null;
    tapCount.textContent = '0';
    currentBpm.textContent = '0.0';
    averageBpm.textContent = '0.0';
    peakBpm.textContent = '0.0';
    alternation.textContent = '100%';
    timeLeft.textContent = `${selectedDuration().toFixed(1)}s`;
    drawChart();
  }

  function localWindowBpm(now, windowMs = 1800) {
    const recent = taps.filter(t => now - t.time <= windowMs);
    if (recent.length < 2) return 0;
    const elapsed = recent[recent.length - 1].time - recent[0].time;
    if (elapsed <= 0) return 0;
    const tapsPerSecond = (recent.length - 1) * 1000 / elapsed;
    return tapsPerSecond * 15;
  }

  function overallBpm(now = performance.now()) {
    if (taps.length < 2 || !startedAt) return 0;
    const fullDurationMs = Math.max(1, duration * 1000);
    const elapsed = Math.max(1, Math.min(fullDurationMs, now - startedAt));
    return ((taps.length - 1) * 1000 / elapsed) * 15;
  }

  function estimatedUr() {
    if (taps.length < 4) return null;
    const xs = taps.map((_, index) => index);
    const ys = taps.map(item => item.time);
    const n = xs.length;
    const sx = xs.reduce((a,b) => a + b, 0);
    const sy = ys.reduce((a,b) => a + b, 0);
    const sxx = xs.reduce((a,b) => a + b*b, 0);
    const sxy = xs.reduce((a,b,i) => a + b*ys[i], 0);
    const denom = n * sxx - sx * sx;
    if (!denom) return null;
    const slope = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;
    const residuals = ys.map((y,i) => y - (intercept + slope * i));
    const mean = residuals.reduce((a,b) => a+b,0) / n;
    const variance = residuals.reduce((a,b) => a + (b-mean) ** 2, 0) / n;
    return Math.sqrt(variance) * 10;
  }

  function alternationAccuracy() {
    if (!allMappedPresses) return 100;
    return Math.max(0, Math.min(100, ((allMappedPresses - invalidAlternations) / allMappedPresses) * 100));
  }

  function flashKey(slot) {
    const target = slot === 1 ? visualKey1 : visualKey2;
    target.classList.add('hit');
    setTimeout(() => target.classList.remove('hit'), 55);
  }

  function beginRun(now) {
    running = true;
    armed = false;
    startedAt = now;
    duration = selectedDuration();
    endAt = startedAt + duration * 1000;
    stage.classList.remove('is-armed');
    stage.classList.add('is-running');
    stageKicker.textContent = 'STREAMING';
    stageMain.textContent = '保持节奏';
    stageDetail.textContent = mode === 'stream' ? '双键交替 · 保持稳定' : '自由 Tap · 全速输出';
    startButton.disabled = true;
    stopButton.disabled = false;
    status.textContent = '测试进行中';
    tickTimer = setInterval(updateLive, 50);
    chartTimer = setInterval(sampleChart, 250);
  }

  function acceptTap(slot, now) {
    if (!armed && !running) return;
    allMappedPresses++;
    if (mode === 'stream' && lastAcceptedSlot === slot) {
      invalidAlternations++;
      alternation.textContent = `${alternationAccuracy().toFixed(1)}%`;
      return;
    }
    if (!running) beginRun(now);
    taps.push({ time: now, slot });
    lastAcceptedSlot = slot;
    flashKey(slot);
    tapCount.textContent = String(taps.length);
    currentBpm.textContent = localWindowBpm(now).toFixed(1);
    averageBpm.textContent = overallBpm(now).toFixed(1);
    alternation.textContent = `${alternationAccuracy().toFixed(1)}%`;
  }

  function updateLive() {
    if (!running) return;
    const now = performance.now();
    const remain = Math.max(0, (endAt - now) / 1000);
    timeLeft.textContent = `${remain.toFixed(1)}s`;
    currentBpm.textContent = localWindowBpm(now).toFixed(1);
    averageBpm.textContent = overallBpm(now).toFixed(1);
    const currentPeak = Math.max(0, ...chartSamples.map(sample => sample.bpm), localWindowBpm(now));
    peakBpm.textContent = currentPeak.toFixed(1);
    if (now >= endAt) finishRun();
  }

  function sampleChart() {
    if (!running) return;
    const now = performance.now();
    chartSamples.push({ t: (now - startedAt) / 1000, bpm: localWindowBpm(now) });
    if (chartSamples.length > 500) chartSamples.shift();
    drawChart();
  }

  function drawChart() {
    const ctx = chart.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const cssW = chart.clientWidth || 900;
    const cssH = chart.clientHeight || 190;
    if (chart.width !== Math.round(cssW * ratio) || chart.height !== Math.round(cssH * ratio)) {
      chart.width = Math.round(cssW * ratio);
      chart.height = Math.round(cssH * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.strokeStyle = '#363b58';
    ctx.lineWidth = 1;
    for (let y = 30; y < cssH; y += 40) {
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(cssW,y); ctx.stroke();
    }
    if (chartSamples.length < 2) return;
    const maxBpm = Math.max(180, ...chartSamples.map(s => s.bpm)) * 1.12;
    const maxT = Math.max(selectedDuration(), ...chartSamples.map(s => s.t));
    ctx.strokeStyle = '#a896ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    chartSamples.forEach((s,i) => {
      const x = (s.t / maxT) * cssW;
      const y = cssH - (s.bpm / maxBpm) * (cssH - 12);
      if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
  }

  function finishRun(manual = false) {
    if (!running && !armed) return;
    clearInterval(tickTimer);
    clearInterval(chartTimer);
    tickTimer = null;
    chartTimer = null;
    const wasRunning = running;
    running = false;
    armed = false;
    stage.classList.remove('is-running','is-armed');
    startButton.disabled = false;
    stopButton.disabled = true;
    stageKicker.textContent = 'READY';
    stageMain.textContent = manual ? '测试已停止' : '测试完成';
    stageDetail.textContent = '可以再次准备测试';
    status.textContent = manual ? '已停止' : '已完成';
    if (!wasRunning || taps.length < 2) return;

    const avg = overallBpm(manual ? performance.now() : endAt);
    const peak = Math.max(0, ...chartSamples.map(sample => sample.bpm), avg);
    const ur = estimatedUr();
    const alt = alternationAccuracy();
    latestResult = {
      mode, duration, taps: taps.length,
      averageBpm: avg,
      peakBpm: peak,
      ur: ur == null ? null : ur,
      alternation: alt,
      completed: !manual
    };

    resultBpm.textContent = avg.toFixed(1);
    resultTaps.textContent = String(taps.length);
    resultPeak.textContent = peak.toFixed(1);
    resultUr.textContent = ur == null ? '—' : ur.toFixed(1);
    resultAlt.textContent = `${alt.toFixed(1)}%`;
    const rankable = !manual && mode === 'stream' && [10,20,30].includes(duration) && alt >= 90 && taps.length >= 8;
    submitScore.disabled = !rankable;
    resultNote.textContent = manual
      ? '手动停止的测试仅供查看，不计入排行榜。'
      : rankable
        ? '本次成绩符合排行榜提交条件。'
        : '排行榜仅接受 10 / 20 / 30 秒的 Stream 交替模式，且交替准确率需 ≥ 90%。';
    submitStatus.textContent = '';
    if (!manual && resultDialog.showModal) resultDialog.showModal();
  }

  function prepareRun() {
    if (running) return;
    resetStats();
    duration = selectedDuration();
    armed = true;
    stage.classList.add('is-armed');
    stageKicker.textContent = 'ARMED';
    stageMain.textContent = '等待第一次按键';
    stageDetail.textContent = `按 ${codeLabel(key1)} / ${codeLabel(key2)} 后立即开始`;
    status.textContent = '已准备';
    startButton.disabled = true;
    stopButton.disabled = false;
  }

  function slotForCode(code) {
    if (code === key1) return 1;
    if (code === key2) return 2;
    return 0;
  }

  document.addEventListener('keydown', event => {
    if (bindingSlot) {
      event.preventDefault();
      if (event.repeat) return;
      const code = event.code;
      if (!code || code === 'Escape') {
        bindingSlot = null;
        key1Bind.classList.remove('is-listening');
        key2Bind.classList.remove('is-listening');
        syncKeys();
        return;
      }
      if (bindingSlot === 1 && code === key2) return;
      if (bindingSlot === 2 && code === key1) return;
      if (bindingSlot === 1) { key1 = code; localStorage.setItem('osu-stream-k1', code); }
      else { key2 = code; localStorage.setItem('osu-stream-k2', code); }
      bindingSlot = null;
      key1Bind.classList.remove('is-listening');
      key2Bind.classList.remove('is-listening');
      syncKeys();
      return;
    }
    if (event.repeat) return;
    const slot = slotForCode(event.code);
    if (!slot) return;
    if (armed || running) {
      event.preventDefault();
      acceptTap(slot, performance.now());
    }
  });

  stage.addEventListener('mousedown', event => {
    if (!mouseEnabled.checked || (!armed && !running)) return;
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    acceptTap(event.button === 0 ? 1 : 2, performance.now());
  });
  stage.addEventListener('contextmenu', event => { if (mouseEnabled.checked) event.preventDefault(); });

  [key1Bind,key2Bind].forEach(button => button.addEventListener('click', () => {
    if (running || armed) return;
    bindingSlot = Number(button.dataset.slot);
    key1Bind.classList.toggle('is-listening', bindingSlot === 1);
    key2Bind.classList.toggle('is-listening', bindingSlot === 2);
    button.textContent = '按键…';
  }));

  modeButtons.forEach(button => button.addEventListener('click', () => {
    if (running || armed) return;
    mode = button.dataset.mode;
    modeButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
  }));

  durationButtons.forEach(button => button.addEventListener('click', () => {
    if (running || armed) return;
    durationButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    customWrap.hidden = button.dataset.seconds !== 'custom';
    resetStats();
  }));

  startButton.addEventListener('click', prepareRun);
  stopButton.addEventListener('click', () => finishRun(true));
  resultClose.addEventListener('click', () => resultDialog.close());
  resultAgain.addEventListener('click', () => { resultDialog.close(); prepareRun(); });

  async function loadBoard(page = 1) {
    boardList.innerHTML = '<li class="board-empty">正在加载排行榜…</li>';
    try {
      const response = await fetch(`/api/leaderboard/osu-stream?duration=${boardDuration}&page=${page}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '排行榜加载失败');
      boardCurrentPage = data.page;
      boardTotalPages = data.totalPages;
      boardPage.textContent = `第 ${data.page} / ${data.totalPages} 页`;
      boardPrev.disabled = data.page <= 1;
      boardNext.disabled = data.page >= data.totalPages;
      boardMeta.textContent = data.total ? `共 ${data.total} 位上榜 · 每页 ${data.pageSize} 名` : '还没有成绩，来拿下第一名吧。';
      boardList.replaceChildren();
      if (!data.entries.length) {
        const empty = document.createElement('li'); empty.className = 'board-empty'; empty.textContent = '还没有成绩，来拿下第一名吧。'; boardList.append(empty); return;
      }
      data.entries.forEach(entry => {
        const li = document.createElement('li');
        const rank = document.createElement('span'); rank.className = `leaderboard-rank${entry.rank <= 3 ? ' top-rank' : ''}`; rank.textContent = String(entry.rank).padStart(2,'0');
        const person = document.createElement('span'); person.className = 'leaderboard-person';
        const name = document.createElement('span'); name.className = 'leaderboard-name'; name.textContent = entry.name;
        const details = document.createElement('span'); details.className = 'leaderboard-details'; details.textContent = entry.memberNo ? `No.${entry.memberNo} · ${new Date(entry.time).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}` : new Date(entry.time).toLocaleString('zh-CN');
        person.append(name, details);
        const score = document.createElement('strong'); score.className = 'osu-score'; score.innerHTML = `${(entry.score/100).toFixed(1)} BPM<small>UR ${entry.ur == null ? '—' : Number(entry.ur).toFixed(1)} · ${entry.taps || 0} taps</small>`;
        li.append(rank, person, score);
        boardList.append(li);
      });
    } catch (error) {
      boardList.innerHTML = `<li class="board-empty">${error.message}</li>`;
    }
  }

  boardTabs.forEach(button => button.addEventListener('click', () => {
    boardDuration = Number(button.dataset.duration);
    boardTabs.forEach(item => item.classList.toggle('active', item === button));
    boardTitle.textContent = `osu! Stream 排行榜 · ${boardDuration} 秒`;
    loadBoard(1);
  }));
  boardPrev.addEventListener('click', () => loadBoard(boardCurrentPage - 1));
  boardNext.addEventListener('click', () => loadBoard(boardCurrentPage + 1));

  submitScore.addEventListener('click', async () => {
    if (!latestResult || !latestResult.completed || submitScore.disabled) return;
    submitScore.disabled = true;
    submitStatus.textContent = '正在提交…';
    try {
      const response = await fetch('/api/leaderboard/osu-stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration: latestResult.duration,
          score: Math.round(latestResult.averageBpm * 100),
          ur: latestResult.ur == null ? null : Number(latestResult.ur.toFixed(2)),
          taps: latestResult.taps,
          alternation: Number(latestResult.alternation.toFixed(2))
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '提交失败');
      submitStatus.textContent = data.improved === false ? '成绩未刷新个人最好纪录' : '提交成功！';
      if (boardDuration === latestResult.duration) loadBoard(data.page || 1);
    } catch (error) {
      submitStatus.textContent = error.message;
      submitScore.disabled = false;
    }
  });

  window.addEventListener('resize', drawChart);
  syncKeys();
  resetStats();
  loadBoard(1);
})();