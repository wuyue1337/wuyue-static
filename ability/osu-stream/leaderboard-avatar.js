(function () {
  'use strict';

  const DEFAULT_AVATAR_URL = 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg';
  function normalizeAvatarUrl(value) {
    if (!value || /(?:^|\/)default-avatar\.jpg(?:[?#].*)?$/i.test(value)) return DEFAULT_AVATAR_URL;
    return value;
  }

  const list = document.getElementById('osu-board-list');
  const tabs = document.getElementById('board-tabs');
  const pageLabel = document.getElementById('board-page');
  if (!list || !tabs || !pageLabel) return;

  if (!document.querySelector('link[data-wuyue-leaderboard-style]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://wuyue1337.github.io/wuyue-static/leaderboard-unified.css?v=1';
    link.dataset.wuyueLeaderboardStyle = '1';
    document.head.appendChild(link);
  }
  list.classList.add('wuyue-unified-board');

  const pad = value => String(value).padStart(2, '0');
  function formatTime(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '时间未记录';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  function profileHref(entry) { return entry.username ? `/profile/?user=${encodeURIComponent(entry.username)}` : null; }
  function appendBadges(info, entry) {
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
  function appendDetail(details, text, className = 'leaderboard-project-detail') {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    details.appendChild(span);
  }

  let requestId = 0;
  let decorating = false;

  function activeDuration() {
    return Number(tabs.querySelector('button.active')?.dataset.duration || 10);
  }

  function currentPage() {
    const match = pageLabel.textContent.match(/第\s*(\d+)/);
    return match ? Number(match[1]) : 1;
  }

  async function decorate() {
    if (decorating) return;
    const rawRows = [...list.querySelectorAll('li:not(.board-empty)')];
    if (!rawRows.length || rawRows.every(row => row.classList.contains('wuyue-standardized'))) return;
    decorating = true;
    const id = ++requestId;
    try {
      const duration = activeDuration();
      const page = currentPage();
      const response = await fetch(`/api/leaderboard/osu-stream?duration=${duration}&page=${page}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || id !== requestId || !Array.isArray(data.entries)) return;

      list.replaceChildren();
      if (!data.entries.length) {
        const empty = document.createElement('li');
        empty.className = 'board-empty';
        empty.textContent = '还没有成绩，来拿下第一名吧。';
        list.appendChild(empty);
        return;
      }

      for (const entry of data.entries) {
        const row = document.createElement('li');
        row.className = 'leaderboard-row wuyue-standardized';

        const rank = document.createElement('span');
        rank.className = `leaderboard-rank${entry.rank <= 3 ? ' top-rank' : ''}`;
        rank.textContent = `#${entry.rank}`;

        const person = document.createElement('span');
        person.className = 'leaderboard-person';
        const href = profileHref(entry);
        const avatarLink = document.createElement(href ? 'a' : 'span');
        avatarLink.className = 'leaderboard-avatar-link';
        if (href) avatarLink.href = href;
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
        name.textContent = entry.name || '未命名';
        info.appendChild(name);
        appendBadges(info, entry);

        const details = document.createElement('span');
        details.className = 'leaderboard-details';
        const time = document.createElement('time');
        time.dateTime = entry.time || '';
        time.textContent = formatTime(entry.time);
        details.appendChild(time);
        const country = entry.country || '未记录';
        const province = entry.province || '未记录';
        appendDetail(details, country === '中国' && province !== '未知' && province !== '未记录' ? `属地：中国 · ${province}` : `属地：${country}`, 'leaderboard-location');
        const detailParts = [];
        detailParts.push(`UR ${entry.ur == null ? '—' : Number(entry.ur).toFixed(1)}`);
        detailParts.push(`${entry.taps || 0} taps`);
        detailParts.push(`交替 ${Number.isFinite(Number(entry.alternation)) ? `${Number(entry.alternation).toFixed(1)}%` : '—'}`);
        appendDetail(details, detailParts.join(' · '));
        info.appendChild(details);
        person.append(avatarLink, info);

        const scoreBox = document.createElement('span');
        scoreBox.className = 'leaderboard-score-box';
        const score = document.createElement('strong');
        score.className = 'leaderboard-score';
        score.textContent = (entry.score / 100).toFixed(1);
        const unit = document.createElement('small');
        unit.textContent = 'BPM';
        scoreBox.append(score, unit);

        row.append(rank, person, scoreBox);
        list.appendChild(row);
      }
    } catch (_) {
      // 主排行榜已经能显示；统一装饰失败时不影响测试功能。
    } finally {
      decorating = false;
    }
  }

  const observer = new MutationObserver(() => {
    clearTimeout(observer.timer);
    observer.timer = setTimeout(decorate, 30);
  });
  observer.observe(list, { childList: true, subtree: true });
  tabs.addEventListener('click', () => setTimeout(decorate, 80));
  document.getElementById('board-prev')?.addEventListener('click', () => setTimeout(decorate, 80));
  document.getElementById('board-next')?.addEventListener('click', () => setTimeout(decorate, 80));
  setTimeout(decorate, 120);

  let authLoader = null;
  let bypassAuth = false;
  async function ensureScoreAuth() {
    if (window.WuyueScoreAuth) return window.WuyueScoreAuth;
    if (!authLoader) authLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://wuyue1337.github.io/wuyue-static/ability/score-auth.js';
      script.dataset.scoreAuthLoader = '1';
      script.onload = () => resolve(window.WuyueScoreAuth);
      script.onerror = () => reject(new Error('账号组件加载失败，请刷新页面重试'));
      document.head.appendChild(script);
    });
    return authLoader;
  }

  const submit = document.getElementById('submit-score');
  const submitStatus = document.getElementById('submit-status');
  submit?.addEventListener('click', async event => {
    if (bypassAuth || submit.disabled) return;
    let me = null;
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data.authenticated) me = data.user;
    } catch {}
    if (me) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const auth = await ensureScoreAuth();
      await auth.ensureAccount();
      bypassAuth = true;
      submit.click();
      bypassAuth = false;
    } catch (error) {
      bypassAuth = false;
      if (submitStatus) submitStatus.textContent = error.message;
    }
  }, true);
})();
