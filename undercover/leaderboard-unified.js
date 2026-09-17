(() => {
  'use strict';

  const box = document.getElementById('leaderboard');
  if (!box || typeof io !== 'function') return;

  if (!document.querySelector('link[data-wuyue-leaderboard-style]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://wuyue1337.github.io/wuyue-static/leaderboard-unified.css?v=1';
    link.dataset.wuyueLeaderboardStyle = '1';
    document.head.appendChild(link);
  }

  box.classList.add('wuyue-unified-board');
  let latestRows = [];
  let rendering = false;

  const pad = value => String(value).padStart(2, '0');
  function formatTime(value) {
    if (!value) return '历史记录';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '历史记录';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function appendBadges(info, row) {
    const role = row.memberNo === 1 || row.role === 'owner' ? 'owner' : row.role === 'admin' ? 'staff' : '';
    if (role) {
      const badge = document.createElement('span');
      badge.className = `leaderboard-role ${role}`;
      badge.textContent = role === 'owner' ? 'OWNER' : 'STAFF';
      info.appendChild(badge);
    }
    const memberNo = Number(row.memberNo);
    if (Number.isSafeInteger(memberNo) && memberNo > 0) {
      const badge = document.createElement('span');
      badge.className = `member-no${memberNo <= 100 ? ' founder' : ''}`;
      badge.textContent = `No.${memberNo}`;
      badge.title = `第 ${memberNo} 位注册用户`;
      info.appendChild(badge);
    }
  }

  function render(rows = latestRows) {
    latestRows = Array.isArray(rows) ? rows : [];
    rendering = true;
    try {
      box.replaceChildren();
      if (!latestRows.length) {
        const empty = document.createElement('div');
        empty.className = 'board-empty';
        empty.textContent = '还没有积分记录，来拿下第一局。';
        box.appendChild(empty);
        return;
      }

      for (const row of latestRows.slice(0, 10)) {
        const item = document.createElement(row.username ? 'a' : 'div');
        item.className = 'leaderboard-row';
        if (row.username) item.href = `/profile/?user=${encodeURIComponent(row.username)}`;

        const rank = document.createElement('span');
        rank.className = `leaderboard-rank${Number(row.rank) <= 3 ? ' top-rank' : ''}`;
        rank.textContent = `#${row.rank}`;

        const person = document.createElement('span');
        person.className = 'leaderboard-person';
        const avatarWrap = document.createElement('span');
        avatarWrap.className = 'leaderboard-avatar-link';
        const avatar = document.createElement('img');
        avatar.className = 'leaderboard-avatar';
        avatar.src = row.avatar || 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg';
        avatar.alt = `${row.nickname || '玩家'}的头像`;
        avatar.loading = 'lazy';
        avatar.addEventListener('error', () => { avatar.src = 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg'; }, { once: true });
        avatarWrap.appendChild(avatar);

        const info = document.createElement('span');
        info.className = 'leaderboard-person-info';
        const name = document.createElement('span');
        name.className = 'leaderboard-name';
        name.textContent = row.nickname || '玩家';
        info.appendChild(name);
        appendBadges(info, row);

        const details = document.createElement('span');
        details.className = 'leaderboard-details';
        const time = document.createElement('time');
        if (row.lastPlayedAt) time.dateTime = row.lastPlayedAt;
        time.textContent = formatTime(row.lastPlayedAt);
        details.appendChild(time);

        const record = document.createElement('span');
        record.className = 'leaderboard-project-detail';
        record.textContent = `${Number(row.wins) || 0} 胜 · ${Number(row.games) || 0} 局`;
        details.appendChild(record);
        info.appendChild(details);
        person.append(avatarWrap, info);

        const scoreBox = document.createElement('span');
        scoreBox.className = 'leaderboard-score-box';
        const score = document.createElement('strong');
        score.className = 'leaderboard-score';
        score.textContent = String(Number(row.score) || 0);
        const unit = document.createElement('small');
        unit.textContent = 'pt';
        scoreBox.append(score, unit);

        item.append(rank, person, scoreBox);
        box.appendChild(item);
      }
    } finally {
      rendering = false;
    }
  }

  const observer = new MutationObserver(() => {
    if (rendering || !latestRows.length) return;
    clearTimeout(observer.timer);
    observer.timer = setTimeout(() => render(latestRows), 20);
  });
  observer.observe(box, { childList: true, subtree: true });

  const socket = io('/undercover');
  socket.on('leaderboard', rows => render(rows));
  socket.on('connect', () => socket.emit('request_leaderboard'));
})();
