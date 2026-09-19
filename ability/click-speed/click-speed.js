'use strict';

const stage = document.getElementById('click-stage');
const title = document.getElementById('stage-title');
const detail = document.getElementById('stage-detail');
const icon = document.getElementById('stage-icon');
const hint = document.getElementById('stage-hint');
const timeLeft = document.getElementById('time-left');
const clickCount = document.getElementById('click-count');
const cps = document.getElementById('cps');
const timerFill = document.getElementById('timer-fill');
const status = document.getElementById('click-status');
const durationButtons = [...document.querySelectorAll('.duration-button')];
const resultActions = document.getElementById('result-actions');
const resultDialog = document.getElementById('result-dialog');
const resultDuration = document.getElementById('result-duration');
const resultCount = document.getElementById('result-count');
const resultCps = document.getElementById('result-cps');
const submitForm = document.getElementById('speed-submit');
const submitName = document.getElementById('speed-name');
const submitStatus = document.getElementById('speed-submit-status');
const submitButton = submitForm.querySelector('button');
const boardTitle = document.getElementById('speed-board-title');
const leaderboard = window.createLeaderboard('click-speed', document.getElementById('speed-board'), document.getElementById('speed-board-meta'));

let duration = 5;
let phase = 'ready';
let count = 0;
let startAt = 0;
let endAt = 0;
let ticker = null;
let run = 0;

function displayStage(nextPhase, heading, description, action) {
  phase = nextPhase;
  stage.className = `stage click-${nextPhase}`;
  title.textContent = heading;
  detail.textContent = description;
  hint.textContent = action;
}

function updateClock() {
  if (phase !== 'running') return;
  const now = performance.now();
  if (now >= endAt) {
    finish();
    return;
  }
  const remaining = (endAt - now) / 1000;
  timeLeft.textContent = `${(Math.ceil(remaining * 10) / 10).toFixed(1)} 秒`;
  timerFill.style.transform = `scaleX(${remaining / duration})`;
  const elapsed = Math.max((now - startAt) / 1000, 0.1);
  cps.textContent = `${(count / elapsed).toFixed(1)} CPS`;
}

function finish() {
  if (phase !== 'running') return;
  clearInterval(ticker);
  ticker = null;
  timeLeft.textContent = '0.0 秒';
  timerFill.style.transform = 'scaleX(0)';
  cps.textContent = `${(count / duration).toFixed(2)} CPS`;
  icon.textContent = '✦';
  displayStage('finished', `${count} 次点击`, `平均 ${cps.textContent} · ${duration} 秒`, '成绩已记录');
  stage.disabled = true;
  resultActions.hidden = false;
  status.textContent = `测试结束，${duration} 秒内点击 ${count} 次，平均 ${cps.textContent}。`;
  resultDuration.textContent = `${duration} 秒内的成绩`;
  resultCount.textContent = String(count);
  resultCps.textContent = cps.textContent;
  submitButton.disabled = false;
  submitButton.textContent = '提交成绩';
  submitStatus.textContent = '';
  durationButtons.forEach(button => { button.disabled = false; });
  resultDialog.showModal();
}

function reset() {
  run++;
  clearInterval(ticker);
  ticker = null;
  count = 0;
  clickCount.textContent = '0';
  timeLeft.textContent = `${duration.toFixed(1)} 秒`;
  cps.textContent = '0.0 CPS';
  timerFill.style.transform = 'scaleX(1)';
  icon.textContent = '✧';
  stage.disabled = false;
  resultActions.hidden = true;
  displayStage('ready', '准备好了吗？', '点击这里，第一下就开始计时', '点击开始');
  status.textContent = '第一下点击会计入成绩；倒计时结束后会弹出成绩。';
}

function registerClick() {
  if (phase === 'finished') return;
  if (phase === 'running' && performance.now() >= endAt) {
    finish();
    return;
  }
  if (phase !== 'running') {
    reset();
    startAt = performance.now();
    endAt = startAt + duration * 1000;
    displayStage('running', '继续点击！', '倒计时正在进行', '尽可能快地点击');
    durationButtons.forEach(button => { button.disabled = true; });
    status.textContent = '测试进行中。';
    ticker = setInterval(updateClock, 40);
  }
  count++;
  clickCount.textContent = String(count);
  updateClock();
}

durationButtons.forEach(button => button.addEventListener('click', () => {
  if (phase === 'running') return;
  duration = Number(button.dataset.seconds);
  durationButtons.forEach(choice => {
    const selected = choice === button;
    choice.classList.toggle('active', selected);
    choice.setAttribute('aria-pressed', String(selected));
  });
  reset();
  boardTitle.textContent = `点击速度排行榜 · ${duration} 秒`;
  leaderboard.load(duration);
}));
stage.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  registerClick();
});
stage.addEventListener('keydown', event => {
  if (event.repeat || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  registerClick();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateClock();
});
document.getElementById('result-close').addEventListener('click', () => resultDialog.close());
document.getElementById('show-result').addEventListener('click', () => resultDialog.showModal());
for (const button of [document.getElementById('result-restart'), document.getElementById('restart-inline')]) {
  button.addEventListener('click', () => {
    if (resultDialog.open) resultDialog.close();
    reset();
  });
}
submitForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (phase !== 'finished' || submitButton.disabled) return;
  const currentRun = run;
  submitButton.disabled = true;
  submitStatus.textContent = '正在提交…';
  try {
    const result = await leaderboard.submit(submitName.value.trim(), count, duration);
    if (currentRun !== run) return;
    const personal = result.viewer?.personal;
    submitStatus.textContent = result.improved
      ? personal?.total > 1 ? `个人最好纪录已更新 · 超过 ${personal.percentile}% 的上榜玩家。` : '个人最好纪录已更新。'
      : '已保留你之前更好的个人纪录。';
    submitButton.textContent = '已提交';
  } catch (error) {
    if (currentRun !== run) return;
    submitStatus.textContent = error.message;
    submitButton.disabled = false;
  }
});

{
  const linkedDuration = Number(new URLSearchParams(location.search).get('duration'));
  if ([5, 10, 15, 30, 60].includes(linkedDuration)) {
    duration = linkedDuration;
    durationButtons.forEach(button => {
      const active = Number(button.dataset.seconds) === duration;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    boardTitle.textContent = `点击速度排行榜 · ${duration} 秒`;
  }
}
reset();
leaderboard.load(duration);
