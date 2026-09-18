'use strict';

(() => {
  if (!document.querySelector('script[data-wuyue-presence-loader], script[src*="https://wuyue1337.github.io/wuyue-static/presence.js"]')) {
    const script = document.createElement('script');
    script.src = 'https://wuyue1337.github.io/wuyue-static/presence.js';
    script.defer = true;
    script.dataset.wuyuePresenceLoader = '1';
    document.head.appendChild(script);
  }
  if (!document.querySelector('link[data-wuyue-leaderboard-style]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://wuyue1337.github.io/wuyue-static/leaderboard-unified.css?v=2';
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
  if (!value || /(?:^|\/)default-avatar\.jpg(?:[?#].*)?$/i.test(String(value))) return DEFAULT_AVATAR_URL;
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
  avatar.alt = `${entry.name || '玩家'}的头像`;
  avatar.loading = 'lazy';
  avatar.addEventListener('error', () => { avatar.src = DEFAULT_AVATAR_URL; }, { once: true });
  avatarLink.appendChild(avatar);

  const info = document.createElement('span');
  info.className = 'leaderboard-person-info';
  const name = document.createElement(href ? 'a' : 'span');
  name.className = 'leaderboard-name';
  if (href) name.href = href;
  name.title = entry.name || '未命名';
  name.textContent = entry.name || '未命名';
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

function scoreParts(mode, entry, context, options) {
  if (typeof options.score === 'function') return options.score(entry, context);
  if (mode === 'reaction') return [entry.score, 'ms'];
  if (mode === 'dodge') return [(entry.score / 1000).toFixed(1), '秒'];
  if (mode === 'osu-stream') return [(entry.score / 100).toFixed(1), 'BPM'];
  return [entry.score, '次'];
}

function personalScoreParts(mode, entry, context, options) {
  if (typeof options.personalScore === 'function') return options.personalScore(entry, context);
  if (mode === 'click-speed' && Number(context.duration) > 0) {
    return [(entry.score / Number(context.duration)).toFixed(2), 'CPS'];
  }
  if (mode === 'rhythm-power') {
    const elapsed = Number(entry.elapsedMs) || Number(context.duration) * 1000;
    const avg = Number(entry.avgSpeed) || (elapsed > 0 ? entry.score / (elapsed / 1000) : 0);
    return [avg.toFixed(2), '/s'];
  }
  return scoreParts(mode, entry, context, options);
}

function personalStandingText(personal) {
  if (!personal || !Number.isFinite(personal.percentile)) return '';
  if (Number(personal.total) <= 1) return '当前只有你一位上榜玩家';
  const value = Number(personal.percentile);
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `超过 ${text}% 的上榜玩家`;
}

function normalizeContext(mode, value) {
  if (value && typeof value === 'object') return { ...value };
  if (value == null) return {};
  if (mode === 'click-speed' || mode === 'osu-stream') return { duration: Number(value) };
  return { value };
}

function contextParams(mode, context, options) {
  const params = new URLSearchParams();
  if (typeof options.params === 'function') {
    const custom = options.params(context) || {};
    for (const [key, value] of Object.entries(custom)) if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    return params;
  }
  if (context.duration != null && (mode === 'click-speed' || mode === 'osu-stream' || mode === 'rhythm-power')) params.set('duration', String(context.duration));
  if (context.keys != null && mode === 'rhythm-power') params.set('keys', String(context.keys));
  return params;
}

function appendModeDetails(mode, details, entry, context, options) {
  if (typeof options.details === 'function') {
    const values = options.details(entry, context);
    for (const value of Array.isArray(values) ? values : [values]) appendDetail(details, value);
    return;
  }
  if (mode === 'reaction') {
    appendDetail(details, Array.isArray(entry.rounds) && entry.rounds.length === 5
      ? `5 次：${entry.rounds.map(value => `${value}ms`).join(' · ')}`
      : '5 次：历史成绩未记录');
  } else if (mode === 'click-speed' && Number(context.duration) > 0) {
    appendDetail(details, `平均 ${(entry.score / Number(context.duration)).toFixed(2)} CPS`);
  } else if (mode === 'osu-stream') {
    const parts = [];
    if (Number.isFinite(entry.ur)) parts.push(`UR ${entry.ur.toFixed(1)}`);
    if (Number.isSafeInteger(entry.taps)) parts.push(`${entry.taps} taps`);
    if (Number.isFinite(entry.alternation)) parts.push(`交替 ${entry.alternation.toFixed(1)}%`);
    appendDetail(details, parts.join(' · '));
  } else if (mode === 'rhythm-power') {
    const duration = Number(context.duration) || 0;
    const elapsed = Number(entry.elapsedMs) || duration * 1000;
    const avg = Number(entry.avgSpeed) || (elapsed > 0 ? entry.score / (elapsed / 1000) : 0);
    const bpm = Number(entry.bpm) || (elapsed > 0 ? entry.score * 15000 / elapsed : 0);
    appendDetail(details, `${(elapsed / 1000).toFixed(2)}s · ${avg.toFixed(2)}/s · ${bpm.toFixed(1)} BPM`);
  }
}

(async () => {
  const form = document.querySelector('.score-submit, #score-form');
  if (!form) return;
  const input = form.querySelector('input[name="nickname"], #score-name');
  const label = form.querySelector('label');
  if (!input || !label) return;
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

window.createLeaderboard = function createLeaderboard(mode, list, meta, options = {}) {
  if (!list) throw new Error('排行榜列表容器不存在');
  let requestNumber = 0;
  let currentPage = 1;
  let currentContext = normalizeContext(mode, options.initialContext);
  const section = list.closest('.leaderboard-section, .power-leaderboard') || list.parentElement;
  const previousButton = options.previousButton || section?.querySelector('.board-prev, #board-prev') || null;
  const nextButton = options.nextButton || section?.querySelector('.board-next, #board-next') || null;
  const pageLabel = options.pageLabel || section?.querySelector('.board-page, #board-page') || null;
  list.classList.add('wuyue-unified-board');

  const overview = document.createElement('div');
  overview.className = 'wuyue-board-overview';

  const personalCard = document.createElement('div');
  personalCard.className = 'wuyue-personal-best';
  const personalLabel = document.createElement('span');
  personalLabel.className = 'wuyue-personal-label';
  personalLabel.textContent = '你的个人最佳';
  const personalValue = document.createElement('strong');
  personalValue.className = 'wuyue-personal-value';
  const personalDetail = document.createElement('span');
  personalDetail.className = 'wuyue-personal-detail';
  const personalRank = document.createElement('small');
  personalRank.className = 'wuyue-personal-rank';
  personalCard.append(personalLabel, personalValue, personalDetail, personalRank);

  const entertainmentNote = document.createElement('div');
  entertainmentNote.className = 'wuyue-entertainment-note';
  entertainmentNote.innerHTML = '<strong>娱乐排行榜</strong><span>仅供交流展示，不进行严格反作弊验证，也不提供站内权益。</span>';

  overview.append(personalCard, entertainmentNote);
  list.before(overview);

  function renderPersonal(data) {
    const viewer = data?.viewer || {};
    const personal = viewer.personal || null;
    if (viewer.authenticated && personal) {
      const [value, unit] = personalScoreParts(mode, personal, currentContext, options);
      personalValue.textContent = `${value}${unit ? ` ${unit}` : ''}`;
      personalDetail.textContent = personalStandingText(personal);
      personalRank.textContent = `娱乐榜 #${personal.rank} / ${personal.total}`;
      personalCard.classList.add('has-score');
      return;
    }
    personalCard.classList.remove('has-score');
    personalValue.textContent = viewer.authenticated ? '暂无成绩' : '登录后查看';
    personalDetail.textContent = viewer.authenticated
      ? '完成并提交一次测试后，这里会显示个人最佳与百分位。'
      : '登录并提交成绩后，这里会显示个人最佳与百分位。';
    personalRank.textContent = '';
  }

  function render(data) {
    currentPage = data.page || 1;
    renderPersonal(data);
    list.replaceChildren();
    if (!data.entries?.length) {
      const empty = document.createElement('li');
      empty.className = 'board-empty';
      empty.textContent = options.emptyText || '还没有成绩，来留下第一份纪录吧。';
      list.appendChild(empty);
    }
    for (const entry of data.entries || []) {
      const item = document.createElement('li');
      item.className = 'leaderboard-row wuyue-standardized';

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
      appendModeDetails(mode, details, entry, currentContext, options);

      const [value, unit] = scoreParts(mode, entry, currentContext, options);
      const scoreBox = document.createElement('span');
      scoreBox.className = 'leaderboard-score-box';
      const score = document.createElement('strong');
      score.className = 'leaderboard-score';
      score.textContent = String(value);
      const scoreUnit = document.createElement('small');
      scoreUnit.textContent = unit || '';
      scoreBox.append(score, scoreUnit);

      item.append(rank, person, scoreBox);
      if (entry.rank === data.rank) item.classList.add('my-score');
      list.appendChild(item);
    }
    if (meta) meta.textContent = data.total ? `共 ${data.total} 位上榜 · 每页 ${data.pageSize} 名` : (options.emptyMeta || '完成测试后即可保存成绩上榜');
    if (pageLabel) pageLabel.textContent = `第 ${data.page || 1} / ${data.totalPages || 1} 页`;
    if (previousButton) previousButton.disabled = (data.page || 1) <= 1;
    if (nextButton) nextButton.disabled = (data.page || 1) >= (data.totalPages || 1);
    if (typeof options.onRender === 'function') options.onRender(data, currentContext);
  }

  async function load(contextValue = currentContext, page = 1) {
    const request = ++requestNumber;
    currentContext = normalizeContext(mode, contextValue);
    const params = contextParams(mode, currentContext, options);
    params.set('page', String(page));
    try {
      const response = await fetch(`/api/leaderboard/${mode}?${params}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error('排行榜暂时无法加载');
      const data = await response.json();
      if (request === requestNumber) render(data);
      return data;
    } catch (error) {
      if (request === requestNumber) {
        list.replaceChildren();
        const row = document.createElement('li');
        row.className = 'board-empty';
        row.textContent = '排行榜暂时无法加载，请稍后刷新页面。';
        list.appendChild(row);
        if (meta) meta.textContent = '';
        if (previousButton) previousButton.disabled = true;
        if (nextButton) nextButton.disabled = true;
      }
      throw error;
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
    const submitContext = { ...currentContext };
    if (duration !== undefined) submitContext.duration = duration;
    currentContext = submitContext;
    const response = await fetch(`/api/leaderboard/${mode}`, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, duration, proof, ...currentContext, ...extra })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '提交失败，请稍后再试');
    if (request === requestNumber) render(data);
    return data;
  }

  if (options.bindPagination !== false) {
    previousButton?.addEventListener('click', () => load(currentContext, Math.max(1, currentPage - 1)));
    nextButton?.addEventListener('click', () => load(currentContext, currentPage + 1));
  }

  return { load, submit, render, getContext: () => ({ ...currentContext }) };
};

window.WuyueLeaderboard = {
  create: window.createLeaderboard,
  defaultAvatar: DEFAULT_AVATAR_URL,
  normalizeAvatarUrl
};
