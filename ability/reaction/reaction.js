'use strict';

const stage = document.getElementById('reaction-stage');
const title = document.getElementById('stage-title');
const detail = document.getElementById('stage-detail');
const icon = document.getElementById('stage-icon');
const hint = document.getElementById('stage-hint');
const progress = document.getElementById('round-progress');
const average = document.getElementById('average-time');
const best = document.getElementById('best-time');
const rounds = document.getElementById('rounds');
const status = document.getElementById('reaction-status');
const submitForm = document.getElementById('reaction-submit');
const submitName = document.getElementById('reaction-name');
const submitStatus = document.getElementById('reaction-submit-status');
const submitButton = submitForm.querySelector('button');
const resultActions = document.getElementById('reaction-actions');
const resultDialog = document.getElementById('reaction-dialog');
const resultAverage = document.getElementById('reaction-result-average');
const resultBest = document.getElementById('reaction-result-best');
const leaderboard = window.createLeaderboard('reaction', document.getElementById('reaction-board'), document.getElementById('reaction-board-meta'));

const targetRounds = 5;
let phase = 'ready';
let waitTimer = null;
let greenAt = 0;
let scores = [];
let run = 0;

function paint(nextPhase, symbol, heading, description, action, announcement) {
  phase = nextPhase;
  stage.className = `stage ${nextPhase}`;
  icon.textContent = symbol;
  title.textContent = heading;
  detail.textContent = description;
  hint.textContent = action;
  status.textContent = announcement;
}

function refreshScores() {
  progress.textContent = `${scores.length} / ${targetRounds}`;
  average.textContent = scores.length ? `${Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)} ms` : '—';
  best.textContent = scores.length ? `${Math.min(...scores)} ms` : '—';
  rounds.replaceChildren();
  const label = document.createElement('span');
  label.className = 'rounds-label';
  label.textContent = '每轮成绩';
  rounds.append(label);
  for (let i = 0; i < targetRounds; i++) {
    const chip = document.createElement('span');
    chip.className = `round-chip${i < scores.length ? ' done' : ''}`;
    chip.textContent = i < scores.length ? `${scores[i]} ms` : `${i + 1}`;
    rounds.append(chip);
  }
}

function beginRound() {
  clearTimeout(waitTimer);
  paint('waiting', '◌', '等绿色出现…', '现在点击会算抢跑', '请等待', '正在等待颜色变化。');
  waitTimer = setTimeout(() => {
    waitTimer = null;
    paint('go', '✦', '现在点击！', '越快越好', '立刻点击', '颜色已变绿，快点击！');
    greenAt = performance.now();
  }, 1900 + Math.random() * 3000);
}

function resetTest() {
  run++;
  clearTimeout(waitTimer);
  waitTimer = null;
  scores = [];
  stage.disabled = false;
  resultActions.hidden = true;
  refreshScores();
  paint('ready', '✦', '准备好了吗？', '点击这里开始，等待颜色变化', '点击开始', '等待变绿之前点击，算抢跑，这一轮需要重试。');
}

function activate() {
  if (phase === 'complete') return;
  if (phase === 'waiting') {
    clearTimeout(waitTimer);
    waitTimer = null;
    paint('early', '!', '太早了！', '颜色还没变绿，这次不计成绩', '点击重试', '抢跑了，请重试这一轮。');
    return;
  }
  if (phase === 'go') {
    const elapsed = Math.max(0, Math.round(performance.now() - greenAt));
    scores.push(elapsed);
    refreshScores();
    if (scores.length === targetRounds) {
      paint('complete', '✦', `${average.textContent}`, `完成 ${targetRounds} 次 · 最快 ${best.textContent}`, '成绩已记录', `测试完成，平均反应时间 ${average.textContent}。`);
      stage.disabled = true;
      resultActions.hidden = false;
      resultAverage.textContent = average.textContent.replace(' ms', '');
      resultBest.textContent = best.textContent;
      submitButton.disabled = false;
      submitButton.textContent = '提交成绩';
      submitStatus.textContent = '';
      resultDialog.showModal();
    } else {
      paint('result', '✦', `${elapsed} ms`, `第 ${scores.length} 次完成，还剩 ${targetRounds - scores.length} 次`, '点击继续', `本轮反应时间 ${elapsed} 毫秒。`);
    }
    return;
  }
  beginRound();
}

stage.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  activate();
});
stage.addEventListener('keydown', event => {
  if (event.repeat || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  activate();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden || !['waiting', 'go'].includes(phase)) return;
  clearTimeout(waitTimer);
  waitTimer = null;
  paint('early', '↺', '测试已暂停', '切回页面后重新开始这一轮', '点击重试', '切换页面后本轮已取消，请重试。');
});
submitForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (phase !== 'complete' || submitButton.disabled) return;
  const currentRun = run;
  submitButton.disabled = true;
  submitStatus.textContent = '正在提交…';
  try {
    const score = Math.round(scores.reduce((sum, value) => sum + value, 0) / targetRounds);
    const result = await leaderboard.submit(submitName.value.trim(), score, undefined, undefined, { rounds: [...scores] });
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
document.getElementById('reaction-close').addEventListener('click', () => resultDialog.close());
document.getElementById('reaction-show-result').addEventListener('click', () => resultDialog.showModal());
for (const button of [document.getElementById('reaction-restart'), document.getElementById('reaction-restart-inline')]) {
  button.addEventListener('click', () => {
    if (resultDialog.open) resultDialog.close();
    resetTest();
  });
}

refreshScores();
leaderboard.load();
