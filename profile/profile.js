'use strict';

(async () => {
  const status = document.getElementById('status');
  const params = new URLSearchParams(location.search);
  let username = params.get('user');
  if (!username) {
    try {
      const me = await fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json());
      username = me.authenticated ? me.user.username : null;
    } catch {}
  }
  if (!username) {
    status.textContent = '请先登录，或从其他用户的主页链接进入。';
    return;
  }

  let data;
  try {
    const response = await fetch(`/api/social/profile/${encodeURIComponent(username)}`, { cache: 'no-store' });
    data = await response.json();
    if (!response.ok) throw new Error(data.error || '加载失败');
  } catch (error) {
    status.textContent = error.message;
    return;
  }

  const user = data.user;
  data.showcase ||= {};
  const DEFAULT_PROFILE_SECTION_ORDER = ['linked-accounts', 'abilities', 'game-records', 'recent-activity', 'achievements'];
  const normalizeProfileSectionOrder = order => {
    const seen = new Set();
    const result = [];
    for (const key of Array.isArray(order) ? order : []) {
      if (DEFAULT_PROFILE_SECTION_ORDER.includes(key) && !seen.has(key)) {
        seen.add(key);
        result.push(key);
      }
    }
    for (const key of DEFAULT_PROFILE_SECTION_ORDER) if (!seen.has(key)) result.push(key);
    return result;
  };
  const profileMain = document.querySelector('main');
  const profileStatusNode = document.getElementById('status');
  const profileSection = key => document.querySelector(`[data-profile-section="${key}"]`);
  const currentProfileSectionOrder = () => [...document.querySelectorAll('[data-profile-section]')].map(section => section.dataset.profileSection);
  function applyProfileSectionOrder(order) {
    if (!profileMain || !profileStatusNode) return;
    for (const key of normalizeProfileSectionOrder(order)) {
      const section = profileSection(key);
      if (section) profileMain.insertBefore(section, profileStatusNode);
    }
  }
  data.profileSectionOrder = normalizeProfileSectionOrder(data.profileSectionOrder);
  applyProfileSectionOrder(data.profileSectionOrder);

  const profileAvatar = document.getElementById('profile-avatar');
  document.title = `${user.nickname} · 霧月乐园`;
  profileAvatar.src = user.avatar;
  document.getElementById('profile-name').textContent = user.nickname;
  document.getElementById('profile-handle').textContent = `@${user.username}`;
  const profileStatus = document.getElementById('profile-status');
  if (user.statusMessage) { profileStatus.textContent = `“${user.statusMessage}”`; profileStatus.hidden = false; }
  const memberChip = document.getElementById('member-chip');
  memberChip.textContent = user.memberNo ? `No.${user.memberNo}` : '会员';
  memberChip.classList.toggle('early-member', Number(user.memberNo) > 0 && Number(user.memberNo) <= 100);
  const chips = memberChip.parentElement;
  if (user.memberNo === 1 || user.role === 'admin') {
    const roleChip = document.createElement('span');
    roleChip.className = `role-chip ${user.memberNo === 1 ? 'owner' : 'staff'}`;
    roleChip.textContent = user.memberNo === 1 ? 'OWNER' : 'STAFF';
    chips.insertBefore(roleChip, memberChip);
  }
  document.getElementById('level-chip').textContent = `Lv.${data.level}`;
  document.getElementById('joined-chip').textContent = `加入于 ${new Date(user.createdAt).toLocaleDateString('zh-CN')}`;
  document.getElementById('level').textContent = `Lv.${data.level}`;
  document.getElementById('xp').textContent = `${data.xp} XP`;
  document.getElementById('comments').textContent = data.comments;
  document.getElementById('followers').textContent = data.followers;
  document.getElementById('following').textContent = data.following;

  const PROFILE_ACTIVITY_TEXT = {
    browse: '正在逛霧月乐园',
    lol_lobby: '正在找 LOL 猜英雄房间',
    lol_play: '正在玩 LOL 猜英雄',
    guess_lobby: '正在找猜词房间',
    guess_play: '正在玩 霧月猜词',
    undercover: '正在玩谁是卧底',
    dodge: '正在玩闪避',
    reaction: '正在测试反应速度',
    click: '正在测试点击速度',
    osu_stream: '正在测试 osu! Stream 手速',
    rhythm_power: '正在测试音游底力',
    away: '暂时离开'
  };
  const presenceState = {
    online: data.presence?.online === true,
    away: data.presence?.away === true,
    activity: data.presence?.activity || null,
    lastSeen: Number(data.presence?.lastSeen) || null,
    totalBaseMs: Math.max(0, Number(data.presence?.totalActiveMs) || 0),
    activeSince: data.presence?.online === true && data.presence?.away !== true ? Date.now() : null
  };

  function formatPresenceDuration(ms) {
    const minutes = Math.floor(Math.max(0, Number(ms) || 0) / 60000);
    if (minutes < 1) return '< 1 分钟';
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    if (days > 0) return `${days} 天 ${hours} 小时`;
    if (hours > 0) return mins ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`;
    return `${mins} 分钟`;
  }

  function relativePresenceTime(value) {
    const time = Number(value);
    if (!time) return '暂无记录';
    const diff = Math.max(0, Date.now() - time);
    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)} 天前`;
    return new Date(time).toLocaleDateString('zh-CN');
  }

  function currentPresenceTotal() {
    return presenceState.totalBaseMs + (presenceState.activeSince ? Math.max(0, Date.now() - presenceState.activeSince) : 0);
  }

  function renderProfilePresence() {
    const dot = document.getElementById('profile-presence-dot');
    const state = document.getElementById('profile-online-state');
    const activity = document.getElementById('profile-current-activity');
    const lastSeen = document.getElementById('profile-last-seen');
    const total = document.getElementById('profile-total-time');
    if (!dot || !state || !activity || !lastSeen || !total) return;

    dot.className = `profile-presence-dot ${presenceState.online ? (presenceState.away ? 'away' : 'online') : 'offline'}`;
    if (presenceState.online && !presenceState.away) {
      state.textContent = '在线';
      activity.textContent = PROFILE_ACTIVITY_TEXT[presenceState.activity] || '正在逛霧月乐园';
      lastSeen.textContent = '当前在线';
      lastSeen.removeAttribute('title');
    } else if (presenceState.online && presenceState.away) {
      state.textContent = '暂时离开';
      activity.textContent = '活跃时长已暂停累计';
      lastSeen.textContent = `${relativePresenceTime(presenceState.lastSeen)}活跃`;
      if (presenceState.lastSeen) lastSeen.title = new Date(presenceState.lastSeen).toLocaleString('zh-CN');
    } else {
      state.textContent = '离线';
      activity.textContent = '';
      lastSeen.textContent = relativePresenceTime(presenceState.lastSeen);
      if (presenceState.lastSeen) lastSeen.title = new Date(presenceState.lastSeen).toLocaleString('zh-CN');
    }
    total.textContent = formatPresenceDuration(currentPresenceTotal());
  }

  function syncProfilePresenceFromList(users) {
    const list = Array.isArray(users) ? users : [];
    const target = list.find(item => item?.account && typeof item.username === 'string' && item.username.toLowerCase() === user.username.toLowerCase()) || null;
    const now = Date.now();
    const wasOnline = presenceState.online;
    const wasActive = wasOnline && !presenceState.away;
    const nextOnline = Boolean(target);
    const nextAway = Boolean(target?.away);
    const nextActive = nextOnline && !nextAway;

    if (wasActive && !nextActive && presenceState.activeSince) {
      presenceState.totalBaseMs += Math.max(0, now - presenceState.activeSince);
      presenceState.activeSince = null;
    } else if (!wasActive && nextActive) {
      presenceState.activeSince = now;
    }

    if ((wasOnline && !nextOnline) || (wasActive && nextAway)) presenceState.lastSeen = now;
    if (nextActive) presenceState.lastSeen = now;

    presenceState.online = nextOnline;
    presenceState.away = nextAway;
    presenceState.activity = target?.activity || null;
    renderProfilePresence();
  }

  window.addEventListener('wuyue:presence-list', event => {
    syncProfilePresenceFromList(event.detail?.users);
  });
  renderProfilePresence();
  setInterval(renderProfilePresence, 30000);

  const settingsButton = document.getElementById('settings-button');
  const followButton = document.getElementById('follow-button');
  settingsButton.hidden = !data.isSelf;
  followButton.hidden = !!data.isSelf;

  if (!data.isSelf) {
    const syncFollow = () => {
      followButton.textContent = data.isFollowing ? '已关注' : '关注';
      followButton.classList.toggle('following', data.isFollowing);
    };
    syncFollow();
    followButton.addEventListener('click', async () => {
      followButton.disabled = true;
      try {
        const response = await fetch(`/api/social/follow/${encodeURIComponent(user.username)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '操作失败');
        data.isFollowing = result.following;
        document.getElementById('followers').textContent = result.followers;
        syncFollow();
      } catch (error) { status.textContent = error.message; }
      finally { followButton.disabled = false; }
    });
  }

  if (data.isSelf) {
    const dialog = document.getElementById('avatar-dialog');
    const preview = document.getElementById('avatar-preview');
    const fileInput = document.getElementById('avatar-file');
    const saveButton = document.getElementById('avatar-save');
    const resetButton = document.getElementById('avatar-reset');
    const closeButton = document.getElementById('avatar-close');
    const editorStatus = document.getElementById('avatar-editor-status');
    let selectedImage = '';
    let auth = null;

    const setEditorStatus = (text, ok = false) => {
      editorStatus.textContent = text;
      editorStatus.classList.toggle('ok', ok);
    };
    const ensureAuth = async () => {
      if (auth?.authenticated && auth.csrf) return auth;
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      auth = await response.json();
      if (!response.ok || !auth.authenticated || !auth.csrf) throw new Error('登录状态已过期，请重新登录。');
      return auth;
    };
    const openAvatarEditor = async () => {
      selectedImage = '';
      fileInput.value = '';
      saveButton.disabled = true;
      preview.src = user.avatar || 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg';
      setEditorStatus('');
      if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
      try { await ensureAuth(); }
      catch (error) { setEditorStatus(error.message); }
    };
    const closeAvatarEditor = () => {
      if (dialog.open && dialog.close) dialog.close(); else dialog.removeAttribute('open');
    };

    profileAvatar.classList.add('editable-avatar');
    profileAvatar.tabIndex = 0;
    profileAvatar.role = 'button';
    profileAvatar.title = '点击更换头像';
    profileAvatar.setAttribute('aria-label', '点击更换头像');
    profileAvatar.addEventListener('click', openAvatarEditor);
    profileAvatar.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openAvatarEditor(); }
    });
    closeButton.addEventListener('click', closeAvatarEditor);
    dialog.addEventListener('click', event => { if (event.target === dialog) closeAvatarEditor(); });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      selectedImage = '';
      saveButton.disabled = true;
      setEditorStatus('');
      if (!file) { preview.src = user.avatar || 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg'; return; }
      if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1024 * 1024) {
        setEditorStatus('请选择 1 MB 以内的 PNG 或 JPEG 图片。');
        fileInput.value = '';
        preview.src = user.avatar || 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg';
        return;
      }
      try {
        selectedImage = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('图片读取失败'));
          reader.readAsDataURL(file);
        });
        preview.src = selectedImage;
        saveButton.disabled = false;
      } catch (error) { setEditorStatus(error.message); }
    });

    saveButton.addEventListener('click', async () => {
      if (!selectedImage) return;
      saveButton.disabled = true;
      resetButton.disabled = true;
      setEditorStatus('正在保存头像…');
      try {
        const currentAuth = await ensureAuth();
        const response = await fetch('/api/auth/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': currentAuth.csrf },
          body: JSON.stringify({ image: selectedImage })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || '头像保存失败');
        user.avatar = result.avatar || user.avatar;
        profileAvatar.src = user.avatar;
        preview.src = user.avatar;
        selectedImage = '';
        fileInput.value = '';
        setEditorStatus('头像已更新。', true);
        setTimeout(closeAvatarEditor, 450);
      } catch (error) {
        setEditorStatus(error.message);
        saveButton.disabled = false;
      } finally { resetButton.disabled = false; }
    });

    resetButton.addEventListener('click', async () => {
      resetButton.disabled = true;
      saveButton.disabled = true;
      setEditorStatus('正在恢复默认头像…');
      try {
        const currentAuth = await ensureAuth();
        const response = await fetch('/api/auth/avatar', { method: 'DELETE', headers: { 'x-csrf-token': currentAuth.csrf } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || '操作失败');
        user.avatar = result.avatar || 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg';
        profileAvatar.src = user.avatar;
        preview.src = user.avatar;
        selectedImage = '';
        fileInput.value = '';
        setEditorStatus('已恢复默认头像。', true);
      } catch (error) { setEditorStatus(error.message); }
      finally { resetButton.disabled = false; }
    });
  }

  const scores = document.getElementById('scores');
  const ranks = data.scores.ranks || {};

  function percentileLabel(variant) {
    const total = Number(variant?.total) || 0;
    const percentile = Number(variant?.percentile);
    if (!Number.isFinite(percentile) || total < 1) return '';
    if (total === 1) return '当前唯一上榜纪录';
    const value = Number.isInteger(percentile) ? String(percentile) : percentile.toFixed(1);
    return `超过 ${value}% 的上榜玩家`;
  }

  function entertainmentRankLabel(variant) {
    const rank = Number(variant?.rank) || 0;
    const total = Number(variant?.total) || 0;
    if (!rank) return '';
    return total > 0 ? `娱乐榜 #${rank} / ${total}` : `娱乐榜 #${rank}`;
  }

  function clickVariants() {
    return Object.entries(data.scores.clickSpeed || {}).map(([seconds, score]) => ({
      id: seconds,
      label: `${seconds}s`,
      value: `${(score / Number(seconds)).toFixed(2)} CPS`,
      sub: `${score} 次`,
      rank: Number(ranks.clickSpeed?.[seconds]) || null,
      metric: score / Number(seconds)
    })).sort((a, b) => Number(a.id) - Number(b.id));
  }

  function osuVariants() {
    return Object.entries(data.scores.osuStream || {}).map(([seconds, item]) => {
      const extras = [];
      if (Number.isFinite(item.ur)) extras.push(`UR ${Number(item.ur).toFixed(1)}`);
      if (Number.isSafeInteger(item.taps)) extras.push(`${item.taps} taps`);
      if (Number.isFinite(item.alternation)) extras.push(`交替 ${Number(item.alternation).toFixed(1)}%`);
      return {
        id: seconds,
        label: `${seconds}s`,
        value: `${(item.score / 100).toFixed(1)} BPM`,
        sub: extras.join(' · ') || 'Stream 成绩',
        rank: Number(ranks.osuStream?.[seconds]) || null,
        metric: item.score / 100
      };
    }).sort((a, b) => Number(a.id) - Number(b.id));
  }

  function rhythmVariants() {
    const out = [];
    for (const [keys, group] of Object.entries(data.scores.rhythmPower || {})) {
      for (const [seconds, item] of Object.entries(group || {})) {
        const elapsed = Number(item.elapsedMs) || Number(seconds) * 1000;
        const avg = Number(item.avgSpeed) || item.score / (elapsed / 1000);
        const bpm = Number(item.bpm) || item.score * 15000 / elapsed;
        out.push({
          id: `${keys}:${seconds}`,
          label: `${keys}K · ${seconds}s`,
          value: `${avg.toFixed(2)}/s`,
          sub: `${item.score} 次 · ${(elapsed / 1000).toFixed(2)}s · ${bpm.toFixed(1)} BPM`,
          rank: Number(ranks.rhythmPower?.[keys]?.[seconds]) || null,
          metric: avg,
          keys: Number(keys), seconds: Number(seconds)
        });
      }
    }
    return out.sort((a, b) => a.keys - b.keys || a.seconds - b.seconds);
  }

  function chooseVariant(test, variants) {
    const selected = data.showcase?.[test];
    const chosen = variants.find(item => item.id === selected);
    if (chosen) return chosen;

    // 音游底力同时包含 /s 与 BPM 两种完全不同的量纲，不能直接拿 raw metric 比大小。
    // 未手动指定主页展示时，优先展示相对排行榜位置更好的那一项。
    if (test === 'rhythmPower' && variants.some(item => Number.isFinite(Number(item.percentile)))) {
      return [...variants].sort((a, b) => {
        const aPercentile = Number.isFinite(Number(a.percentile)) ? Number(a.percentile) : -1;
        const bPercentile = Number.isFinite(Number(b.percentile)) ? Number(b.percentile) : -1;
        return bPercentile - aPercentile || (a.rank || Infinity) - (b.rank || Infinity);
      })[0] || null;
    }

    return [...variants].sort((a, b) => b.metric - a.metric || (a.rank || Infinity) - (b.rank || Infinity))[0] || null;
  }

  async function setShowcase(test, variant) {
    try {
      const response = await fetch('/api/social/showcase', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test, variant })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '保存失败');
      data.showcase = result.showcase || data.showcase;
      renderScores();
      status.textContent = '主页展示成绩已更新。';
      setTimeout(() => { if (status.textContent === '主页展示成绩已更新。') status.textContent = ''; }, 1600);
    } catch (error) { status.textContent = error.message; }
  }

  function createVariantRow(test, variant, currentId) {
    const row = document.createElement('div');
    row.className = `score-variant${variant.id === currentId ? ' selected' : ''}`;
    const copy = document.createElement('div');
    const label = document.createElement('strong'); label.textContent = variant.label;
    const detail = document.createElement('small');
    const percentile = percentileLabel(variant);
    detail.textContent = `${variant.value}${variant.sub ? ` · ${variant.sub}` : ''}${percentile ? ` · ${percentile}` : ''}`;
    copy.append(label, detail);
    const side = document.createElement('div'); side.className = 'score-variant-side';
    if (variant.rank) { const rank = document.createElement('b'); rank.textContent = entertainmentRankLabel(variant); side.append(rank); }
    if (data.isSelf) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = variant.id === currentId ? '主显示' : '设为展示';
      button.disabled = variant.id === currentId;
      button.addEventListener('click', event => { event.stopPropagation(); setShowcase(test, variant.id); });
      side.append(button);
    }
    row.append(copy, side);
    return row;
  }

  function addScoreCard({ test = '', title, main, variants = [] }) {
    if (!main) return;
    const rank = Number(main.rank) || null;
    const card = document.createElement('div');
    card.className = 'score score-group';
    if (variants.length > 1) { card.tabIndex = 0; card.setAttribute('aria-label', `${title}，悬停或聚焦查看全部记录`); }
    const span = document.createElement('span'); span.textContent = title;
    const strong = document.createElement('strong'); strong.textContent = main.value;
    const meta = document.createElement('small'); meta.className = 'score-main-meta'; meta.textContent = `${main.label}${main.sub ? ` · ${main.sub}` : ''}`;
    card.append(span, strong, meta);
    const percentile = percentileLabel(main);
    if (percentile) {
      const standing = document.createElement('small');
      standing.className = 'score-standing';
      standing.textContent = percentile;
      card.append(standing);
    }
    if (rank) {
      const badge = document.createElement('b');
      badge.className = 'score-rank';
      badge.textContent = entertainmentRankLabel(main);
      badge.title = '能力测试排行榜仅供娱乐展示';
      card.append(badge);
    }
    if (variants.length > 1) {
      const popover = document.createElement('div'); popover.className = 'score-popover';
      const head = document.createElement('div'); head.className = 'score-popover-head'; head.innerHTML = `<strong>全部记录</strong><small>${data.isSelf ? '可选择主页主显示' : '各模式 / 时长的个人纪录'}</small>`;
      const list = document.createElement('div'); list.className = 'score-variant-list';
      for (const variant of variants) list.append(createVariantRow(test, variant, main.id));
      popover.append(head, list); card.append(popover);
    }
    scores.append(card);
  }

  function renderScores() {
    scores.replaceChildren();

    const profileAbilities = Array.isArray(data.profileData?.abilities) ? data.profileData.abilities : [];
    if (profileAbilities.length) {
      for (const card of profileAbilities) {
        const variants = Array.isArray(card.variants) ? card.variants.filter(Boolean) : [];
        if (!variants.length) continue;
        const test = card.showcaseKey || '';
        const main = test ? chooseVariant(test, variants) : variants[0];
        addScoreCard({ test, title: card.title || card.id || '能力测试', main, variants });
      }
      if (!scores.children.length) scores.innerHTML = '<p class="empty">还没有能力测试纪录。</p>';
      return;
    }

    let count = 0;
    if (data.scores.reaction) {
      addScoreCard({ title: '反应力', main: { id: 'reaction', label: '5 次平均', value: `${data.scores.reaction} ms`, sub: '', rank: ranks.reaction } }); count++;
    }
    const click = clickVariants();
    if (click.length) { addScoreCard({ test: 'clickSpeed', title: '点击速度', main: chooseVariant('clickSpeed', click), variants: click }); count++; }
    const osu = osuVariants();
    if (osu.length) { addScoreCard({ test: 'osuStream', title: 'osu! Stream', main: chooseVariant('osuStream', osu), variants: osu }); count++; }
    const rhythm = rhythmVariants();
    if (rhythm.length) { addScoreCard({ test: 'rhythmPower', title: '音游底力', main: chooseVariant('rhythmPower', rhythm), variants: rhythm }); count++; }
    if (data.scores.dodge) {
      addScoreCard({ title: '走位训练', main: { id: 'dodge', label: '最佳生存', value: `${(data.scores.dodge / 1000).toFixed(1)} 秒`, sub: '', rank: ranks.dodge } }); count++;
    }
    if (!count) scores.innerHTML = '<p class="empty">还没有能力测试纪录。</p>';
  }

  function renderLinkedAccounts() {
    const card = document.getElementById('linked-accounts-card');
    const host = document.getElementById('linked-accounts');
    if (!card || !host) return;
    const connections = Array.isArray(data.profileData?.connections) ? data.profileData.connections : [];
    host.replaceChildren();
    if (!connections.length) {
      if (!data.isSelf) {
        card.hidden = true;
        return;
      }
      card.hidden = false;
      const empty = document.createElement('div');
      empty.className = 'profile-link-prompt';

      const icon = document.createElement('span');
      icon.className = 'profile-link-prompt-icon';
      icon.textContent = 'osu!';

      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = '绑定你的 osu! 账号';
      const detail = document.createElement('span');
      detail.textContent = '通过 osu! 官方授权验证身份，并在个人主页展示 PP、排名等公开资料。';
      copy.append(title, detail);

      const action = document.createElement('a');
      action.className = 'profile-link-prompt-action';
      action.href = '/api/integrations/osu/start';
      action.textContent = '绑定 osu!';

      empty.append(icon, copy, action);
      host.append(empty);
      return;
    }
    card.hidden = false;

    const modeNames = { osu: 'osu!standard', taiko: 'osu!taiko', fruits: 'osu!catch', mania: 'osu!mania' };
    const numberText = value => {
      const number = Number(value);
      return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '—';
    };

    for (const connection of connections) {
      if (connection?.provider !== 'osu') continue;
      const item = document.createElement('a');
      item.className = 'profile-linked-account osu';
      const profileUrl = typeof connection.profileUrl === 'string' && /^https:\/\/osu\.ppy\.sh\/users\/\d+\/?$/i.test(connection.profileUrl)
        ? connection.profileUrl
        : `https://osu.ppy.sh/users/${encodeURIComponent(connection.userId || '')}`;
      item.href = profileUrl;
      item.target = '_blank';
      item.rel = 'noopener noreferrer';

      const avatarWrap = document.createElement('span');
      avatarWrap.className = 'profile-linked-avatar-wrap';
      if (typeof connection.avatarUrl === 'string' && /^https:\/\//i.test(connection.avatarUrl)) {
        const avatar = document.createElement('img');
        avatar.className = 'profile-linked-avatar';
        avatar.src = connection.avatarUrl;
        avatar.alt = '';
        avatar.loading = 'lazy';
        avatar.referrerPolicy = 'no-referrer';
        avatarWrap.appendChild(avatar);
      } else {
        avatarWrap.textContent = 'osu!';
      }

      const copy = document.createElement('span');
      copy.className = 'profile-linked-copy';
      const title = document.createElement('span');
      title.className = 'profile-linked-title';
      const name = document.createElement('strong');
      name.textContent = connection.username || 'osu! 玩家';
      const verified = document.createElement('em');
      verified.textContent = '✓ 已验证绑定';
      title.append(name, verified);

      const meta = document.createElement('span');
      meta.className = 'profile-linked-meta';
      const metaParts = [modeNames[connection.mode] || connection.mode || 'osu!'];
      if (connection.countryCode) metaParts.push(connection.countryCode);
      if (connection.supporter) metaParts.push('supporter');
      meta.textContent = metaParts.join(' · ');

      const stats = document.createElement('span');
      stats.className = 'profile-linked-stats';
      const cells = [
        ['PP', connection.pp != null && Number.isFinite(Number(connection.pp)) ? Number(connection.pp).toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '—'],
        ['全球', Number(connection.globalRank) > 0 ? `#${numberText(connection.globalRank)}` : '—'],
        ['国家', Number(connection.countryRank) > 0 ? `#${numberText(connection.countryRank)}` : '—'],
        ['准确率', connection.accuracy != null && Number.isFinite(Number(connection.accuracy)) ? `${Number(connection.accuracy).toFixed(2)}%` : '—']
      ];
      for (const [labelText, valueText] of cells) {
        const cell = document.createElement('span');
        const value = document.createElement('b');
        value.textContent = valueText;
        const label = document.createElement('small');
        label.textContent = labelText;
        cell.append(value, label);
        stats.append(cell);
      }

      const footer = document.createElement('span');
      footer.className = 'profile-linked-footer';
      const plays = Number(connection.playCount);
      footer.textContent = `${Number.isSafeInteger(plays) ? `游玩 ${numberText(plays)} 次 · ` : ''}查看 osu! 主页 ↗`;

      copy.append(title, meta, stats, footer);
      item.append(avatarWrap, copy);
      host.append(item);
    }

    if (!host.children.length) {
      card.hidden = !data.isSelf;
      return;
    }

    if (data.isSelf) {
      const manage = document.createElement('a');
      manage.className = 'profile-linked-manage';
      manage.href = '/account/settings.html';
      manage.textContent = '管理关联账号 →';
      host.append(manage);
    }
  }

  function renderGameRecords() {
    const host = document.getElementById('game-records');
    const card = document.getElementById('game-records-card');
    if (!host || !card) return;
    const games = Array.isArray(data.profileData?.games) ? data.profileData.games : [];
    host.replaceChildren();
    if (!games.length) {
      host.innerHTML = '<p class="empty">还没有可展示的长期游戏战绩。</p>';
      return;
    }

    for (const game of games) {
      const item = document.createElement(game.url ? 'a' : 'div');
      item.className = 'game-record';
      if (game.url) item.href = game.url;

      const head = document.createElement('div');
      head.className = 'game-record-head';
      const title = document.createElement('strong');
      title.textContent = game.title || game.id || '游戏';
      const arrow = document.createElement('span');
      arrow.textContent = game.url ? '进入游戏 ↗' : '';
      head.append(title, arrow);

      const stats = document.createElement('div');
      stats.className = 'game-record-stats';
      for (const stat of Array.isArray(game.stats) ? game.stats : []) {
        const cell = document.createElement('span');
        const value = document.createElement('b');
        value.textContent = stat.value ?? '—';
        const label = document.createElement('small');
        label.textContent = stat.label || '';
        cell.append(value, label);
        stats.append(cell);
      }

      item.append(head, stats);
      if (game.meta) {
        const meta = document.createElement('small');
        meta.className = 'game-record-meta';
        meta.textContent = game.meta;
        item.append(meta);
      }
      host.append(item);
    }
  }

  function renderRecentActivity() {
    const host = document.getElementById('recent-activity');
    if (!host) return;
    const activity = Array.isArray(data.profileData?.activity) ? data.profileData.activity : [];
    host.replaceChildren();
    if (!activity.length) {
      host.innerHTML = '<p class="empty">最近还没有可展示的活动。</p>';
      return;
    }

    for (const entry of activity) {
      const item = document.createElement(entry.url ? 'a' : 'div');
      item.className = `profile-activity-item activity-${entry.type || 'default'}`;
      if (entry.url) item.href = entry.url;

      const marker = document.createElement('span');
      marker.className = 'profile-activity-marker';
      marker.textContent = entry.type === 'game' ? '◆' : entry.type === 'comment' || entry.type === 'reply' ? '●' : '✦';

      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = entry.title || '活动';
      const detail = document.createElement('small');
      detail.textContent = entry.detail || '';
      copy.append(title, detail);

      const time = document.createElement('time');
      time.dateTime = entry.time || '';
      time.textContent = entry.time ? new Date(entry.time).toLocaleString('zh-CN') : '';

      item.append(marker, copy, time);
      host.append(item);
    }
  }

  async function saveProfileSectionOrder(order, previousOrder) {
    status.textContent = '正在保存主页布局…';
    try {
      const response = await fetch('/api/social/profile-layout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '主页布局保存失败');
      data.profileSectionOrder = normalizeProfileSectionOrder(result.order);
      status.textContent = '主页板块顺序已保存。';
      setTimeout(() => { if (status.textContent === '主页板块顺序已保存。') status.textContent = ''; }, 1400);
    } catch (error) {
      applyProfileSectionOrder(previousOrder);
      status.textContent = error.message;
    }
  }

  function enableProfileSectionSorting() {
    if (!data.isSelf || !profileMain || !profileStatusNode) return;
    const sections = [...document.querySelectorAll('[data-profile-section]')];
    let dragging = null;
    let placeholder = null;
    let startOrder = null;
    let activePointerId = null;
    let grabOffsetY = 0;
    let lastPointerY = 0;
    let autoScrollFrame = 0;

    const visibleSections = () => [...document.querySelectorAll('[data-profile-section]')]
      .filter(section => section !== dragging && !section.hidden && section.parentElement === profileMain);

    const stopAutoScroll = () => {
      if (autoScrollFrame) cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame = 0;
    };

    const tickAutoScroll = () => {
      if (!dragging) {
        autoScrollFrame = 0;
        return;
      }
      const edge = 90;
      let delta = 0;
      if (lastPointerY < edge) delta = -Math.ceil((edge - lastPointerY) / 7);
      else if (lastPointerY > innerHeight - edge) delta = Math.ceil((lastPointerY - (innerHeight - edge)) / 7);
      delta = Math.max(-18, Math.min(18, delta));
      if (delta) {
        scrollBy(0, delta);
        movePlaceholder(lastPointerY);
      }
      autoScrollFrame = requestAnimationFrame(tickAutoScroll);
    };

    const positionFloatingSection = clientY => {
      if (!dragging) return;
      dragging.style.top = `${Math.round(clientY - grabOffsetY)}px`;
    };

    function movePlaceholder(clientY) {
      if (!dragging || !placeholder) return;
      const candidates = visibleSections();
      let target = null;
      for (const section of candidates) {
        const rect = section.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          target = section;
          break;
        }
      }
      if (target) {
        if (placeholder.nextElementSibling !== target) profileMain.insertBefore(placeholder, target);
      } else if (placeholder.nextElementSibling !== profileStatusNode) {
        profileMain.insertBefore(placeholder, profileStatusNode);
      }
    }

    const cleanupPointerListeners = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      stopAutoScroll();
    };

    const restoreFloatingStyles = section => {
      section.classList.remove('profile-dragging');
      section.style.removeProperty('position');
      section.style.removeProperty('left');
      section.style.removeProperty('top');
      section.style.removeProperty('width');
      section.style.removeProperty('height');
      section.style.removeProperty('margin');
      section.style.removeProperty('z-index');
    };

    const finishDrag = cancelled => {
      if (!dragging) return;
      const section = dragging;
      const previousOrder = startOrder ? [...startOrder] : currentProfileSectionOrder();

      cleanupPointerListeners();
      if (placeholder?.parentElement === profileMain) {
        profileMain.insertBefore(section, placeholder);
        placeholder.remove();
      } else {
        profileMain.insertBefore(section, profileStatusNode);
      }
      restoreFloatingStyles(section);
      document.body.classList.remove('profile-sorting');

      dragging = null;
      placeholder = null;
      activePointerId = null;
      startOrder = null;

      if (cancelled) {
        applyProfileSectionOrder(previousOrder);
        return;
      }

      const nextOrder = currentProfileSectionOrder();
      if (nextOrder.join('|') !== previousOrder.join('|')) {
        saveProfileSectionOrder(nextOrder, previousOrder);
      }
    };

    function onPointerMove(event) {
      if (!dragging || event.pointerId !== activePointerId) return;
      event.preventDefault();
      lastPointerY = event.clientY;
      positionFloatingSection(event.clientY);
      movePlaceholder(event.clientY);
    }

    function onPointerUp(event) {
      if (!dragging || event.pointerId !== activePointerId) return;
      event.preventDefault();
      finishDrag(false);
    }

    function onPointerCancel(event) {
      if (!dragging || event.pointerId !== activePointerId) return;
      finishDrag(true);
    }

    const beginDrag = (section, event) => {
      if (dragging) return;
      const rect = section.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      event.preventDefault();
      activePointerId = event.pointerId;
      startOrder = currentProfileSectionOrder();
      lastPointerY = event.clientY;
      grabOffsetY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));

      placeholder = document.createElement('div');
      placeholder.className = 'profile-drag-placeholder';
      placeholder.style.height = `${Math.round(rect.height)}px`;
      section.before(placeholder);

      dragging = section;
      section.classList.add('profile-dragging');
      section.style.position = 'fixed';
      section.style.left = `${Math.round(rect.left)}px`;
      section.style.top = `${Math.round(rect.top)}px`;
      section.style.width = `${Math.round(rect.width)}px`;
      section.style.height = `${Math.round(rect.height)}px`;
      section.style.margin = '0';
      section.style.zIndex = '1000';
      document.body.append(section);
      document.body.classList.add('profile-sorting');

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp, { passive: false });
      window.addEventListener('pointercancel', onPointerCancel);
      autoScrollFrame = requestAnimationFrame(tickAutoScroll);
    };

    for (const section of sections) {
      const head = section.querySelector('.section-head');
      if (!head || head.querySelector('.profile-sort-handle')) continue;

      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'profile-sort-handle';
      handle.innerHTML = '<span aria-hidden="true">☰</span>';
      handle.title = '拖动调整板块顺序';
      handle.setAttribute('aria-label', '拖动调整这个板块的顺序');
      handle.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        beginDrag(section, event);
      });

      handle.addEventListener('keydown', event => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        const previousOrder = currentProfileSectionOrder();
        const visible = [...document.querySelectorAll('[data-profile-section]')]
          .filter(item => !item.hidden && item.parentElement === profileMain);
        const index = visible.indexOf(section);
        if (event.key === 'ArrowUp' && index > 0) {
          profileMain.insertBefore(section, visible[index - 1]);
        } else if (event.key === 'ArrowDown' && index >= 0 && index < visible.length - 1) {
          profileMain.insertBefore(visible[index + 1], section);
        } else {
          return;
        }
        saveProfileSectionOrder(currentProfileSectionOrder(), previousOrder);
      });

      head.append(handle);
    }
  }

  renderLinkedAccounts();
  renderScores();
  renderGameRecords();
  renderRecentActivity();
  enableProfileSectionSorting();

  const ach = document.getElementById('achievements');
  const achievements = Array.isArray(data.achievements) ? data.achievements : [];
  const unlockedCount = achievements.filter(item => item.unlocked).length;
  document.getElementById('achievement-count').textContent = `${unlockedCount} / ${achievements.length} 已解锁`;
  ach.replaceChildren();

  const grouped = new Map();
  for (const item of achievements) {
    const category = item.category || '其他';
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(item);
  }

  for (const [category, items] of grouped) {
    const section = document.createElement('section');
    section.className = 'achievement-category';
    const head = document.createElement('div');
    head.className = 'achievement-category-head';
    const title = document.createElement('h3');
    title.textContent = category;
    const progress = document.createElement('span');
    progress.textContent = `${items.filter(item => item.unlocked).length} / ${items.length}`;
    head.append(title, progress);

    const list = document.createElement('div');
    list.className = 'achievement-list';
    for (const item of items) {
      const card = document.createElement('div');
      card.className = `achievement ${item.unlocked ? 'unlocked' : 'locked'}`;
      card.setAttribute('aria-label', `${item.name}，${item.unlocked ? '已解锁' : '未解锁'}。${item.description}`);

      const badge = document.createElement('span');
      badge.className = 'achievement-badge';
      badge.textContent = item.icon || '✦';

      const copy = document.createElement('div');
      copy.className = 'achievement-copy';
      const name = document.createElement('strong');
      name.textContent = item.name;
      const description = document.createElement('small');
      description.textContent = item.description;
      const state = document.createElement('em');
      state.textContent = item.unlocked ? '已解锁' : '未解锁';
      copy.append(name, description, state);
      card.append(badge, copy);
      list.append(card);
    }
    section.append(head, list);
    ach.append(section);
  }
})();