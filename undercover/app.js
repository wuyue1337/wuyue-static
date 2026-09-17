'use strict';

(() => {
  const $ = selector => document.querySelector(selector);
  const socket = io('/undercover');
  const STORAGE_KEY = 'wuyue_undercover_session';
  const NICK_KEY = 'wuyue_undercover_nick';
  const state = { account:null, rooms:[], leaderboard:[], room:null, private:null, playerId:null };
  let joinPending = false;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
  }
  function toast(text) {
    const box = $('#toast'); box.textContent = text; box.classList.remove('hidden');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => box.classList.add('hidden'), 2400);
  }
  function emitAck(event, payload={}) {
    return new Promise(resolve => socket.emit(event, payload, response => resolve(response || {ok:false,error:'服务器没有响应'})));
  }
  function memberNoHtml(number) {
    number = Number(number);
    if (!Number.isSafeInteger(number) || number < 1) return '';
    return `<span class="member-no${number <= 100 ? ' founder' : ''}">No.${number}</span>`;
  }
  function avatar(src, name) {
    return `<img src="${escapeHtml(src || '/default-avatar.jpg')}" alt="${escapeHtml(name || '')}" onerror="this.src='/default-avatar.jpg'">`;
  }
  function session() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
  }
  function saveSession(value) {
    if (!value) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }
  function phaseText(phase) {
    return ({lobby:'等待玩家',description:'描述阶段',voting:'投票阶段',ended:'本局结束'})[phase] || phase;
  }
  function modeText(mode) { return mode === 'fog' ? '迷雾模式' : '经典模式'; }
  function roleText(role) { return ({civilian:'平民',undercover:'卧底',blank:'白板'})[role] || '身份未知'; }
  function winnerText(winner) { return ({civilian:'平民阵营胜利',undercover:'卧底阵营胜利',blank:'白板单独胜利'})[winner] || '本局结束'; }

  async function loadAccount() {
    try {
      const response = await fetch('/api/auth/me', { cache:'no-store' });
      const data = await response.json();
      state.account = response.ok && data.authenticated ? data.user : null;
    } catch { state.account = null; }
    const host = $('#accountIdentity');
    if (state.account) {
      host.innerHTML = `${avatar(state.account.avatar,state.account.nickname)}<div><strong>${escapeHtml(state.account.nickname)} ${memberNoHtml(state.account.memberNo)}</strong><small>@${escapeHtml(state.account.username)} · 登录账号会记录长期积分</small></div>`;
      $('#guestNickWrap').classList.add('hidden');
      $('#roomName').placeholder = `${state.account.nickname}的房间`;
    } else {
      host.innerHTML = '<div><strong>游客模式</strong><small>可以完整游玩，但不会进入长期积分榜。</small></div>';
      $('#guestNickWrap').classList.remove('hidden');
      $('#nickname').value = localStorage.getItem(NICK_KEY) || '';
    }
  }

  function renderRooms() {
    const box = $('#roomList');
    if (!state.rooms.length) { box.innerHTML = '<div class="empty">现在没有公开房间，创建一个吧。</div>'; return; }
    box.innerHTML = state.rooms.map(room => `<div class="room-item"><div><strong>${escapeHtml(room.name)}</strong><small>${room.code} · ${modeText(room.mode)}${room.whiteboard?' · 白板开启':''} · ${room.players}/${room.maxPlayers} 人</small></div><button class="ghost room-join" data-code="${escapeHtml(room.code)}">加入</button></div>`).join('');
    box.querySelectorAll('.room-join').forEach(button => button.addEventListener('click', () => joinRoom(button.dataset.code)));
  }

  function renderLeaderboard() {
    const box = $('#leaderboard');
    if (!state.leaderboard.length) { box.innerHTML = '<div class="empty">还没有积分记录，来拿下第一局。</div>'; return; }
    box.innerHTML = state.leaderboard.slice(0,10).map(row => `<a class="leader-row" ${row.username?`href="/profile/?user=${encodeURIComponent(row.username)}"`:''}><span class="leader-rank">${row.rank}</span>${avatar(row.avatar,row.nickname)}<span class="leader-copy"><strong>${escapeHtml(row.nickname)} ${memberNoHtml(row.memberNo)}</strong><small>${row.wins} 胜 / ${row.games} 局</small></span><span class="leader-score">${row.score} pt</span></a>`).join('');
  }

  function enterRoom(response) {
    state.playerId = response.playerId || state.playerId;
    state.room = response.state || state.room;
    state.private = response.private ?? state.private;
    $('#lobbyView').classList.add('hidden');
    $('#roomView').classList.remove('hidden');
    if (response.code && response.playerId && response.token) saveSession({code:response.code,playerId:response.playerId,token:response.token});
    renderRoom();
  }
  function backToLobby() {
    state.room = null; state.private = null; state.playerId = null; saveSession(null);
    $('#roomView').classList.add('hidden'); $('#lobbyView').classList.remove('hidden');
  }

  function renderRoom() {
    const room = state.room; if (!room) return;
    const me = room.players.find(player => player.id === state.playerId);
    const alive = room.players.filter(player => player.alive);
    $('#roomTitle').textContent = room.name;
    $('#roomMeta').textContent = `房间号 ${room.code} · ${modeText(room.mode)}${room.whiteboard?' · 白板开启':''}`;
    $('#phaseBadge').textContent = phaseText(room.phase);
    $('#roundText').textContent = room.round ? `第 ${room.round} 轮` : '等待开始';
    $('#playerCount').textContent = `${room.players.filter(player=>!player.left).length} 人`;

    const playerList = $('#playerList');
    playerList.innerHTML = room.players.filter(player=>!player.left).map(player => {
      const status = !player.connected ? '重连中' : !player.alive ? '已出局' : player.submitted && room.phase==='description' ? '已描述' : player.voted && room.phase==='voting' ? '已投票' : '在线';
      return `<div class="player${player.alive?'':' is-dead'}">${avatar(player.avatar,player.nickname)}<div class="player-copy"><strong>${escapeHtml(player.nickname)} ${memberNoHtml(player.memberNo)} ${player.host?'<span class="tag host">房主</span>':''} ${!player.alive?'<span class="tag dead">出局</span>':''}</strong><small>${player.connected?'在线':'暂时掉线'}</small></div><span class="player-state">${status}</span></div>`;
    }).join('');

    const start = $('#startBtn');
    start.classList.toggle('hidden', !me?.host || (room.phase !== 'lobby' && room.phase !== 'ended'));
    start.textContent = room.phase === 'ended' ? '再来一局' : '开始游戏';
    $('#againBtn').classList.toggle('hidden', !me?.host || room.phase !== 'ended');

    const privateCard = $('#privateCard');
    if (room.phase !== 'lobby' && state.private) {
      privateCard.classList.remove('hidden');
      $('#myWord').textContent = state.private.word || '（空白）';
      $('#myRole').textContent = state.private.roleHidden ? '迷雾模式：你的身份未知' : `身份：${roleText(state.private.role)}`;
    } else privateCard.classList.add('hidden');

    const taboo = $('#tabooBox');
    if (room.phase === 'description' && room.taboo) { taboo.classList.remove('hidden'); $('#tabooWord').textContent = room.taboo; }
    else taboo.classList.add('hidden');

    const descriptionSection = $('#descriptionSection');
    descriptionSection.classList.toggle('hidden', room.phase !== 'description' || !me?.alive);
    $('#descriptionInput').disabled = !!me?.submitted;
    $('#descriptionBtn').disabled = !!me?.submitted;
    $('#descriptionBtn').textContent = me?.submitted ? '已提交' : '提交描述';

    const votingSection = $('#votingSection');
    votingSection.classList.toggle('hidden', room.phase !== 'voting' || !me?.alive);
    const voteList = $('#voteList');
    if (room.phase === 'voting' && me?.alive) {
      voteList.innerHTML = alive.filter(player=>player.id!==me.id).map(player => `<button class="vote-btn" data-id="${player.id}" ${me.voted?'disabled':''}>${avatar(player.avatar,player.nickname)}<span>${escapeHtml(player.nickname)} ${memberNoHtml(player.memberNo)}</span></button>`).join('');
      voteList.querySelectorAll('.vote-btn').forEach(button => button.addEventListener('click', () => voteFor(button.dataset.id)));
      $('#voteStatus').textContent = me.voted ? '已投票，等待其他玩家。' : '';
    } else { voteList.innerHTML=''; $('#voteStatus').textContent=''; }

    const descriptions = room.descriptions || [];
    $('#descriptionCount').textContent = room.phase === 'description' ? `${alive.filter(p=>p.submitted).length}/${alive.length} 已提交` : descriptions.length ? `${descriptions.length} 条` : '';
    $('#descriptionList').innerHTML = descriptions.length ? descriptions.map((item,index)=>`<div class="description-item"><span class="description-index">${String(index+1).padStart(2,'0')}</span><div><strong>${escapeHtml(item.nickname)}</strong><p>${escapeHtml(item.text)}</p></div></div>`).join('') : '<div class="empty">还没有人提交描述。</div>';

    if (room.voteResult) {
      if (room.voteResult.tied) toast('本轮平票，无人出局，准备进入下一轮。');
      else if (room.voteResult.eliminatedName) toast(`${room.voteResult.eliminatedName} 被投出局。`);
    }

    const resultSection = $('#resultSection');
    if (room.phase === 'ended' && room.result) {
      resultSection.classList.remove('hidden');
      $('#resultTitle').textContent = winnerText(room.result.winner);
      $('#resultReason').textContent = `${room.result.reason} · 平民词「${room.result.pair.civilian}」 / 卧底词「${room.result.pair.undercover}」`;
      $('#revealList').innerHTML = room.players.filter(player=>!player.left).map(player => `<div class="reveal">${avatar(player.avatar,player.nickname)}<div><strong>${escapeHtml(player.nickname)} ${memberNoHtml(player.memberNo)}</strong><small>${roleText(player.role)} · ${player.word || '无词（白板）'}</small></div></div>`).join('');
    } else resultSection.classList.add('hidden');
  }

  async function createRoom() {
    const nickname = state.account ? '' : $('#nickname').value.trim();
    if (!state.account) localStorage.setItem(NICK_KEY, nickname);
    $('#createBtn').disabled = true;
    const response = await emitAck('create_room', { name:$('#roomName').value.trim(), mode:$('#mode').value, whiteboard:$('#whiteboard').checked, nickname });
    $('#createBtn').disabled = false;
    if (!response.ok) return toast(response.error || '创建失败');
    enterRoom(response);
  }
  async function joinRoom(code) {
    if (joinPending) return;
    code = String(code || $('#joinCode').value || '').trim().toUpperCase();
    if (!code) return toast('请输入房间号');
    const nickname = state.account ? '' : ($('#nickname').value.trim() || localStorage.getItem(NICK_KEY) || '游客');
    joinPending = true;
    $('#joinBtn').disabled = true;
    try {
      const response = await emitAck('join_room', { code, nickname });
      if (!response.ok) return toast(response.error || '加入失败');
      enterRoom(response);
    } finally {
      joinPending = false;
      $('#joinBtn').disabled = false;
    }
  }
  async function startGame() {
    $('#startBtn').disabled = true; $('#againBtn').disabled = true;
    const response = await emitAck('start_game');
    $('#startBtn').disabled = false; $('#againBtn').disabled = false;
    if (!response.ok) { $('#startStatus').textContent = response.error || '无法开始'; return; }
    $('#startStatus').textContent = '';
  }
  async function submitDescription() {
    const text = $('#descriptionInput').value.trim(); if (!text) return;
    $('#descriptionBtn').disabled = true;
    const response = await emitAck('submit_description', { text });
    if (!response.ok) { $('#descriptionStatus').textContent = response.error || '提交失败'; $('#descriptionBtn').disabled = false; return; }
    $('#descriptionInput').value=''; $('#descriptionStatus').textContent='已提交，等待其他玩家。';
  }
  async function voteFor(targetId) {
    const response = await emitAck('vote', { targetId });
    if (!response.ok) $('#voteStatus').textContent = response.error || '投票失败';
    else $('#voteStatus').textContent = '已投票，等待其他玩家。';
  }

  $('#createBtn').addEventListener('click', createRoom);
  $('#joinBtn').addEventListener('click', () => joinRoom());
  $('#joinCode').addEventListener('keydown', event => { if (event.key === 'Enter') joinRoom(); });
  $('#refreshRooms').addEventListener('click', () => socket.emit('request_rooms'));
  $('#startBtn').addEventListener('click', startGame);
  $('#againBtn').addEventListener('click', startGame);
  $('#descriptionBtn').addEventListener('click', submitDescription);
  $('#descriptionInput').addEventListener('keydown', event => { if (event.key === 'Enter') submitDescription(); });
  $('#copyInvite').addEventListener('click', async () => {
    if (!state.room) return;
    const url = `${location.origin}/undercover/?room=${encodeURIComponent(state.room.code)}`;
    try { await navigator.clipboard.writeText(url); toast('邀请链接已复制'); }
    catch { prompt('复制这个邀请链接：', url); }
  });
  $('#leaveBtn').addEventListener('click', () => { socket.emit('leave_room'); backToLobby(); });

  socket.on('connect', async () => {
    $('.connection').classList.add('online'); $('#connText').textContent='已连接';
    const saved = session();
    if (saved && !state.room) {
      const response = await emitAck('resume_room', saved);
      if (response.ok) { state.playerId=saved.playerId; state.room=response.state; state.private=response.private; enterRoom(response); }
      else saveSession(null);
    }
  });
  socket.on('disconnect', () => { $('.connection').classList.remove('online'); $('#connText').textContent='正在重连…'; });
  socket.on('rooms', rooms => { state.rooms = Array.isArray(rooms) ? rooms : []; renderRooms(); });
  socket.on('leaderboard', rows => { state.leaderboard = Array.isArray(rows) ? rows : []; renderLeaderboard(); });
  socket.on('room_state', room => { if (!state.room || room.code === state.room.code) { state.room=room; renderRoom(); } });
  socket.on('private_state', value => { state.private=value; renderRoom(); });
  socket.on('session_replaced', () => { toast('这个房间身份已在另一个页面接管'); backToLobby(); });

  loadAccount().then(() => {
    const room = new URLSearchParams(location.search).get('room');
    if (room) $('#joinCode').value = room.toUpperCase().slice(0,5);
  });
})();
