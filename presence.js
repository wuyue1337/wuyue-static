(function () {
  'use strict';

  if (window.__WUYUE_PRESENCE_STARTED__) return;
  window.__WUYUE_PRESENCE_STARTED__ = true;

  const IDLE_MS = 5 * 60 * 1000;
  const PANEL_KEY = 'wuyue-presence-open';
  const ACTIVITY = {
    browse: '🏠 正在逛霧月乐园', lol_lobby: '⚔️ 正在找 LOL 猜英雄房间', lol_play: '🎮 正在玩 LOL 猜英雄',
    guess_lobby: '🔎 正在找猜词房间', guess_play: '🎯 正在玩 霧月猜词', dodge: '✨ 正在玩闪避',
    reaction: '⚡ 正在测试反应速度', click: '🖱️ 正在测试点击速度', osu_stream: '⌨️ 正在测试 osu! Stream 手速', away: '🌙 暂时离开'
  };
  let socket = null, currentActivity = 'browse', isAway = false, idleTimer = null, started = false, memoryVisitorId = null;
  let followed = new Set();

  function visitorId() {
    const key = 'wuyue-presence-visitor';
    try {
      let id = localStorage.getItem(key);
      if (!id) { id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem(key, id); }
      return id;
    } catch (_) { memoryVisitorId ||= `${Date.now()}-${Math.random().toString(36).slice(2)}`; return memoryVisitorId; }
  }
  function inferActivity() {
    const path = location.pathname.toLowerCase();
    if (path.startsWith('/lol')) { const room = document.getElementById('screen-room'); return room && !room.classList.contains('hidden') ? 'lol_play' : 'lol_lobby'; }
    if (path.startsWith('/guess')) { const room = document.getElementById('roomView'); return room && !room.classList.contains('hidden') ? 'guess_play' : 'guess_lobby'; }
    if (path.startsWith('/dodge')) return 'dodge';
    if (path.startsWith('/ability/osu-stream')) return 'osu_stream';
    if (path.startsWith('/ability/reaction')) return 'reaction';
    if (path.startsWith('/ability/click-speed')) return 'click';
    return 'browse';
  }
  function emitState() { if (socket?.connected) socket.emit('presence:activity', { activity: isAway ? 'away' : currentActivity }); }
  function setActivity(activity) { if (!ACTIVITY[activity] || activity === 'away') return; currentActivity = activity; if (!isAway) emitState(); }
  function markActive() {
    const wasAway = isAway; isAway = false; currentActivity = inferActivity(); clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { isAway = true; emitState(); }, IDLE_MS);
    if (wasAway) emitState();
  }
  function ensureStyles() {
    if (document.querySelector('link[data-wuyue-presence]')) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/presence.css?v=20260916-3'; link.dataset.wuyuePresence = '1'; document.head.appendChild(link);
  }
  function savedPanelOpen() {
    try { return localStorage.getItem(PANEL_KEY) === '1'; } catch (_) { return false; }
  }
  function setPanelOpen(wrap, toggle, open) {
    wrap.classList.toggle('presence-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    try { localStorage.setItem(PANEL_KEY, open ? '1' : '0'); } catch (_) {}
  }
  function ensurePanel() {
    if (document.getElementById('wuyue-presence')) return;
    const wrap = document.createElement('div'); wrap.id = 'wuyue-presence';
    wrap.innerHTML = `<button class="presence-toggle" id="presenceToggle" type="button" aria-expanded="false" aria-controls="presencePanel"><span class="presence-toggle-dot"></span><span>在线</span><b id="presenceCount">0</b></button><aside class="presence-panel" id="presencePanel" aria-label="在线用户"><div class="presence-head"><strong>在线用户</strong><div class="presence-head-actions"><span id="presenceHeadCount">0</span><button class="presence-close" id="presenceClose" type="button" aria-label="收起在线用户">×</button></div></div><div class="presence-list" id="presenceList"><div class="presence-empty">正在连接…</div></div></aside>`;
    document.body.appendChild(wrap);
    const toggle = document.getElementById('presenceToggle');
    const close = document.getElementById('presenceClose');
    const open = savedPanelOpen();
    setPanelOpen(wrap, toggle, open);
    toggle.addEventListener('click', () => setPanelOpen(wrap, toggle, !wrap.classList.contains('presence-open')));
    close.addEventListener('click', () => setPanelOpen(wrap, toggle, false));
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && wrap.classList.contains('presence-open')) setPanelOpen(wrap, toggle, false); });
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
    document.getElementById('presenceHeadCount').textContent = `${sorted.length} 人`;
    if (!sorted.length) { list.innerHTML = '<div class="presence-empty">现在还没有其他人在线</div>'; return; }
    list.innerHTML = sorted.map(user => {
      const badge = roleBadge(user.role);
      const star = followed.has(user.username) ? '<span class="presence-following" title="已关注">★</span>' : '';
      const number = user.account && user.memberNo ? `<span class="presence-member-no${Number(user.memberNo) <= 100 ? ' founder' : ''}" title="第 ${escapeHtml(user.memberNo)} 位注册用户">No.${escapeHtml(user.memberNo)}</span>` : '';
      const nameRow = `<div class="presence-name-row"><strong>${star}${escapeHtml(user.nickname || '游客')}</strong>${badge}${number}</div>`;
      const inner = `<div class="presence-avatar-wrap"><img class="presence-avatar" src="${escapeHtml(user.avatar || '/default-avatar.jpg')}" alt=""><span class="presence-dot"></span></div><div class="presence-copy">${nameRow}<span class="presence-activity">${escapeHtml(ACTIVITY[user.activity] || ACTIVITY.browse)}</span>${user.statusMessage ? `<small>“${escapeHtml(user.statusMessage)}”</small>` : ''}</div>`;
      return user.account && user.username ? `<a class="presence-user ${user.away ? 'is-away' : ''}" href="/profile/?user=${encodeURIComponent(user.username)}">${inner}</a>` : `<div class="presence-user ${user.away ? 'is-away' : ''}">${inner}</div>`;
    }).join('');
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
    started = true; ensureStyles(); ensurePanel(); currentActivity = inferActivity(); await loadFollowing(); socket = window.io();
    socket.on('connect', () => { socket.emit('presence:hello', { visitorId: visitorId(), activity: currentActivity }); markActive(); });
    socket.on('presence:list', render);
    const observed = [document.getElementById('screen-room'), document.getElementById('roomView')].filter(Boolean);
    if (observed.length) { const observer = new MutationObserver(() => setActivity(inferActivity())); observed.forEach(el => observer.observe(el, { attributes: true, attributeFilter: ['class'] })); }
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