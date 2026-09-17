'use strict';

(() => {
  if (!document.querySelector('script[data-wuyue-presence-loader]')) {
    const script = document.createElement('script');
    script.src = 'https://wuyue1337.github.io/wuyue-static/presence.js';
    script.defer = true;
    script.dataset.wuyuePresenceLoader = '1';
    document.head.appendChild(script);
  }
  if (!document.querySelector('link[data-wuyue-leaderboard-style]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://wuyue1337.github.io/wuyue-static/leaderboard-unified.css?v=1';
    link.dataset.wuyueLeaderboardStyle = '1';
    document.head.appendChild(link);
  }
})();

const DEFAULT_AVATAR_URL = 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg';

let scoreAuthPromise = null;
function loadScoreAuth() {
  if (window.WuyueScoreAuth) return Promise.resolve(window.WuyueScoreAuth);
  if (scoreAuthPromise) return scoreAuthPromise;
  scoreAuthPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-score-auth-loader]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.WuyueScoreAuth), { once: true });
      existing.addEventListener('error', () => reject(new Error('账号组件加载失败，请刷新页面重试')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://wuyue1337.github.io/wuyue-static/ability/score-auth.js';
    script.dataset.scoreAuthLoader = '1';
    script.onload = () => resolve(window.WuyueScoreAuth);
    script.onerror = () => reject(new Error('账号组件加载失败，请刷新页面重试'));
    document.head.appendChild(script);
  });
  return scoreAuthPromise;
}

async function scoreAccount() {
  try {
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    const data = await response.json();
    return response.ok && data.authenticated ? data.user : null;
  } catch { return null; }
}

