(function () {
  'use strict';

  if (!document.querySelector('script[data-wuyue-presence-loader]')) {
    const presenceScript = document.createElement('script');
    presenceScript.src = 'https://wuyue1337.github.io/wuyue-static/presence.js';
    presenceScript.defer = true;
    presenceScript.dataset.wuyuePresenceLoader = '1';
    document.head.appendChild(presenceScript);
  }

  const roomList = document.getElementById('publicRoomList');
  const roomEmpty = document.getElementById('publicRoomEmpty');
  const roomCount = document.getElementById('publicRoomCount');
  const roomCodeInput = document.getElementById('roomCodeInput');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const nicknameInput = document.getElementById('nicknameInput');
  const nicknameLabel = document.querySelector('label[for="nicknameInput"]');
  const homeError = document.getElementById('homeError');
  const refreshBtn = document.getElementById('refreshLobbyBtn');
  const createCard = document.querySelector('.lobby-create-card');

  if (!roomList || !window.io) return;

  const socket = io();
  let rooms = [];

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function statusText(status) {
    if (status === 'lobby') return '等待中';
    if (status === 'playing') return '游戏中';
    if (status === 'ended') return '已结束';
    return status || '未知';
  }

  function showError(text) {
    if (!homeError) return;
    homeError.textContent = text;
    homeError.classList.remove('hidden');
  }

  async function loadAccountIdentity() {
    if (!nicknameInput || !createCard) return;
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (!data?.authenticated || !data.user) return;

      const user = data.user;
      nicknameInput.value = user.nickname || user.username || '召唤师';
      nicknameInput.type = 'hidden';
      nicknameLabel?.classList.add('hidden');

      const identity = document.createElement('div');
      identity.className = 'lobby-account-identity';
      identity.innerHTML = `
        <img class="lobby-account-avatar" src="${escapeHtml(user.avatar || 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg')}" alt="">
        <div class="lobby-account-copy">
          <span class="lobby-account-kicker">当前账号</span>
          <strong>${escapeHtml(user.nickname || user.username || '召唤师')}</strong>
          <small>@${escapeHtml(user.username || '')}${user.memberNo ? ` · ID #${Number(user.memberNo)}` : ''}</small>
        </div>
      `;
      createCard.insertBefore(identity, createCard.querySelector('.home-actions'));
    } catch (_) {
      // 未登录或账号接口暂不可用时，继续显示游客昵称输入框。
    }
  }

  function joinRoom(code) {
    if (!nicknameInput?.value.trim()) {
      nicknameInput?.focus();
      showError('先给自己起个召唤师名吧');
      return;
    }
    roomCodeInput.value = code;
    joinRoomBtn.click();
  }

  function render() {
    const waiting = rooms.filter((room) => room.status === 'lobby');
    const active = rooms.filter((room) => room.status !== 'lobby');
    const ordered = [...waiting, ...active];

    roomCount.textContent = `${waiting.length} 个可加入房间`;
    roomEmpty.classList.toggle('hidden', ordered.length > 0);
    roomList.innerHTML = '';

    for (const room of ordered) {
      const card = document.createElement('article');
      card.className = `public-room-card ${room.joinable ? '' : 'is-disabled'}`;
      card.innerHTML = `
        <div class="public-room-main">
          <div class="public-room-title-row">
            <strong>${escapeHtml(room.hostNickname || '召唤师')}的房间</strong>
            <span class="public-room-status ${room.status}">${statusText(room.status)}</span>
          </div>
          <div class="public-room-meta">
            <span>房间码 ${escapeHtml(room.roomCode)}</span>
            <span>${Number(room.connected || 0)}/${Number(room.maxPlayers || 10)} 人在线</span>
          </div>
        </div>
        <button class="btn ${room.joinable ? 'btn-secondary' : 'btn-room-disabled'}" ${room.joinable ? '' : 'disabled'}>
          ${room.joinable ? '加入房间' : statusText(room.status)}
        </button>
      `;
      const button = card.querySelector('button');
      if (room.joinable) button.addEventListener('click', () => joinRoom(room.roomCode));
      roomList.appendChild(card);
    }
  }

  loadAccountIdentity();

  socket.on('connect', () => socket.emit('request_lol_lobby'));
  socket.on('lol_lobby_rooms', (payload) => {
    rooms = Array.isArray(payload) ? payload : [];
    render();
  });

  refreshBtn?.addEventListener('click', () => {
    refreshBtn.disabled = true;
    socket.emit('request_lol_lobby');
    setTimeout(() => { refreshBtn.disabled = false; }, 500);
  });
})();
