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
      preview.src = user.avatar || '/default-avatar.jpg';
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
      if (!file) { preview.src = user.avatar || '/default-avatar.jpg'; return; }
      if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1024 * 1024) {
        setEditorStatus('请选择 1 MB 以内的 PNG 或 JPEG 图片。');
        fileInput.value = '';
        preview.src = user.avatar || '/default-avatar.jpg';
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
        user.avatar = result.avatar || '/default-avatar.jpg';
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

  function rankClass(rank) {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    if (rank && rank <= 10) return 'rank-top10';
    return '';
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
    const detail = document.createElement('small'); detail.textContent = `${variant.value}${variant.sub ? ` · ${variant.sub}` : ''}`;
    copy.append(label, detail);
    const side = document.createElement('div'); side.className = 'score-variant-side';
    if (variant.rank) { const rank = document.createElement('b'); rank.textContent = `#${variant.rank}`; side.append(rank); }
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
    card.className = `score score-group ${rankClass(rank)}`.trim();
    if (variants.length > 1) { card.tabIndex = 0; card.setAttribute('aria-label', `${title}，悬停或聚焦查看全部记录`); }
    const span = document.createElement('span'); span.textContent = title;
    const strong = document.createElement('strong'); strong.textContent = main.value;
    const meta = document.createElement('small'); meta.className = 'score-main-meta'; meta.textContent = `${main.label}${main.sub ? ` · ${main.sub}` : ''}`;
    card.append(span, strong, meta);
    if (rank) {
      const badge = document.createElement('b'); badge.className = 'score-rank'; badge.textContent = `#${rank}`; badge.title = `当前排行榜第 ${rank} 名`; card.append(badge);
    }
    if (variants.length > 1) {
      const popover = document.createElement('div'); popover.className = 'score-popover';
      const head = document.createElement('div'); head.className = 'score-popover-head'; head.innerHTML = `<strong>全部记录</strong><small>${data.isSelf ? '可选择主页主显示' : '各模式 / 时长排名'}</small>`;
      const list = document.createElement('div'); list.className = 'score-variant-list';
      for (const variant of variants) list.append(createVariantRow(test, variant, main.id));
      popover.append(head, list); card.append(popover);
    }
    scores.append(card);
  }

  function renderScores() {
    scores.replaceChildren();
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
    if (!count) scores.innerHTML = '<p class="empty">还没有排行榜成绩。</p>';
  }

  renderScores();

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