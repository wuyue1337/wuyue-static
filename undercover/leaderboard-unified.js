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

  box.classList.add('career-board');
  let latestRows = [];
  let rendering = false;

  const defaultAvatar = 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg';
  const pad = value => String(value).padStart(2, '0');

  function formatTime(value) {
    if (!value) return '暂无最近对局时间';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无最近对局时间';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function normalizeAvatar(value) {
    return value && value !== '/default-avatar.jpg' ? value : defaultAvatar;
  }

  function appendBadges(host, row) {
    const role = row.memberNo === 1 || row.role === 'owner' ? 'owner' : row.role === 'admin' ? 'staff' : '';
    if (role) {
      const badge = document.createElement('span');
      badge.className = `leaderboard-role ${role}`;
      badge.textContent = role === 'owner' ? 'OWNER' : 'STAFF';
      host.appendChild(badge);
    }

    const memberNo = Number(row.memberNo);
    if (Number.isSafeInteger(memberNo) && memberNo > 0) {
      const badge = document.createElement('span');
      badge.className = `member-no${memberNo <= 100 ? ' founder' : ''}`;
      badge.textContent = `No.${memberNo}`;
      badge.title = `第 ${memberNo} 位注册用户`;
      host.appendChild(badge);
    }
  }

  function stat(label, value) {
    const item = document.createElement('span');
    item.className = 'career-stat';

    const strong = document.createElement('strong');
    strong.textContent = String(value);

    const small = document.createElement('small');
    small.textContent = label;

    item.append(strong, small);
    return item;
  }

  function render(rows = latestRows) {
    latestRows = Array.isArray(rows) ? rows : [];
    rendering = true;

    try {
      box.replaceChildren();

      if (!latestRows.length) {
        const empty = document.createElement('div');
        empty.className = 'board-empty career-empty';
        empty.textContent = '还没有长期积分记录，完成一局后就会出现在这里。';
        box.appendChild(empty);
        return;
      }

      for (const row of latestRows.slice(0, 10)) {
        const games = Math.max(0, Number(row.games) || 0);
        const wins = Math.max(0, Number(row.wins) || 0);
        const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;

        const item = document.createElement(row.username ? 'a' : 'div');
        const rankNumber = Number(row.rank) || 0;
        item.className = `career-row${rankNumber >= 1 && rankNumber <= 3 ? ` rank-${rankNumber}` : ''}`;
        if (row.username) {
          item.href = `/profile/?user=${encodeURIComponent(row.username)}`;
          item.title = `查看 ${row.nickname || '玩家'} 的个人主页`;
        }

        const top = document.createElement('div');
        top.className = 'career-row-main';

        const rank = document.createElement('span');
        rank.className = 'career-rank';
        rank.textContent = `#${row.rank || '—'}`;

        const avatar = document.createElement('img');
        avatar.className = 'career-avatar';
        avatar.src = normalizeAvatar(row.avatar);
        avatar.alt = `${row.nickname || '玩家'}的头像`;
        avatar.loading = 'lazy';
        avatar.addEventListener('error', () => { avatar.src = defaultAvatar; }, { once: true });

        const identity = document.createElement('span');
        identity.className = 'career-identity';

        const nameLine = document.createElement('span');
        nameLine.className = 'career-name-line';

        const name = document.createElement('strong');
        name.className = 'career-name';
        name.textContent = row.nickname || '玩家';

        nameLine.appendChild(name);
        appendBadges(nameLine, row);

        const lastPlayed = document.createElement('time');
        lastPlayed.className = 'career-last-played';
        if (row.lastPlayedAt) lastPlayed.dateTime = row.lastPlayedAt;
        lastPlayed.textContent = formatTime(row.lastPlayedAt);

        identity.append(nameLine, lastPlayed);

        const score = document.createElement('span');
        score.className = 'career-score';

        const scoreValue = document.createElement('strong');
        scoreValue.textContent = String(Number(row.score) || 0);

        const scoreUnit = document.createElement('small');
        scoreUnit.textContent = '积分';

        score.append(scoreValue, scoreUnit);
        top.append(rank, avatar, identity, score);

        const stats = document.createElement('div');
        stats.className = 'career-stats';
        stats.append(
          stat('胜场', wins),
          stat('对局', games),
          stat('胜率', `${winRate}%`)
        );

        item.append(top, stats);
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