function formatLeaderboardTime(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '时间未记录';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function profileHref(entry) {
  return entry.username ? `/profile/?user=${encodeURIComponent(entry.username)}` : null;
}

function normalizeAvatarUrl(value) {
  if (!value || value === 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg') return DEFAULT_AVATAR_URL;
  return value;
}

function appendIdentityBadges(info, entry) {
  const role = entry.memberNo === 1 || entry.role === 'owner' ? 'owner' : entry.role === 'admin' ? 'staff' : '';
  if (role) {
    const badge = document.createElement('span');
    badge.className = `leaderboard-role ${role}`;
    badge.textContent = role === 'owner' ? 'OWNER' : 'STAFF';
    info.appendChild(badge);
  }
  if (Number.isSafeInteger(entry.memberNo) && entry.memberNo > 0) {
    const memberNo = document.createElement('span');
    memberNo.className = `member-no${entry.memberNo <= 100 ? ' founder' : ''}`;
    memberNo.textContent = `No.${entry.memberNo}`;
    memberNo.title = `第 ${entry.memberNo} 位注册用户`;
    info.appendChild(memberNo);
  }
}

function createPerson(entry) {
  const person = document.createElement('span');
  person.className = 'leaderboard-person';
  const href = profileHref(entry);
  const avatarLink = document.createElement(href ? 'a' : 'span');
  avatarLink.className = 'leaderboard-avatar-link';
  if (href) { avatarLink.href = href; avatarLink.title = `查看 ${entry.name} 的个人主页`; }
  const avatar = document.createElement('img');
  avatar.className = 'leaderboard-avatar';
  avatar.src = normalizeAvatarUrl(entry.avatar);
  avatar.alt = `${entry.name}的头像`;
  avatar.loading = 'lazy';
  avatar.addEventListener('error', () => { avatar.src = DEFAULT_AVATAR_URL; }, { once: true });
  avatarLink.appendChild(avatar);

  const info = document.createElement('span');
  info.className = 'leaderboard-person-info';
  const name = document.createElement(href ? 'a' : 'span');
  name.className = 'leaderboard-name';
  if (href) name.href = href;
  name.title = entry.name;
  name.textContent = entry.name;
  info.appendChild(name);
  appendIdentityBadges(info, entry);

  const details = document.createElement('span');
  details.className = 'leaderboard-details';
  info.appendChild(details);
  person.append(avatarLink, info);
  return { person, details };
}

function appendDetail(details, text, className = 'leaderboard-project-detail') {
  if (!text) return;
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  details.appendChild(span);
}

function scoreParts(mode, entry) {
  if (mode === 'reaction') return [entry.score, 'ms'];
  if (mode === 'dodge') return [(entry.score / 1000).toFixed(1), '秒'];
  if (mode === 'osu-stream') return [(entry.score / 100).toFixed(1), 'BPM'];
  return [entry.score, '次'];
}

(async () => {
  const form = document.querySelector('.score-submit, #score-form');
  if (!form) return;
  const input = form.querySelector('input[name="nickname"], #score-name');
  const label = form.querySelector('label');
  const account = await scoreAccount();
  if (account) {
    input.value = account.nickname;
    input.readOnly = true;
    label.textContent = '使用账号昵称上榜';
  } else {
    input.value = '';
    input.required = false;
    input.readOnly = true;
    input.placeholder = '提交时可登录 / 注册';
    label.textContent = '提交时可直接登录或注册，并保留本次成绩';
  }
})();

window.createLeaderboard = function createLeaderboard(mode, list, meta) {
  let requestNumber = 0;
  let currentPage = 1;
  let currentDuration;
  const section = list.closest('.leaderboard-section');
  const previousButton = section.querySelector('.board-prev');
  const nextButton = section.querySelector('.board-next');
  const pageLabel = section.querySelector('.board-page');
  list.classList.add('wuyue-unified-board');

  function render(data) {
    currentPage = data.page;
    list.replaceChildren();
    if (!data.entries.length) {
      const empty = document.createElement('li');
      empty.className = 'board-empty';
      empty.textContent = '还没有成绩，来拿下第一名吧。';
      list.appendChild(empty);
    }
    for (const entry of data.entries) {
      const item = document.createElement('li');
      item.className = 'leaderboard-row';

      const rank = document.createElement('span');
      rank.className = `leaderboard-rank${entry.rank <= 3 ? ' top-rank' : ''}`;
      rank.textContent = `#${entry.rank}`;

      const { person, details } = createPerson(entry);
      const time = document.createElement('time');
      time.dateTime = entry.time || '';
      time.textContent = formatLeaderboardTime(entry.time);
      details.appendChild(time);

      const country = entry.country || '未记录';
      const province = entry.province || '未记录';
      const locationText = country === '中国' && province !== '未知' && province !== '未记录' ? `属地：中国 · ${province}` : `属地：${country}`;
      appendDetail(details, locationText, 'leaderboard-location');

      if (mode === 'reaction') {
        appendDetail(details, Array.isArray(entry.rounds) && entry.rounds.length === 5
          ? `5 次：${entry.rounds.map(value => `${value}ms`).join(' · ')}`
          : '5 次：历史成绩未记录');
      } else if (mode === 'click-speed' && Number(currentDuration) > 0) {
        appendDetail(details, `平均 ${(entry.score / Number(currentDuration)).toFixed(2)} CPS`);
      } else if (mode === 'osu-stream') {
        const parts = [];
        if (Number.isFinite(entry.ur)) parts.push(`UR ${entry.ur.toFixed(1)}`);
        if (Number.isSafeInteger(entry.taps)) parts.push(`${entry.taps} taps`);
        if (Number.isFinite(entry.alternation)) parts.push(`交替 ${entry.alternation.toFixed(1)}%`);
        appendDetail(details, parts.join(' · '));
      }

      const [value, unit] = scoreParts(mode, entry);
      const scoreBox = document.createElement('span');
      scoreBox.className = 'leaderboard-score-box';
      const score = document.createElement('strong');
      score.className = 'leaderboard-score';
      score.textContent = String(value);
      const scoreUnit = document.createElement('small');
      scoreUnit.textContent = unit;
      scoreBox.append(score, scoreUnit);

      item.append(rank, person, scoreBox);
      if (entry.rank === data.rank) item.classList.add('my-score');
      list.appendChild(item);
    }
    meta.textContent = data.total ? `共 ${data.total} 位上榜 · 每页 ${data.pageSize} 名` : '完成测试后即可保存成绩上榜';
    pageLabel.textContent = `第 ${data.page} / ${data.totalPages} 页`;
    previousButton.disabled = data.page <= 1;
    nextButton.disabled = data.page >= data.totalPages;
  }

  async function load(duration, page = 1) {
    const request = ++requestNumber;
    currentDuration = duration;
    const params = new URLSearchParams({ page: String(page) });
    if (mode === 'click-speed' || mode === 'osu-stream') params.set('duration', String(duration));
    try {
      const response = await fetch(`/api/leaderboard/${mode}?${params}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('排行榜暂时无法加载');
      const data = await response.json();
      if (request === requestNumber) render(data);
    } catch {
      if (request === requestNumber) {
        list.replaceChildren();
        const error = document.createElement('li');
        error.className = 'board-empty';
        error.textContent = '排行榜暂时无法加载，请稍后刷新页面。';
        list.appendChild(error);
        meta.textContent = '';
        previousButton.disabled = true;
        nextButton.disabled = true;
      }
    }
  }

  async function submit(name, score, duration, proof, extra = {}) {
    let account = await scoreAccount();
    if (!account) {
      const auth = await loadScoreAuth();
      if (!auth?.ensureAccount) throw new Error('账号组件加载失败，请刷新页面重试');
      account = await auth.ensureAccount();
    }
    const request = ++requestNumber;
    currentDuration = duration;
    const response = await fetch(`/api/leaderboard/${mode}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, duration, proof, ...extra })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '提交失败，请稍后再试');
    if (request === requestNumber) render(data);
    return data;
  }

  previousButton.addEventListener('click', () => load(currentDuration, currentPage - 1));
  nextButton.addEventListener('click', () => load(currentDuration, currentPage + 1));
  return { load, submit };
};
