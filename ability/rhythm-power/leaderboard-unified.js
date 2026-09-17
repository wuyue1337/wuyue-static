(() => {
  'use strict';

  const list = document.getElementById('power-board-list');
  const status = document.getElementById('board-status');
  const keyRow = document.getElementById('key-count-row');
  const durationRow = document.getElementById('duration-row');
  if (!list || !status || !keyRow || !durationRow) return;

  if (!document.querySelector('link[data-wuyue-leaderboard-style]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/leaderboard-unified.css?v=1';
    link.dataset.wuyueLeaderboardStyle = '1';
    document.head.appendChild(link);
  }
  list.classList.add('wuyue-unified-board');

  const pad = value => String(value).padStart(2, '0');
  const formatTime = value => {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '时间未记录';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  const selectedKeys = () => Number(keyRow.querySelector('[data-keys].active')?.dataset.keys || 4);
  const selectedDuration = () => Number(durationRow.querySelector('[data-duration].active')?.dataset.duration || 20);
  const profileHref = entry => entry.username ? `/profile/?user=${encodeURIComponent(entry.username)}` : null;

  function appendBadges(info, entry) {
    const role = entry.memberNo === 1 || entry.role === 'owner' ? 'owner' : entry.role === 'admin' ? 'staff' : '';
    if (role) {
      const badge = document.createElement('span');
      badge.className = `leaderboard-role ${role}`;
      badge.textContent = role === 'owner' ? 'OWNER' : 'STAFF';
      info.appendChild(badge);
    }
    if (Number.isSafeInteger(entry.memberNo) && entry.memberNo > 0) {
      const member = document.createElement('span');
      member.className = `member-no${entry.memberNo <= 100 ? ' founder' : ''}`;
      member.textContent = `No.${entry.memberNo}`;
      member.title = `第 ${entry.memberNo} 位注册用户`;
      info.appendChild(member);
    }
  }

  function appendDetail(details, text, className = 'leaderboard-project-detail') {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    details.appendChild(span);
  }

  let decorating = false;
  let requestId = 0;

  async function decorate(force = false) {
    if (decorating) return;
    const existing = [...list.querySelectorAll('li:not(.board-empty)')];
    if (!force && existing.length && existing.every(row => row.classList.contains('wuyue-standardized'))) return;
    decorating = true;
    const id = ++requestId;
    const keys = selectedKeys();
    const duration = selectedDuration();
    try {
      const response = await fetch(`/api/leaderboard/rhythm-power?duration=${duration}&keys=${keys}&page=1`, { cache: 'no-store', credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok || id !== requestId) return;

      list.replaceChildren();
      if (!data.entries?.length) {
        const empty = document.createElement('li');
        empty.className = 'board-empty';
        empty.textContent = '还没有成绩，来拿第一个名次吧。';
        list.appendChild(empty);
        status.textContent = '共 0 条成绩';
        return;
      }

      for (const entry of data.entries.slice(0, 20)) {
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
        avatar.src = entry.avatar || '/default-avatar.jpg';
        avatar.alt = `${entry.name || '玩家'}的头像`;
        avatar.loading = 'lazy';
        avatar.addEventListener('error', () => { avatar.src = '/default-avatar.jpg'; }, { once: true });
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

        const elapsed = Number(entry.elapsedMs) || duration * 1000;
        const avg = Number(entry.avgSpeed) || entry.score / (elapsed / 1000);
        const bpm = Number(entry.bpm) || entry.score * 15000 / elapsed;
        appendDetail(details, `${(elapsed / 1000).toFixed(2)}s · ${avg.toFixed(2)}/s · ${bpm.toFixed(1)} BPM`);
        info.appendChild(details);
        person.append(avatarLink, info);

        const scoreBox = document.createElement('span');
        scoreBox.className = 'leaderboard-score-box';
        const score = document.createElement('strong');
        score.className = 'leaderboard-score';
        score.textContent = String(entry.score);
        const unit = document.createElement('small');
        unit.textContent = '次';
        scoreBox.append(score, unit);

        row.append(rank, person, scoreBox);
        list.appendChild(row);
      }
      status.textContent = `共 ${data.total || 0} 条成绩`;
    } catch {
      // 原排行榜失败提示由主逻辑处理，这里不覆盖测试功能。
    } finally {
      decorating = false;
    }
  }

  const observer = new MutationObserver(() => {
    clearTimeout(observer.timer);
    observer.timer = setTimeout(() => decorate(false), 30);
  });
  observer.observe(list, { childList: true, subtree: true });
  keyRow.addEventListener('click', () => setTimeout(() => decorate(true), 80));
  durationRow.addEventListener('click', () => setTimeout(() => decorate(true), 80));
  document.getElementById('submit-score')?.addEventListener('click', () => setTimeout(() => decorate(true), 500));
  setTimeout(() => decorate(true), 120);
})();
