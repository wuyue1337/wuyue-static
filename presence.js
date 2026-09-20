(function () {
  'use strict';

  if (window.__WUYUE_PRESENCE_STARTED__) return;
  window.__WUYUE_PRESENCE_STARTED__ = true;

  const IDLE_MS = 5 * 60 * 1000;
  const PANEL_KEY = 'wuyue-presence-open';
  const DEFAULT_AVATAR_URL = 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg';
  const ACTIVITY = {
    browse: '🏠 正在逛霧月乐园', lol_lobby: '⚔️ 正在找 LOL 猜英雄房间', lol_play: '🎮 正在玩 LOL 猜英雄',
    guess_lobby: '🔎 正在找猜词房间', guess_play: '🎯 正在玩 霧月猜词', undercover: '🕵️ 正在玩谁是卧底', dodge: '✨ 正在玩闪避',
    reaction: '⚡ 正在测试反应速度', click: '🖱️ 正在测试点击速度', osu_stream: '⌨️ 正在测试 osu! Stream 手速',
    rhythm_power: '🎵 正在测试音游底力', world_chat: '🌐 正在世界频道聊天', away: '🌙 暂时离开'
  };
  let socket = null, currentActivity = 'browse', isAway = false, idleTimer = null, started = false, memoryVisitorId = null;
  let followed = new Set();
  let channelOpen = false, worldJoined = false, worldHasMore = false, worldLoading = false, unread = 0;
  let viewer = { authenticated:false, userId:null, canModerate:false, muted:false };
  const worldMessages = new Map();

  function visitorId() {
    const key = 'wuyue-presence-visitor';
    try {
      let id = localStorage.getItem(key);
      if (!id) { id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem(key, id); }
      return id;
    } catch (_) { memoryVisitorId ||= `${Date.now()}-${Math.random().toString(36).slice(2)}`; return memoryVisitorId; }
  }
  function normalizeAvatarUrl(value) {
    if (!value || /(?:^|\/)default-avatar\.jpg(?:[?#].*)?$/i.test(value)) return DEFAULT_AVATAR_URL;
    return value;
  }
  function inferActivity() {
    const path = location.pathname.toLowerCase();
    if (path.startsWith('/lol')) { const room = document.getElementById('screen-room'); return room && !room.classList.contains('hidden') ? 'lol_play' : 'lol_lobby'; }
    if (path.startsWith('/guess')) { const room = document.getElementById('roomView'); return room && !room.classList.contains('hidden') ? 'guess_play' : 'guess_lobby'; }
    if (path.startsWith('/undercover')) return 'undercover';
    if (path.startsWith('/dodge')) return 'dodge';
    if (path.startsWith('/ability/osu-stream')) return 'osu_stream';
    if (path.startsWith('/ability/rhythm-power')) return 'rhythm_power';
    if (path.startsWith('/ability/reaction')) return 'reaction';
    if (path.startsWith('/ability/click-speed')) return 'click';
    return 'browse';
  }
  function desiredActivity() { return channelOpen ? 'world_chat' : inferActivity(); }
  function emitState() { if (socket?.connected) socket.emit('presence:activity', { activity: isAway ? 'away' : currentActivity }); }
  function setActivity(activity) { if (!ACTIVITY[activity] || activity === 'away') return; currentActivity = activity; if (!isAway) emitState(); }
  function markActive() {
    const wasAway = isAway; isAway = false; currentActivity = desiredActivity(); clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { isAway = true; emitState(); }, IDLE_MS);
    if (wasAway) emitState();
  }
  function ensureStyles() {
    if (document.querySelector('link[data-wuyue-presence]')) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://wuyue1337.github.io/wuyue-static/presence.css?v=20260920-1'; link.dataset.wuyuePresence = '1'; document.head.appendChild(link);
  }
  function savedPanelOpen() {
    try { return localStorage.getItem(PANEL_KEY) === '1'; } catch (_) { return false; }
  }
  function setPanelOpen(wrap, toggle, open) {
    channelOpen = Boolean(open);
    wrap.classList.toggle('presence-open', channelOpen);
    toggle.setAttribute('aria-expanded', String(channelOpen));
    if (channelOpen) {
      unread = 0;
      updateUnread();
      requestAnimationFrame(() => scrollWorldToBottom(false));
    }
    currentActivity = desiredActivity();
    if (!isAway) emitState();
    try { localStorage.setItem(PANEL_KEY, channelOpen ? '1' : '0'); } catch (_) {}
  }
  function ensurePanel() {
    if (document.getElementById('wuyue-presence')) return;
    const wrap = document.createElement('div'); wrap.id = 'wuyue-presence';
    wrap.innerHTML = `
      <button class="presence-toggle world-toggle" id="presenceToggle" type="button" aria-expanded="false" aria-controls="presencePanel">
        <span class="presence-toggle-dot"></span><span>世界频道</span><b id="presenceCount">0</b><i id="worldUnread" hidden>0</i>
      </button>
      <aside class="presence-panel world-panel" id="presencePanel" aria-label="世界频道">
        <div class="presence-head world-head">
          <div class="world-head-copy"><strong>世界频道</strong><small>乐园里的大家都能看到</small></div>
          <div class="presence-head-actions">
            <button class="world-online-toggle" id="worldOnlineToggle" type="button" aria-expanded="false"><span id="presenceHeadCount">0 人在线</span></button>
            <button class="presence-close" id="presenceClose" type="button" aria-label="收起世界频道">×</button>
          </div>
        </div>
        <section class="world-online-drawer" id="worldOnlineDrawer" hidden>
          <div class="world-online-title"><strong>在线用户</strong><span>点击昵称查看个人资料</span></div>
          <div class="presence-list" id="presenceList"><div class="presence-empty">正在连接…</div></div>
        </section>
        <div class="world-chat">
          <button class="world-load-more" id="worldLoadMore" type="button" hidden>加载更早消息</button>
          <div class="world-message-list" id="worldMessageList" aria-live="polite"><div class="world-empty">正在连接世界频道…</div></div>
        </div>
        <div class="world-composer">
          <div class="world-compose-status" id="worldComposeStatus"></div>
          <div class="world-compose-row">
            <textarea id="worldInput" rows="2" maxlength="300" placeholder="说点什么吧…" aria-label="世界频道消息"></textarea>
            <button id="worldSend" type="button">发送</button>
          </div>
          <div class="world-compose-foot"><span id="worldLoginHint">登录账号后即可发言</span><span id="worldCharCount">0 / 300</span></div>
        </div>
      </aside>`;
    document.body.appendChild(wrap);
    const toggle = document.getElementById('presenceToggle');
    const close = document.getElementById('presenceClose');
    const onlineToggle = document.getElementById('worldOnlineToggle');
    const onlineDrawer = document.getElementById('worldOnlineDrawer');
    const input = document.getElementById('worldInput');
    const send = document.getElementById('worldSend');
    const loadMore = document.getElementById('worldLoadMore');
    const open = savedPanelOpen();
    setPanelOpen(wrap, toggle, open);
    toggle.addEventListener('click', () => setPanelOpen(wrap, toggle, !wrap.classList.contains('presence-open')));
    close.addEventListener('click', () => setPanelOpen(wrap, toggle, false));
    onlineToggle.addEventListener('click', () => {
      const expanded = onlineToggle.getAttribute('aria-expanded') !== 'true';
      onlineToggle.setAttribute('aria-expanded', String(expanded));
      onlineDrawer.hidden = !expanded;
    });
    input.addEventListener('input', () => {
      document.getElementById('worldCharCount').textContent = `${[...input.value].length} / 300`;
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendWorldMessage();
      }
    });
    send.addEventListener('click', () => viewer.authenticated ? sendWorldMessage() : goLogin());
    loadMore.addEventListener('click', loadOlderWorldMessages);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && wrap.classList.contains('presence-open')) setPanelOpen(wrap, toggle, false); });
    updateComposer();
    updateUnread();
  }

  function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  async function loadFollowing() {
    try {
      const data = await fetch('/api/social/following', { cache: 'no-store' }).then(r => r.json());
      followed = new Set((data.following || []).map(user => user.username));
    } catch { followed = new Set(); }
  }
  function roleBadge(role) {
    if (role === 'founder') return '<span class="presence-role presence-role-owner">OWNER</span>';
    if (role === 'admin') return '<span class="presence-role presence-role-staff">STAFF</span>';
    return '';
  }
  function render(users) {
    ensurePanel();
    const list = document.getElementById('presenceList');
    const sorted = Array.isArray(users) ? [...users].sort((a,b) => {
      const fa = followed.has(a.username), fb = followed.has(b.username);
      if (fa !== fb) return fa ? -1 : 1;
      if (a.away !== b.away) return a.away ? 1 : -1;
      if (a.account !== b.account) return a.account ? -1 : 1;
      return 0;
    }) : [];
    document.getElementById('presenceCount').textContent = sorted.length;
    document.getElementById('presenceHeadCount').textContent = `${sorted.length} 人在线`;
    window.dispatchEvent(new CustomEvent('wuyue:presence-list', { detail: { users: sorted } }));
    if (!sorted.length) { list.innerHTML = '<div class="presence-empty">现在还没有其他人在线</div>'; return; }
    list.innerHTML = sorted.map(user => {
      const badge = roleBadge(user.role);
      const star = followed.has(user.username) ? '<span class="presence-following" title="已关注">★</span>' : '';
      const number = user.account && user.memberNo ? `<span class="presence-member-no${Number(user.memberNo) <= 100 ? ' founder' : ''}" title="第 ${escapeHtml(user.memberNo)} 位注册用户">No.${escapeHtml(user.memberNo)}</span>` : '';
      const nameRow = `<div class="presence-name-row"><strong>${star}${escapeHtml(user.nickname || '游客')}</strong>${badge}${number}</div>`;
      const avatarUrl = normalizeAvatarUrl(user.avatar);
      const inner = `<div class="presence-avatar-wrap"><img class="presence-avatar" src="${escapeHtml(avatarUrl)}" alt=""><span class="presence-dot"></span></div><div class="presence-copy">${nameRow}<span class="presence-activity">${escapeHtml(ACTIVITY[user.activity] || ACTIVITY.browse)}</span>${user.statusMessage ? `<small>“${escapeHtml(user.statusMessage)}”</small>` : ''}</div>`;
      return user.account && user.username ? `<a class="presence-user ${user.away ? 'is-away' : ''}" href="/profile/?user=${encodeURIComponent(user.username)}">${inner}</a>` : `<div class="presence-user ${user.away ? 'is-away' : ''}">${inner}</div>`;
    }).join('');
  }

  function updateUnread() {
    const badge = document.getElementById('worldUnread');
    if (!badge) return;
    badge.hidden = unread <= 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
  }

  function goLogin() {
    const next = location.pathname + location.search + location.hash;
    location.href = `/account/?view=login&next=${encodeURIComponent(next)}`;
  }

  function setComposeStatus(text, tone = '') {
    const host = document.getElementById('worldComposeStatus');
    if (!host) return;
    host.textContent = text || '';
    host.dataset.tone = tone;
  }

  function updateComposer() {
    const input = document.getElementById('worldInput');
    const send = document.getElementById('worldSend');
    const hint = document.getElementById('worldLoginHint');
    if (!input || !send || !hint) return;
    if (!viewer.authenticated) {
      input.disabled = true;
      input.placeholder = '登录后才能在世界频道发言';
      send.textContent = '登录';
      send.disabled = false;
      hint.textContent = '登录账号后即可发言';
      return;
    }
    if (viewer.muted) {
      input.disabled = true;
      input.placeholder = '你当前处于禁言状态';
      send.textContent = '已禁言';
      send.disabled = true;
      hint.textContent = '禁言期间仍可以查看世界频道';
      return;
    }
    input.disabled = false;
    input.placeholder = '说点什么吧…';
    send.textContent = '发送';
    send.disabled = false;
    hint.textContent = 'Enter 发送 · Shift+Enter 换行';
  }

  function messageRoleBadge(role) {
    if (role === 'founder') return '<span class="world-role world-role-owner">OWNER</span>';
    if (role === 'admin') return '<span class="world-role world-role-staff">STAFF</span>';
    return '';
  }

  function formatMessageTime(value) {
    const date = new Date(Number(value) || Date.now());
    const now = new Date();
    const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
    const hh = String(date.getHours()).padStart(2, '0'), mm = String(date.getMinutes()).padStart(2, '0');
    return sameDay ? `${hh}:${mm}` : `${date.getMonth()+1}/${date.getDate()} ${hh}:${mm}`;
  }

  function worldMessageHtml(message) {
    const user = message?.user || {};
    const username = user.username ? encodeURIComponent(user.username) : '';
    const profileHref = username ? `/profile/?user=${username}` : '';
    const avatar = escapeHtml(normalizeAvatarUrl(user.avatar));
    const nickname = escapeHtml(user.nickname || '已注销用户');
    const member = user.memberNo ? `<span class="world-member-no">No.${escapeHtml(user.memberNo)}</span>` : '';
    const role = messageRoleBadge(user.role);
    const name = profileHref ? `<a href="${profileHref}">${nickname}</a>` : `<strong>${nickname}</strong>`;
    const avatarNode = profileHref
      ? `<a class="world-avatar-link" href="${profileHref}"><img src="${avatar}" alt=""></a>`
      : `<span class="world-avatar-link"><img src="${avatar}" alt=""></span>`;
    const body = escapeHtml(message.text || '').replace(/\n/g, '<br>');
    const remove = viewer.canModerate ? `<button class="world-delete" type="button" data-world-delete="${Number(message.id)}" title="删除这条消息">删除</button>` : '';
    return `<article class="world-message" data-world-id="${Number(message.id)}">${avatarNode}<div class="world-message-main"><div class="world-message-meta"><span class="world-message-name">${name}${role}${member}</span><time>${formatMessageTime(message.createdAt)}</time>${remove}</div><div class="world-message-text">${body}</div></div></article>`;
  }

  function renderWorldMessages({ preserveTop = false } = {}) {
    const list = document.getElementById('worldMessageList');
    if (!list) return;
    const previousHeight = list.scrollHeight;
    const previousTop = list.scrollTop;
    const messages = [...worldMessages.values()].sort((a,b) => Number(a.id) - Number(b.id));
    list.innerHTML = messages.length
      ? messages.map(worldMessageHtml).join('')
      : '<div class="world-empty">世界频道还没有消息，来当第一个说话的人吧。</div>';
    list.querySelectorAll('[data-world-delete]').forEach(button => button.addEventListener('click', () => deleteWorldMessage(Number(button.dataset.worldDelete))));
    if (preserveTop) list.scrollTop = list.scrollHeight - previousHeight + previousTop;
  }

  function scrollWorldToBottom(force = true) {
    const list = document.getElementById('worldMessageList');
    if (!list) return;
    if (force || list.scrollHeight - list.scrollTop - list.clientHeight < 100) list.scrollTop = list.scrollHeight;
  }

  function applyWorldPage(data, { older = false } = {}) {
    for (const message of data?.messages || []) worldMessages.set(Number(message.id), message);
    worldHasMore = Boolean(data?.hasMore);
    const loadMore = document.getElementById('worldLoadMore');
    if (loadMore) loadMore.hidden = !worldHasMore;
    renderWorldMessages({ preserveTop: older });
    if (!older) requestAnimationFrame(() => scrollWorldToBottom(true));
  }

  function joinWorld() {
    if (!socket?.connected) return;
    socket.emit('world:join', {}, data => {
      if (!data?.ok) {
        setComposeStatus(data?.error || '世界频道连接失败', 'error');
        return;
      }
      worldJoined = true;
      viewer = data.viewer || viewer;
      worldMessages.clear();
      applyWorldPage(data);
      updateComposer();
      setComposeStatus('');
    });
  }

  function loadOlderWorldMessages() {
    if (worldLoading || !worldHasMore || !socket?.connected) return;
    const ids = [...worldMessages.keys()].filter(Number.isFinite);
    const beforeId = ids.length ? Math.min(...ids) : 0;
    if (!beforeId) return;
    worldLoading = true;
    const button = document.getElementById('worldLoadMore');
    if (button) { button.disabled = true; button.textContent = '加载中…'; }
    socket.emit('world:history', { beforeId }, data => {
      worldLoading = false;
      if (button) { button.disabled = false; button.textContent = '加载更早消息'; }
      if (!data?.ok) return setComposeStatus(data?.error || '历史消息加载失败', 'error');
      applyWorldPage(data, { older:true });
    });
  }

  function sendWorldMessage() {
    const input = document.getElementById('worldInput');
    const button = document.getElementById('worldSend');
    if (!input || !button || !viewer.authenticated || input.disabled || !socket?.connected) return;
    const text = input.value.trim();
    if (!text) return;
    button.disabled = true;
    setComposeStatus('发送中…');
    socket.emit('world:send', { text }, data => {
      button.disabled = false;
      if (!data?.ok) {
        if (data?.code === 'AUTH_REQUIRED') {
          viewer.authenticated = false;
          updateComposer();
        } else if (data?.code === 'MUTED') {
          viewer.muted = true;
          updateComposer();
        }
        setComposeStatus(data?.error || '发送失败，请重试', 'error');
        return;
      }
      input.value = '';
      document.getElementById('worldCharCount').textContent = '0 / 300';
      setComposeStatus('');
      input.focus();
    });
  }

  function deleteWorldMessage(id) {
    if (!viewer.canModerate || !socket?.connected || !Number.isFinite(id)) return;
    if (!confirm('确定删除这条世界频道消息吗？')) return;
    socket.emit('world:delete', { id }, data => {
      if (!data?.ok) setComposeStatus(data?.error || '删除失败', 'error');
    });
  }

  async function loadVisitorStats() {
    try {
      const response = await fetch('/api/visit-stats', { cache:'no-store', credentials:'same-origin' });
      const data = await response.json();
      if (!response.ok) return;
      const target = document.getElementById('visit-stats');
      if (target) target.textContent = `注册用户 ${Number(data.registered || 0).toLocaleString('zh-CN')} · 累计访客 ${Number(data.total || 0).toLocaleString('zh-CN')} · 今日访客 ${Number(data.today || 0).toLocaleString('zh-CN')}`;
    } catch {}
  }
  async function loadAnnouncement() {
    try {
      const response = await fetch('/api/announcements/current', { cache:'no-store' });
      const data = await response.json();
      if (!response.ok || !data.announcement || document.getElementById('wuyue-announcement')) return;
      const bar = document.createElement('div');
      bar.id = 'wuyue-announcement';
      bar.style.cssText = 'position:relative;z-index:9998;margin:0;padding:10px 48px 10px 16px;text-align:center;background:linear-gradient(90deg,#3d3365,#292a55);color:#fff;border-bottom:1px solid #625f8d;font:600 14px/1.6 system-ui,"Microsoft YaHei",sans-serif;box-shadow:0 5px 18px #0002';
      const label = document.createElement('span'); label.textContent = `📢 站长公告：${data.announcement.text}`;
      const close = document.createElement('button'); close.type='button'; close.textContent='×'; close.setAttribute('aria-label','关闭公告');
      close.style.cssText='position:absolute;right:14px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#fff;font-size:22px;cursor:pointer';
      close.onclick = () => bar.remove(); bar.append(label, close); document.body.prepend(bar);
    } catch {}
  }
  async function decorateProfileRole() {
    if (!location.pathname.startsWith('/profile')) return;
    const username = new URLSearchParams(location.search).get('user');
    if (!username) return;
    try {
      const response = await fetch(`/api/mod/role/${encodeURIComponent(username)}`, { cache:'no-store' });
      const data = await response.json();
      if (!response.ok || data.role === 'user') return;
      const host = document.querySelector('.chips'); if (!host || host.querySelector('.role-chip') || document.getElementById('role-chip')) return;
      const chip = document.createElement('span'); chip.id='role-chip'; chip.textContent = data.role === 'founder' ? 'OWNER' : 'STAFF';
      chip.title = data.role === 'founder' ? '站长' : '管理员';
      chip.style.cssText = data.role === 'founder'
        ? 'font-weight:800;letter-spacing:1.2px;border-color:#7c6fd1;background:#25223f;color:#d8d2ff'
        : 'font-weight:800;letter-spacing:1.2px;border-color:#5f6787;background:#202534;color:#cbd2ef';
      host.prepend(chip);
    } catch {}
  }
  async function connect() {
    if (started || typeof window.io !== 'function') return;
    started = true; ensureStyles(); ensurePanel(); currentActivity = desiredActivity(); await loadFollowing(); socket = window.io();
    socket.on('connect', () => {
      socket.emit('presence:hello', { visitorId: visitorId(), activity: currentActivity });
      worldJoined = false;
      joinWorld();
      markActive();
      setComposeStatus('');
    });
    socket.on('disconnect', () => {
      worldJoined = false;
      setComposeStatus('连接已断开，正在等待重连…', 'error');
    });
    socket.on('presence:list', render);
    socket.on('world:message', message => {
      if (!message?.id) return;
      const list = document.getElementById('worldMessageList');
      const nearBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 120;
      const previousTop = list?.scrollTop || 0;
      worldMessages.set(Number(message.id), message);
      renderWorldMessages();
      if (channelOpen && nearBottom) requestAnimationFrame(() => scrollWorldToBottom(true));
      else if (list) list.scrollTop = previousTop;
      if (!channelOpen && message.user?.id !== viewer.userId) {
        unread += 1;
        updateUnread();
      }
    });
    socket.on('world:deleted', data => {
      const id = Number(data?.id);
      if (!Number.isFinite(id)) return;
      worldMessages.delete(id);
      renderWorldMessages();
    });
    const observed = [document.getElementById('screen-room'), document.getElementById('roomView')].filter(Boolean);
    if (observed.length) { const observer = new MutationObserver(() => { if (!channelOpen) setActivity(inferActivity()); }); observed.forEach(el => observer.observe(el, { attributes: true, attributeFilter: ['class'] })); }
    ['pointerdown','keydown','touchstart','scroll'].forEach(name => window.addEventListener(name, markActive, { passive: true }));
  }
  function loadSocketIo() {
    loadVisitorStats(); loadAnnouncement(); decorateProfileRole();
    if (typeof window.io === 'function') return connect();
    const existing = document.querySelector('script[data-presence-socket]');
    if (existing) return existing.addEventListener('load', connect, { once: true });
    const script = document.createElement('script'); script.src = '/socket.io/socket.io.js'; script.dataset.presenceSocket = '1'; script.onload = connect; document.head.appendChild(script);
  }
  window.WuyuePresence = { setActivity };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadSocketIo, { once: true }); else loadSocketIo();
})();