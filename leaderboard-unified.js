(() => {
  'use strict';

  if (!document.querySelector('link[data-wuyue-leaderboard-style]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/leaderboard-unified.css?v=1';
    link.dataset.wuyueLeaderboardStyle = '1';
    document.head.appendChild(link);
  }

  function pad(value) { return String(value).padStart(2, '0'); }

  function formatTime(value, fallback = '时间未记录') {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return fallback;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function profileHref(entry) {
    return entry?.username ? `/profile/?user=${encodeURIComponent(entry.username)}` : null;
  }

  function appendIdentityBadges(host, entry) {
    const role = entry?.memberNo === 1 || entry?.role === 'owner' ? 'owner' : entry?.role === 'admin' ? 'staff' : '';
    if (role) {
      const badge = document.createElement('span');
      badge.className = `leaderboard-role ${role}`;
      badge.textContent = role === 'owner' ? 'OWNER' : 'STAFF';
      host.appendChild(badge);
    }
    const memberNo = Number(entry?.memberNo);
    if (Number.isSafeInteger(memberNo) && memberNo > 0) {
      const badge = document.createElement('span');
      badge.className = `member-no${memberNo <= 100 ? ' founder' : ''}`;
      badge.textContent = `No.${memberNo}`;
      badge.title = `第 ${memberNo} 位注册用户`;
      host.appendChild(badge);
    }
  }

  function createPerson(entry) {
    const person = document.createElement('span');
    person.className = 'leaderboard-person';
    const href = profileHref(entry);

    const avatarLink = document.createElement(href ? 'a' : 'span');
    avatarLink.className = 'leaderboard-avatar-link';
    if (href) {
      avatarLink.href = href;
      avatarLink.title = `查看 ${entry?.name || entry?.nickname || '玩家'} 的个人主页`;
    }
    const avatar = document.createElement('img');
    avatar.className = 'leaderboard-avatar';
    avatar.src = entry?.avatar || '/default-avatar.jpg';
    avatar.alt = `${entry?.name || entry?.nickname || '玩家'}的头像`;
    avatar.loading = 'lazy';
    avatar.addEventListener('error', () => { avatar.src = '/default-avatar.jpg'; }, { once: true });
    avatarLink.appendChild(avatar);

    const info = document.createElement('span');
    info.className = 'leaderboard-person-info';
    const name = document.createElement(href ? 'a' : 'span');
    name.className = 'leaderboard-name';
    if (href) name.href = href;
    name.textContent = entry?.name || entry?.nickname || '未命名';
    info.appendChild(name);
    appendIdentityBadges(info, entry || {});

    const details = document.createElement('span');
    details.className = 'leaderboard-details';
    info.appendChild(details);
    person.append(avatarLink, info);
    return { person, info, details };
  }

  function appendTime(details, value, fallback = '时间未记录') {
    const time = document.createElement('time');
    if (value) time.dateTime = String(value);
    time.textContent = formatTime(value, fallback);
    details.appendChild(time);
    return time;
  }

  function appendDetail(details, text, className = 'leaderboard-project-detail') {
    if (!text) return null;
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    details.appendChild(span);
    return span;
  }

  function createRank(rank) {
    const span = document.createElement('span');
    span.className = `leaderboard-rank${Number(rank) <= 3 ? ' top-rank' : ''}`;
    span.textContent = `#${Number(rank) || '—'}`;
    return span;
  }

  function createScore(value, unit = '') {
    const box = document.createElement('span');
    box.className = 'leaderboard-score-box';
    const score = document.createElement('strong');
    score.className = 'leaderboard-score';
    score.textContent = String(value);
    const small = document.createElement('small');
    small.textContent = unit;
    box.append(score, small);
    return box;
  }

  function applyList(list) {
    list?.classList.add('wuyue-unified-board');
  }

  window.WuyueLeaderboardUI = {
    formatTime,
    profileHref,
    appendIdentityBadges,
    createPerson,
    appendTime,
    appendDetail,
    createRank,
    createScore,
    applyList
  };
})();
