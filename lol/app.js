(function () {
  'use strict';

  const MIN_PLAYERS = 2;
  const SESSION_KEY = "lol-guess-session-v2";

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const screenHome = $('screen-home');
  const screenRoom = $('screen-room');

  const nicknameInput = $('nicknameInput');
  const createRoomBtn = $('createRoomBtn');
  const roomCodeInput = $('roomCodeInput');
  const joinRoomBtn = $('joinRoomBtn');
  const homeError = $('homeError');
  const roomModeInput = $('roomModeInput');
  const roomModeOptions = [...document.querySelectorAll('[data-room-mode]')];

  const leaveBtn = $('leaveBtn');
  const roomCodeBadge = $('roomCodeBadge');
  const roomModeBadge = $('roomModeBadge');
  const roomStatusPill = $('roomStatusPill');

  const lobbyPanel = $('lobbyPanel');
  const lobbyPlayerList = $('lobbyPlayerList');
  const startGameBtn = $('startGameBtn');
  const startHint = $('startHint');

  const gamePanel = $('gamePanel');
  const myChampPortrait = $('myChampPortrait');
  const myChampName = $('myChampName');
  const othersList = $('othersList');
  const guessInput = $('guessInput');
  const guessSuggestions = $('guessSuggestions');
  const guessBtn = $('guessBtn');
  const guessFeedback = $('guessFeedback');
  const guessBox = $('guessBox');

  const turnActionDock = $('turnActionDock');
  const turnActionDockTitle = $('turnActionDockTitle');
  const turnActionDockText = $('turnActionDockText');
  const openTurnBtn = $('openTurnBtn');
  const turnModal = $('turnModal');
  const turnModalClose = $('turnModalClose');
  const turnModalMode = $('turnModalMode');
  const turnWaitingPane = $('turnWaitingPane');
  const turnWaitingText = $('turnWaitingText');
  const turnChoicePane = $('turnChoicePane');
  const questionComposePane = $('questionComposePane');
  const questionActivePane = $('questionActivePane');
  const voiceTurnPane = $('voiceTurnPane');
  const turnGuessPane = $('turnGuessPane');
  const chooseQuestionBtn = $('chooseQuestionBtn');
  const chooseGuessBtn = $('chooseGuessBtn');
  const backToTurnChoiceBtn = $('backToTurnChoiceBtn');
  const turnQuestionInput = $('turnQuestionInput');
  const submitQuestionBtn = $('submitQuestionBtn');
  const questionComposeFeedback = $('questionComposeFeedback');
  const activeQuestionText = $('activeQuestionText');
  const activeQuestionAuthor = $('activeQuestionAuthor');
  const questionAnswers = $('questionAnswers');
  const answerComposer = $('answerComposer');
  const turnAnswerInput = $('turnAnswerInput');
  const submitTurnAnswerBtn = $('submitTurnAnswerBtn');
  const answerFeedback = $('answerFeedback');
  const questionOwnerActions = $('questionOwnerActions');
  const endQuestionTurnBtn = $('endQuestionTurnBtn');
  const voiceGuessBtn = $('voiceGuessBtn');
  const passBtn = $('passBtn');

  const endPanel = $('endPanel');
  const resultsList = $('resultsList');
  const newRoundBtn = $('newRoundBtn');
  const waitHostHint = $('waitHostHint');

  const tabContentGame = $('tab-content-game');
  const tabContentChat = $('tab-content-chat');
  const tabGameBtn = $('tabGameBtn');
  const tabChatBtn = $('tabChatBtn');
  const chatBadge = $('chatBadge');
  const chatMessages = $('chatMessages');
  const chatForm = $('chatForm');
  const chatInput = $('chatInput');

  const toastEl = $('toast');

  // ---------- 全局状态 ----------
  const state = {
    socket: null,
    myId: null,
    roomCode: null,
    isHost: false,
    status: 'lobby',
    mode: 'voice',
    turnAction: null,
    turnUiKey: '',
    ddVersion: null,
    champions: [],       // [{id, name, title}]
    champById: new Map(),
    latestPlayers: [],    // 最近一次 room_state 里的玩家列表
    others: [],           // 本局中"别人"的英雄分配 [{playerId, nickname, championId}]
    myChampionId: null,   // 猜对之后才会有值
    activeTab: 'game',
    unreadChat: 0
  };

  function championImg(id) {
    return `https://ddragon.leagueoflegends.com/cdn/${state.ddVersion}/img/champion/${id}.png`;
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.add('hidden'), 2600);
  }

  // ---------- 加载英雄数据(Data Dragon) ----------
  async function loadChampionData() {
    const verRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    if (!verRes.ok) throw new Error('版本信息获取失败');
    const versions = await verRes.json();
    const version = state.ddVersion || versions[0];

    const dataRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/zh_CN/champion.json`);
    if (!dataRes.ok) throw new Error('英雄数据获取失败');
    const json = await dataRes.json();

    const champions = Object.values(json.data)
      .map((c) => ({ id: c.id, name: c.name, title: c.title }))
      .sort((a, b) => a.id.localeCompare(b.id));

    state.ddVersion = version;
    state.champions = champions;
    state.champById = new Map(champions.map((c) => [c.id, c]));
  }

  // ---------- 屏幕切换 ----------
  function showScreen(name) {
    screenHome.classList.toggle('hidden', name !== 'home');
    screenRoom.classList.toggle('hidden', name !== 'room');
  }

  function showRoomPanel(name) {
    lobbyPanel.classList.toggle('hidden', name !== 'lobby');
    gamePanel.classList.toggle('hidden', name !== 'game');
    endPanel.classList.toggle('hidden', name !== 'end');
  }

  function setTab(tab) {
    state.activeTab = tab;
    tabContentGame.classList.toggle('hidden', tab !== 'game');
    tabContentChat.classList.toggle('hidden', tab !== 'chat');
    tabGameBtn.classList.toggle('active', tab === 'game');
    tabChatBtn.classList.toggle('active', tab === 'chat');
    if (tab === 'chat') {
      state.unreadChat = 0;
      chatBadge.classList.add('hidden');
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }
  tabGameBtn.addEventListener('click', () => setTab('game'));
  tabChatBtn.addEventListener('click', () => setTab('chat'));

  roomModeOptions.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.roomMode === 'text' ? 'text' : 'voice';
      roomModeInput.value = mode;
      roomModeOptions.forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    });
  });

  // ---------- 房间初始化 ----------
  function connectSocket() {
    if (state.socket) return state.socket;
    state.socket = io();
    state.myId = null;
    bindSocketEvents(state.socket);
    return state.socket;
  }

  function enterRoom(roomCode, ack) {
    state.roomCode = roomCode;
    state.myId = ack.playerId;
    localStorage.setItem(SESSION_KEY, JSON.stringify({roomCode, playerId: ack.playerId, token: ack.token}));
    roomCodeBadge.textContent = `房间码 ${roomCode}`;
    applyRoomState(ack.state);
    showScreen('room');
    setTab('game');
  }

  createRoomBtn.addEventListener('click', async () => {
    homeError.classList.add('hidden');
    const nickname = nicknameInput.value.trim();
    if (!nickname) return showHomeError('先给自己起个召唤师名吧');
    createRoomBtn.disabled = true;
    try {
      if (!state.ddVersion) await loadChampionData();
      const socket = connectSocket();
      socket.emit('create_room', { nickname, mode: roomModeInput?.value === 'text' ? 'text' : 'voice' }, (ack) => {
        createRoomBtn.disabled = false;
        if (!ack || !ack.ok) return showHomeError((ack && ack.error) || '创建房间失败');
        enterRoom(ack.roomCode, ack);
      });
    } catch (e) {
      createRoomBtn.disabled = false;
      showHomeError('英雄数据加载失败,请检查网络后重试');
    }
  });

  joinRoomBtn.addEventListener('click', async () => {
    homeError.classList.add('hidden');
    const nickname = nicknameInput.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!nickname) return showHomeError('先给自己起个召唤师名吧');
    if (!code) return showHomeError('请输入房间码');
    joinRoomBtn.disabled = true;
    try {
      if (!state.ddVersion) await loadChampionData();
      const socket = connectSocket();
      socket.emit('join_room', { nickname, roomCode: code }, (ack) => {
        joinRoomBtn.disabled = false;
        if (!ack || !ack.ok) return showHomeError((ack && ack.error) || '加入房间失败');
        enterRoom(ack.roomCode, ack);
      });
    } catch (e) {
      joinRoomBtn.disabled = false;
      showHomeError('英雄数据加载失败,请检查网络后重试');
    }
  });

  function showHomeError(msg) {
    homeError.textContent = msg;
    homeError.classList.remove('hidden');
  }

  leaveBtn.addEventListener('click', () => {
    if (state.socket) state.socket.emit('leave_room');
    resetToHome();
  });

  function resetToHome() {
    localStorage.removeItem(SESSION_KEY);
    $('connectionBanner').classList.add('hidden');
    state.roomCode = null;
    state.status = 'lobby';
    state.mode = 'voice';
    state.turnAction = null;
    state.turnUiKey = '';
    state.others = [];
    state.myChampionId = null;
    chatMessages.innerHTML = '';
    turnModal?.classList.add('hidden');
    turnActionDock?.classList.add('hidden');
    showScreen('home');
  }

  function restoreGame(payload) {
    state.ddVersion = payload.version || state.ddVersion;
    state.others = payload.others || [];
    state.myChampionId = payload.myChampionId || null;
    state.results = null;
    guessFeedback.textContent = ''; guessInput.value = '';
    myChampPortrait.className = 'my-champ-portrait ' + (state.myChampionId ? 'revealed' : 'fog');
    myChampPortrait.style.backgroundImage = state.myChampionId ? `url(${championImg(state.myChampionId)})` : '';
    myChampPortrait.style.backgroundSize = 'cover';
    myChampPortrait.textContent = state.myChampionId ? '' : '?';
    myChampName.textContent = state.myChampionId ? (state.champById.get(state.myChampionId)?.name || state.myChampionId) : '还没猜出来';
    myChampName.classList.toggle('revealed', !!state.myChampionId);
    renderOthers(); updateTurn();
  }

  // ---------- Socket 事件 ----------
  function bindSocketEvents(socket) {
    socket.on('room_state', (payload) => {
      applyRoomState(payload);
    });

    socket.on('connect', () => {
      $('connectionBanner').classList.add('hidden');
      let saved;
      try { saved = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (_) {}
      if (!saved) return;
      socket.emit('resume_room', saved, (ack) => {
        if (!ack?.ok) { resetToHome(); showHomeError(ack?.error || '无法恢复房间'); return; }
        enterRoom(ack.roomCode, ack);
        if (ack.game) restoreGame(ack.game);
        chatMessages.innerHTML = ''; (ack.messages || []).forEach(appendChatMessage);
        if (ack.results) renderResults(ack.results);
        showToast('已回到原来的座位');
      });
    });
    socket.on('session_replaced', () => { resetToHome(); showHomeError('你已在另一个页面恢复房间'); });
    socket.on('game_started', (payload) => {
      chatMessages.innerHTML = '';
      restoreGame(payload); showRoomPanel('game'); setTab('game');
    });

    socket.on('chat_message', (msg) => {
      appendChatMessage(msg);
    });

    socket.on('reveal', (data) => {
      const champ = state.champById.get(data.championId);
      const champName = champ ? champ.name : data.championId;
      appendChatMessage({
        reveal: true,
        text: `🎉 ${data.nickname} 猜对了!TA的英雄是【${champName}】(第 ${data.rank} 位猜出)`
      });
      renderOthers();
    });

    socket.on('game_ended', (data) => {
      renderResults(data.results);
      showRoomPanel('end');
    });

    socket.on('disconnect', () => {
      if (!state.roomCode) return;
      state.localDeadline = Date.now() + 45000;
      $('connectionBanner').classList.remove('hidden');
      updateTurn(); updateCountdowns();
    });
  }

  function applyRoomState(payload) {
    const previousKey = state.turnUiKey;
    state.currentPlayerId = payload.currentPlayerId;
    state.round = payload.round;
    state.clockOffset = payload.serverNow - Date.now();
    state.status = payload.status;
    state.mode = payload.mode === 'text' ? 'text' : 'voice';
    state.turnAction = payload.turnAction || null;
    state.latestPlayers = payload.players;
    if (payload.version) state.ddVersion = payload.version;
    const me = payload.players.find((p) => p.id === state.myId);
    state.isHost = !!(me && me.isHost);
    if (roomModeBadge) roomModeBadge.textContent = state.mode === 'text' ? '💬 文字模式' : '🎙 语音模式';

    const answerStamp = state.turnAction?.type === 'question'
      ? (state.turnAction.answers || []).map(item => `${item.playerId}:${item.updatedAt || ''}`).join(',')
      : '';
    state.turnUiKey = [state.status, state.currentPlayerId || '', state.turnAction?.type || '', state.turnAction?.question || '', answerStamp].join('|');
    const turnChanged = previousKey !== state.turnUiKey;

    renderRoster();
    updateTurn();
    renderTurnUI(turnChanged);

    roomStatusPill.textContent =
      payload.status === 'lobby' ? '等待中' : payload.status === 'playing' ? '进行中' : '已结束';

    if (payload.status === 'lobby') {
      renderLobby();
      showRoomPanel('lobby');
    } else if (payload.status === 'playing') {
      renderOthers();
      showRoomPanel('game');
    } else if (payload.status === 'ended') {
      renderOthers();
      showRoomPanel('end');
    }
  }

  // ---------- 渲染:大厅 ----------
  function renderLobby() {
    lobbyPlayerList.innerHTML = '';
    state.latestPlayers.forEach((p) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="player-avatar">${escapeHtml(p.nickname.slice(0, 1))}</span>
        <span>${p.seat}号 · ${escapeHtml(p.nickname)} ${memberBadge(p)}</span>${offlineTag(p)}
        ${p.isHost ? '<span class="host-tag">房主</span>' : ''}
      `;
      lobbyPlayerList.appendChild(li);
    });

    const count = state.latestPlayers.length;
    if (state.isHost) {
      startGameBtn.classList.remove('hidden');
      startGameBtn.disabled = count < MIN_PLAYERS || state.latestPlayers.some(p => !p.connected);
      startHint.textContent = count < MIN_PLAYERS ? `还差 ${MIN_PLAYERS - count} 人,至少 ${MIN_PLAYERS} 人才能开始` : (state.latestPlayers.some(p => !p.connected) ? '等待离线玩家重连…' : '人齐了,可以开始游戏了');
    } else {
      startGameBtn.classList.add('hidden');
      startHint.textContent = count < MIN_PLAYERS ? `等待更多召唤师加入(至少 ${MIN_PLAYERS} 人)…` : '等待房主开始游戏…';
    }
  }

  startGameBtn.addEventListener('click', () => {
    startGameBtn.disabled = true;
    const championIds = state.champions.map((c) => c.id);
    state.socket.emit('start_game', { championIds, version: state.ddVersion }, (ack) => {
      startGameBtn.disabled = false;
      if (!ack || !ack.ok) showToast((ack && ack.error) || '开始游戏失败');
    });
  });

  newRoundBtn.addEventListener('click', () => {
    newRoundBtn.disabled = true;
    const championIds = state.champions.map((c) => c.id);
    state.socket.emit('new_round', { championIds, version: state.ddVersion }, (ack) => {
      newRoundBtn.disabled = false;
      if (!ack || !ack.ok) showToast((ack && ack.error) || '开始新一轮失败');
    });
  });

  // ---------- 渲染:游戏中/结算里"别人的英雄" ----------
  function renderOthers() {
    othersList.innerHTML = '';
    state.others.forEach((o) => {
      const champ = state.champById.get(o.championId);
      const champName = champ ? champ.name : o.championId;
      const playerState = state.latestPlayers.find((p) => p.id === o.playerId);
      if (!playerState) return;
      const correct = playerState.guessedCorrectly;

      const li = document.createElement('li');
      li.innerHTML = `
        <img class="champ-portrait" src="${championImg(o.championId)}" alt="${escapeHtml(champName)}" loading="lazy">
        <div class="other-names">
          <span class="other-champ-name">${escapeHtml(champName)}</span>
          <span class="other-player-name">${playerState.seat}号 · ${escapeHtml(o.nickname)} ${memberBadge(o)} ${offlineTag(playerState)}</span>${lastGuessText(playerState)}
        </div>
        ${correct ? `<span class="correct-badge">第${playerState.rank}位猜出</span>` : ''}
      `;
      li.classList.toggle('active-player', state.currentPlayerId === o.playerId);
      othersList.appendChild(li);
    });

    // 是否所有其他人都已经开始展示 host 控件(新一轮)
    if (state.status === 'ended') {
      newRoundBtn.classList.toggle('hidden', !state.isHost);
      waitHostHint.classList.toggle('hidden', state.isHost);
    }
  }

  function renderResults(results) {
    state.results = results;
    resultsList.innerHTML = '';
    results.forEach((r, idx) => {
      const champ = state.champById.get(r.championId);
      const champName = champ ? champ.name : r.championId;
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="rank-num">${r.rank || '—'}</span>
        <img class="champ-portrait" src="${championImg(r.championId)}" alt="${escapeHtml(champName)}" loading="lazy">
        <div class="other-names">
          <span class="other-champ-name">${escapeHtml(r.nickname)} ${memberBadge(r)}</span>
          <span class="other-player-name">${r.departed ? '已退出 · 英雄：' : '猜出：'}${escapeHtml(champName)} · ${r.attempts} 次</span>
        </div>
      `;
      resultsList.appendChild(li);
    });
    newRoundBtn.classList.toggle('hidden', !state.isHost);
    waitHostHint.classList.toggle('hidden', state.isHost);
  }

  // ---------- 猜测(自动补全) ----------
  let activeSuggestionIndex = -1;

  guessInput.addEventListener('input', () => {
    const q = guessInput.value.trim();
    activeSuggestionIndex = -1;
    if (!q) return renderSuggestions([]);
    const matches = state.champions
      .filter((c) => c.name.includes(q) || c.id.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);
    renderSuggestions(matches);
  });

  guessInput.addEventListener('keydown', (e) => {
    const items = guessSuggestions.querySelectorAll('li');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, items.length - 1);
      highlightSuggestion(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
      highlightSuggestion(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && items[activeSuggestionIndex]) {
        items[activeSuggestionIndex].click();
      } else {
        submitGuess();
      }
    } else if (e.key === 'Escape') {
      renderSuggestions([]);
    }
  });

  function highlightSuggestion(items) {
    items.forEach((li, i) => li.classList.toggle('active', i === activeSuggestionIndex));
  }

  function renderSuggestions(list) {
    guessSuggestions.innerHTML = '';
    if (!list.length) {
      guessSuggestions.classList.add('hidden');
      return;
    }
    list.forEach((c) => {
      const li = document.createElement('li');
      li.innerHTML = `<img src="${championImg(c.id)}" alt=""><span>${escapeHtml(c.name)}</span>`;
      li.addEventListener('click', () => {
        guessInput.value = c.name;
        guessInput.dataset.selectedId = c.id;
        renderSuggestions([]);
      });
      guessSuggestions.appendChild(li);
    });
    guessSuggestions.classList.remove('hidden');
  }

  document.addEventListener('click', (e) => {
    if (!guessBox.contains(e.target)) renderSuggestions([]);
  });

  guessBtn.addEventListener('click', submitGuess);

  function resolveTypedChampion() {
    const typed = guessInput.value.trim();
    if (!typed) return null;
    if (guessInput.dataset.selectedId) {
      const c = state.champById.get(guessInput.dataset.selectedId);
      if (c && c.name === typed) return c;
    }
    return state.champions.find((c) => c.name === typed) || null;
  }

  function submitGuess() {
    if (guessBtn.disabled || !state.socket?.connected || state.currentPlayerId !== state.myId) return;
    const champ = resolveTypedChampion();
    if (!champ) {
      guessFeedback.textContent = '请从列表中选择一个准确的英雄名字';
      return;
    }
    guessBtn.disabled = true;
    state.socket.emit('guess', { championId: champ.id }, (ack) => {
      updateTurn();
      if (!ack || !ack.ok) {
        guessFeedback.textContent = (ack && ack.error) || '猜测失败,请重试';
        return;
      }
      closeTurnModal();
      delete guessInput.dataset.selectedId;
      if (ack.correct) {
        state.myChampionId = ack.championId;
        const c = state.champById.get(ack.championId);
        myChampPortrait.className = 'my-champ-portrait revealed';
        myChampPortrait.style.backgroundImage = `url(${championImg(ack.championId)})`;
        myChampPortrait.style.backgroundSize = 'cover';
        myChampPortrait.textContent = '';
        myChampName.textContent = `${c ? c.name : ack.championId}(第 ${ack.rank} 位猜出,共猜了 ${ack.attempts} 次)`;
        myChampName.classList.add('revealed');
        guessFeedback.textContent = '';
        guessInput.value = '';
        guessInput.disabled = true;
        guessBtn.disabled = true;
        showToast('恭喜猜对啦!🎉');
      } else {
        guessFeedback.textContent = `这次没有猜对，等下个回合再试（已尝试 ${ack.attempts} 次）`;
      }
    });
  }

  // ---------- 聊天 ----------
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.socket?.connected) return showToast('正在重连，请稍后发送');
    const text = chatInput.value.trim();
    if (!text) return;
    state.socket.emit('send_message', { text });
    chatInput.value = '';
  });

  function appendChatMessage(msg) {
    if (msg.guess) msg = {...msg, text: `第 ${msg.round} 轮 · ${msg.nickname} 猜了【${state.champById.get(msg.championId)?.name || msg.championId}】 · ${msg.correct ? '猜对了！' : '未猜中'}`};
    const div = document.createElement('div');
    if (msg.system) {
      div.className = 'chat-msg system';
      div.textContent = msg.text;
    } else if (msg.reveal) {
      div.className = 'chat-msg reveal';
      div.textContent = msg.text;
    } else {
      const isSelf = msg.playerId === state.myId;
      div.className = 'chat-msg' + (isSelf ? ' self' : '');
      div.innerHTML = `<span class="chat-name">${escapeHtml(msg.nickname)} ${memberBadge(msg)}</span>${escapeHtml(msg.text)}`;
    }
    chatMessages.appendChild(div);
    if (state.activeTab === 'chat' || window.innerWidth >= 1000) {
      tabContentChat.scrollTop = tabContentChat.scrollHeight;
    } else if (!msg.system) {
      state.unreadChat += 1;
      chatBadge.textContent = state.unreadChat > 9 ? '9+' : String(state.unreadChat);
      chatBadge.classList.remove('hidden');
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  function memberBadge(player) {
    const number = Number(player?.memberNo);
    if (!Number.isSafeInteger(number) || number < 1) return '';
    return `<span class="member-no${number <= 10 ? ' founder' : ''}" title="第 ${number} 位注册用户">No.${number}</span>`;
  }

  function offlineTag(p) {
    return p.connected ? '' : `<span class="offline-tag">已离线 · <span data-deadline="${p.deadline}">45</span>秒</span>`;
  }
  function lastGuessText(p) {
    if (!p.lastGuess) return '';
    const g = p.lastGuess;
    return `<small class="last-guess">第${g.round}轮猜：${escapeHtml(state.champById.get(g.championId)?.name || g.championId)} · ${g.correct ? '✓ 猜对' : '未中'}</small>`;
  }
  function renderRoster() {
    $('desktopPlayers').innerHTML = state.latestPlayers.map(p => `<li class="${p.id === state.currentPlayerId ? 'active-player' : ''}"><span class="player-avatar">${p.seat}</span><div class="roster-name"><strong>${escapeHtml(p.nickname)}${p.id === state.myId ? '（你）' : ''} ${memberBadge(p)}</strong><small>${p.isHost ? '房主 · ' : ''}${p.guessedCorrectly ? '已猜出' : p.id === state.currentPlayerId ? '正在作答' : '等待作答'}</small>${offlineTag(p)}${lastGuessText(p)}</div></li>`).join('');
    $('rosterCount').textContent = `${state.latestPlayers.length} / 10`;
    updateCountdowns();
  }
  function setTurnPane(pane) {
    [turnWaitingPane, turnChoicePane, questionComposePane, questionActivePane, voiceTurnPane, turnGuessPane]
      .forEach(item => item?.classList.toggle('hidden', item !== pane));
  }

  function openTurnModal() {
    if (!turnModal || state.status !== 'playing') return;
    turnModal.classList.remove('hidden');
  }

  function closeTurnModal() {
    turnModal?.classList.add('hidden');
    renderSuggestions([]);
  }

  function currentTurnPlayer() {
    return state.latestPlayers.find(player => player.id === state.currentPlayerId) || null;
  }

  function renderQuestionPane(action, mine) {
    setTurnPane(questionActivePane);
    const current = currentTurnPlayer();
    activeQuestionText.textContent = action.question || '—';
    activeQuestionAuthor.textContent = current ? `${current.seat}号 · ${current.nickname} 提问` : '当前玩家提问';

    const answers = Array.isArray(action.answers) ? action.answers : [];
    questionAnswers.replaceChildren();
    if (!answers.length) {
      const empty = document.createElement('p');
      empty.className = 'question-answer-empty';
      empty.textContent = '还没有人回答。';
      questionAnswers.appendChild(empty);
    } else {
      for (const answer of answers) {
        const row = document.createElement('div');
        row.className = 'question-answer-row';
        const name = document.createElement('strong');
        name.textContent = answer.playerId === state.myId ? `${answer.nickname}（你）` : answer.nickname;
        const text = document.createElement('span');
        text.textContent = answer.text;
        row.append(name, text);
        questionAnswers.appendChild(row);
      }
    }

    questionOwnerActions.classList.toggle('hidden', !mine);
    answerComposer.classList.toggle('hidden', mine);
    if (!mine) {
      const mineAnswer = answers.find(answer => answer.playerId === state.myId);
      if (document.activeElement !== turnAnswerInput) turnAnswerInput.value = mineAnswer?.text || '';
      submitTurnAnswerBtn.textContent = mineAnswer ? '更新回答' : '提交回答';
      answerFeedback.textContent = '';
    }
  }

  function renderTurnUI(autoOpen = false) {
    if (!turnActionDock || !turnModal) return;
    const current = currentTurnPlayer();
    const me = state.latestPlayers.find(player => player.id === state.myId);
    const mine = current?.id === state.myId && !me?.guessedCorrectly;
    const action = state.turnAction;

    if (state.status !== 'playing') {
      turnActionDock.classList.add('hidden');
      closeTurnModal();
      return;
    }

    turnActionDock.classList.remove('hidden');
    turnModalMode.textContent = state.mode === 'text' ? '💬 文字模式' : '🎙 语音模式';

    if (state.mode === 'text') {
      if (action?.type === 'question') {
        renderQuestionPane(action, mine);
        turnActionDockTitle.textContent = mine ? '你的问题正在等待回答' : `${current?.nickname || '当前玩家'} 正在提问`;
        turnActionDockText.textContent = mine ? `已收到 ${(action.answers || []).length} 条回答` : action.question;
        openTurnBtn.disabled = false;
        if (autoOpen) openTurnModal();
        return;
      }

      if (mine) {
        if (action?.type === 'guess') {
          setTurnPane(turnGuessPane);
          turnActionDockTitle.textContent = '本回合已选择直接答题';
          turnActionDockText.textContent = '请选择英雄并提交，本回合不能再提问';
          guessInput.disabled = false;
          guessBtn.disabled = false;
        } else {
          setTurnPane(turnChoicePane);
          turnActionDockTitle.textContent = '轮到你了';
          turnActionDockText.textContent = '请选择“提出问题”或“直接答题”';
        }
        openTurnBtn.disabled = false;
        if (autoOpen) openTurnModal();
        return;
      }

      setTurnPane(turnWaitingPane);
      turnWaitingText.textContent = current ? `等待 ${current.seat}号 · ${current.nickname} 选择本回合操作…` : '等待中…';
      turnActionDockTitle.textContent = current ? `等待 ${current.nickname}` : '等待中';
      turnActionDockText.textContent = '轮到对方选择提问或答题';
      openTurnBtn.disabled = true;
      if (!action) closeTurnModal();
      return;
    }

    if (mine) {
      setTurnPane(voiceTurnPane);
      turnActionDockTitle.textContent = '轮到你了 · 语音模式';
      turnActionDockText.textContent = '在语音里提问，需要猜英雄时再点“我要答题”';
      openTurnBtn.disabled = false;
      if (autoOpen) openTurnModal();
    } else {
      setTurnPane(turnWaitingPane);
      turnWaitingText.textContent = current ? `等待 ${current.seat}号 · ${current.nickname} 在语音中进行回合…` : '等待中…';
      turnActionDockTitle.textContent = current ? `等待 ${current.nickname}` : '等待中';
      turnActionDockText.textContent = '请在语音里回答当前玩家的问题';
      openTurnBtn.disabled = true;
      closeTurnModal();
    }
  }

  openTurnBtn?.addEventListener('click', () => {
    renderTurnUI(false);
    openTurnModal();
  });
  turnModalClose?.addEventListener('click', closeTurnModal);

  chooseQuestionBtn?.addEventListener('click', () => {
    questionComposeFeedback.textContent = '';
    turnQuestionInput.value = '';
    setTurnPane(questionComposePane);
    turnQuestionInput.focus();
  });
  backToTurnChoiceBtn?.addEventListener('click', () => setTurnPane(turnChoicePane));

  submitQuestionBtn?.addEventListener('click', () => {
    const question = turnQuestionInput.value.trim();
    if (!question) {
      questionComposeFeedback.textContent = '先输入一个问题。';
      return;
    }
    submitQuestionBtn.disabled = true;
    state.socket.emit('turn_question', { question }, (ack) => {
      submitQuestionBtn.disabled = false;
      if (!ack?.ok) questionComposeFeedback.textContent = ack?.error || '提问失败，请重试';
    });
  });

  chooseGuessBtn?.addEventListener('click', () => {
    chooseGuessBtn.disabled = true;
    state.socket.emit('turn_choose_guess', {}, (ack) => {
      chooseGuessBtn.disabled = false;
      if (!ack?.ok) return showToast(ack?.error || '无法进入答题');
      guessInput.value = '';
      delete guessInput.dataset.selectedId;
      guessFeedback.textContent = '';
    });
  });

  voiceGuessBtn?.addEventListener('click', () => {
    setTurnPane(turnGuessPane);
    guessInput.value = '';
    delete guessInput.dataset.selectedId;
    guessFeedback.textContent = '';
    guessInput.disabled = false;
    guessBtn.disabled = false;
    guessInput.focus();
  });

  document.querySelectorAll('[data-quick-answer]').forEach(button => {
    button.addEventListener('click', () => {
      turnAnswerInput.value = button.dataset.quickAnswer || '';
      turnAnswerInput.focus();
    });
  });

  submitTurnAnswerBtn?.addEventListener('click', () => {
    const text = turnAnswerInput.value.trim();
    if (!text) {
      answerFeedback.textContent = '请输入回答。';
      return;
    }
    submitTurnAnswerBtn.disabled = true;
    state.socket.emit('turn_answer', { text }, (ack) => {
      submitTurnAnswerBtn.disabled = false;
      if (!ack?.ok) answerFeedback.textContent = ack?.error || '回答失败，请重试';
      else answerFeedback.textContent = '回答已提交，可以继续修改。';
    });
  });

  endQuestionTurnBtn?.addEventListener('click', () => {
    endQuestionTurnBtn.disabled = true;
    state.socket.emit('pass_turn', {}, ack => {
      endQuestionTurnBtn.disabled = false;
      if (!ack?.ok) return showToast(ack?.error || '结束回合失败');
      closeTurnModal();
    });
  });

  passBtn?.addEventListener('click', () => {
    passBtn.disabled = true;
    state.socket.emit('pass_turn', {}, ack => {
      passBtn.disabled = false;
      if (!ack?.ok) return showToast(ack?.error || '结束回合失败');
      closeTurnModal();
    });
  });

  function updateTurn() {
    const current = currentTurnPlayer();
    const me = state.latestPlayers.find(player => player.id === state.myId);
    const mine = current?.id === state.myId;
    const eligible = state.status === 'playing' && mine && !!state.socket?.connected && !me?.guessedCorrectly;
    const canGuess = eligible && (state.mode === 'voice' || state.turnAction?.type === 'guess');

    guessInput.disabled = !canGuess;
    guessBtn.disabled = !canGuess;
    $('turnBanner').classList.toggle('hidden', state.status !== 'playing');
    $('turnBanner').classList.toggle('your-turn', mine);

    let detail = '';
    if (current && !current.connected) detail = offlineTag(current);
    else if (state.mode === 'voice') detail = mine
      ? '在语音里提问；需要猜英雄时打开回合窗口点“我要答题”'
      : '请在语音里回答当前玩家的问题';
    else if (state.turnAction?.type === 'question') detail = mine
      ? `你的问题已发出 · 已收到 ${(state.turnAction.answers || []).length} 条回答`
      : `请回答：${escapeHtml(state.turnAction.question)}`;
    else if (state.turnAction?.type === 'guess') detail = mine ? '你已选择直接答题，请填写英雄答案' : '当前玩家选择了直接答题';
    else detail = mine ? '请选择提出问题或直接答题；本回合只能二选一' : '等待当前玩家选择提问或答题';

    $('turnBanner').innerHTML = `<span>第 ${state.round || 1} 轮 · ${state.mode === 'text' ? '文字模式' : '语音模式'}</span><strong>${mine ? '轮到你了！' : current ? `等待 ${current.seat}号 · ${escapeHtml(current.nickname)} ${memberBadge(current)}` : '等待中'}</strong><small>${detail}</small>`;
    if (!canGuess) renderSuggestions([]);
    updateCountdowns();
  }

  function updateCountdowns() {
    document.querySelectorAll('[data-deadline]').forEach(el => { el.textContent = Math.max(0, Math.ceil((Number(el.dataset.deadline) - Date.now() - (state.clockOffset || 0))/1000)); });
    if (state.roomCode && state.socket && !state.socket.connected) $('connectionBanner').textContent = `连接已断开，正在自动重连 · 座位保留约 ${Math.max(0, Math.ceil((state.localDeadline-Date.now())/1000))} 秒`;
  }
  setInterval(updateCountdowns, 250);
  connectSocket();

  // 预加载英雄数据,提升首次创建/加入房间的速度
  loadChampionData().then(() => { if (state.roomCode) { renderRoster(); renderOthers(); if (state.results) renderResults(state.results); if (state.myChampionId) myChampName.textContent = state.champById.get(state.myChampionId)?.name || state.myChampionId; } }).catch(() => {
    /* 静默失败,创建/加入房间时会再次尝试并提示 */
  });
})();
