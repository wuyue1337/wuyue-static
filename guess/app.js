(() => {
  const $ = s => document.querySelector(s);
  const socket = io("/guess");

  const state = {
    clientId: localStorage.getItem("wuyue_guess_client") || makeId(),
    clientToken: localStorage.getItem("wuyue_guess_token") || makeId(),
    account: null,
    roomId: localStorage.getItem("wuyue_guess_room") || "",
    packs: [],
    rooms: [],
    room: null,
    pendingJoinRoom: null,
    leaderboards: {
      day:{top:[],self:null}, week:{top:[],self:null},
      month:{top:[],self:null}, total:{top:[],self:null}
    },
    leaderboardPeriod: "day",
    intermissionResult: null,
    pendingIntermission: null,
    transitionNoticeActive: false,
    soundEnabled: localStorage.getItem("wuyue_guess_sound") !== "off"
  };
  localStorage.setItem("wuyue_guess_client", state.clientId);
  localStorage.setItem("wuyue_guess_token", state.clientToken);

  const overlayQueue = [];
  let overlayBusy = false;
  let currentCountdown = false;
  let audioCtx = null;

  function makeId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
  }
  function nick() {
    if (state.account?.authenticated) return state.account.user.nickname;
    return ($("#nickname").value.trim() || localStorage.getItem("wuyue_guess_nick") || "游客").slice(0,12);
  }
  function identity(extra={}) {
    const nickname = nick();
    localStorage.setItem("wuyue_guess_nick", nickname);
    return { clientId: state.clientId, clientToken: state.clientToken, nickname, ...extra };
  }
  async function loadAccount() {
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      state.account = data;
      const box = $("#accountIdentity");
      if (data.authenticated && data.user) {
        box.innerHTML = `${avatarHtml({nickname:data.user.nickname,avatarUrl:data.user.avatar},"avatar")}<div><strong>${escapeHtml(data.user.nickname)}</strong> ${memberNoHtml(data.user)}<p class="muted small">@${escapeHtml(data.user.username)} · 成绩会写入长期排行</p></div>`;
        $("#guestNicknameLabel").classList.add("hidden");
        $("#loginLink").textContent = "查看个人资料 ↗";
        $("#loginLink").href = "/account/";
      } else {
        box.innerHTML = '<span class="avatar avatar-fallback">游</span><div><strong>游客</strong><p class="muted small">游客可以完整游玩，成绩不进入长期排行。</p></div>';
        $("#guestNicknameLabel").classList.remove("hidden");
      }
    } catch {
      state.account = { authenticated:false };
    }
  }
  function toast(msg) {
    const el=$("#toast");
    el.textContent=msg;
    el.classList.remove("hidden");
    clearTimeout(toast.t);
    toast.t=setTimeout(()=>el.classList.add("hidden"),2200);
  }
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function isCurrentRoomEvent(payload) {
    return !!payload?.roomId && !!state.roomId && payload.roomId === state.roomId;
  }
  function packName(id){ return state.packs.find(p=>p.id===id)?.name || id || "题库"; }
  function statusText(s){
    return ({LOBBY:"等待中",COUNTDOWN:"准备中",PLAYING:"游戏中",RESULT:"结算中",INTERMISSION:"中场休息"})[s]||s;
  }
  function formatTimeSeconds(v) {
    return v == null ? "—" : `${Number(v).toFixed(1)}s`;
  }

  function initials(name) {
    const s = String(name || "玩").trim();
    return escapeHtml([...s][0] || "玩");
  }
  function avatarHtml(player, cls="avatar") {
    const name = player?.nickname || "玩家";
    const url = player?.avatarUrl || "";
    if (url) return `<span class="${cls} avatar-wrap"><span class="avatar-fallback-letter">${initials(name)}</span><img data-player-avatar src="${escapeHtml(url)}" alt=""></span>`;
    return `<span class="${cls} avatar-fallback">${initials(name)}</span>`;
  }
  function memberNoHtml(player) {
    const number = Number(player?.memberNo);
    if (!Number.isSafeInteger(number) || number < 1) return "";
    return `<span class="member-no${number <= 10 ? " founder" : ""}" title="第 ${number} 位注册用户">No.${number}</span>`;
  }
  document.addEventListener("error", event => {
    if (event.target?.matches?.("img[data-player-avatar]")) event.target.remove();
  }, true);

  // ---------- lightweight synthesized sound ----------
  function updateSoundButton() {
    $("#soundToggle").textContent = state.soundEnabled ? "🔊 音效" : "🔇 静音";
    $("#soundToggle").classList.toggle("muted-sound", !state.soundEnabled);
  }
  function ensureAudio() {
    if (!state.soundEnabled) return null;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    } catch { return null; }
  }
  function beep(freq=520, duration=.08, gain=.035, type="sine", delay=0) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + .01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t); osc.stop(t + duration + .03);
  }
  function playSound(kind) {
    if (!state.soundEnabled) return;
    if (kind==="count") beep(520,.07,.028,"sine");
    else if (kind==="start") { beep(650,.08,.035); beep(880,.11,.035,"sine",.09); }
    else if (kind==="selfCorrect") { beep(660,.09,.04); beep(880,.12,.04,"sine",.08); beep(1100,.15,.035,"sine",.17); }
    else if (kind==="otherCorrect") beep(720,.07,.022,"triangle");
    else if (kind==="allGuessed") { beep(700,.08,.035); beep(900,.12,.035,"sine",.08); }
    else if (kind==="timeout") { beep(310,.13,.035,"triangle"); beep(245,.16,.03,"triangle",.12); }
    else if (kind==="skip") beep(430,.11,.03,"square");
    else if (kind==="result") { beep(540,.08,.025); beep(670,.09,.025,"sine",.08); }
    else if (kind==="rematch") { beep(600,.08,.035); beep(800,.08,.035,"sine",.08); beep(1000,.13,.035,"sine",.16); }
  }

  $("#soundToggle").addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    localStorage.setItem("wuyue_guess_sound", state.soundEnabled ? "on" : "off");
    updateSoundButton();
    if (state.soundEnabled) { ensureAudio(); playSound("count"); }
  });
  updateSoundButton();

  // ---------- socket ----------
  socket.on("connect", () => {
    $("#conn").textContent = "已连接";
    socket.emit("requestLeaderboards");
    if (state.roomId) socket.emit("joinRoom", identity({ roomId: state.roomId, password: "" }));
  });
  socket.on("disconnect", () => $("#conn").textContent="连接中断，正在重连…");
  socket.on("packs", packs => { state.packs=packs; renderPackSelect(); });
  socket.on("lobbyRooms", rooms => { state.rooms=rooms; renderLobby(); });
  socket.on("leaderboards", payload => {
    state.leaderboards = payload || state.leaderboards;
    renderLeaderboard();
  });
  socket.on("leaderboardChanged", () => socket.emit("requestLeaderboards"));
  socket.on("joinError", payload => {
    const msg = typeof payload === "string" ? payload : payload?.text;
    const failedRoomId = typeof payload === "object" ? payload?.roomId : state.roomId;
    if (failedRoomId && state.roomId && failedRoomId !== state.roomId) return;
    toast(msg || "加入房间失败");
    if (state.roomId && failedRoomId === state.roomId) {
      state.roomId="";
      localStorage.removeItem("wuyue_guess_room");
      leaveLocal();
    }
  });
  socket.on("createError", msg => toast(msg));
  socket.on("roomJoined", ({roomId,clientId}) => {
    clearAllOverlays();
    if (clientId) state.clientId=clientId;
    state.roomId=roomId;
    localStorage.setItem("wuyue_guess_room", roomId);
    $("#entryView").classList.add("hidden");
    $("#roomView").classList.remove("hidden");
  });
  socket.on("kicked", payload => {
    if (!isCurrentRoomEvent(payload)) return;
    toast(payload.text || "你已被移出房间");
    leaveLocal();
  });
  socket.on("sessionReplaced", payload => {
    if (payload?.roomId && payload.roomId !== state.roomId) return;
    toast("账号已在另一个页面进入游戏");
    leaveLocal();
  });

  socket.on("roomState", room => {
    if (!isCurrentRoomEvent(room)) return;
    state.room = room;
    renderRoom();

    if (room.state === "INTERMISSION" && room.revealedAnswer) {
      const payload = {
        roomId: room.id,
        answer: room.revealedAnswer,
        players: room.players || [],
        topGuesses: room.topGuesses || [],
        remainingSeconds: room.remainingSeconds,
        isFinal: room.isFinalIntermission,
        reason: room.intermissionReason || ""
      };
      if (state.transitionNoticeActive && !state.intermissionResult) {
        state.pendingIntermission = payload;
      } else if (!state.intermissionResult) {
        showIntermissionResult(payload);
      } else {
        updateIntermissionCountdown(room.remainingSeconds, room.isFinalIntermission);
      }
    }
  });

  socket.on("systemMessage", payload => {
    if (!isCurrentRoomEvent(payload)) return;
    addFeed("system","系统",payload.text || "");
  });
  socket.on("feedMessage", m => {
    if (!isCurrentRoomEvent(m)) return;
    addFeed(m.type,m.nickname,m.text,m.similarity);
    if (m.type==="correct" && m.clientId !== state.clientId) playSound("otherCorrect");
  });
  socket.on("roundResult", r => {
    if (!isCurrentRoomEvent(r)) return;
    addFeed("system","本轮答案",r.answer);
    playSound("result");
    if (state.transitionNoticeActive) state.pendingIntermission = r;
    else showIntermissionResult(r);
  });
  socket.on("roundNotice", n => {
    if (!isCurrentRoomEvent(n)) return;
    if (n.type==="allGuessed") {
      playSound("allGuessed");
      showTransitionNotice("🏆 全员完成！","所有在线玩家都已猜中",1050,"success");
    } else if (n.type==="timeout") {
      playSound("timeout");
      showTransitionNotice("⏰ 时间到！","正在进入回合结算",1050,"timeout");
    } else if (n.type==="skipped") {
      playSound("skip");
      showTransitionNotice("⏭ 本题已跳过","全体在线参赛玩家已同意",1050,"skip");
    } else if (n.type==="restarted") {
      queueOverlay({kind:"restart",eyebrow:"房间状态",title:"🔄 已重新开局",subtitle:"本局积分和轮数已重置",meta:"等待房主再次开始",ms:1500});
    }
  });
  socket.on("countdownNotice", n => {
    if (!isCurrentRoomEvent(n)) return;
    playSound(n.value==="开始！" ? "start" : "count");
    showRoundCountdown(n);
  });
  socket.on("personalNotice", n => {
    if (!isCurrentRoomEvent(n)) return;
    playSound("selfCorrect");
    queueOverlay({kind:"personal",eyebrow:"猜词成功",title:n.title||"✅ 猜中了！",subtitle:n.subtitle||"",meta:"你可以继续看其他玩家猜词并参与聊天",ms:1500});
  });
  socket.on("scoreHint", n => {
    if (!isCurrentRoomEvent(n)) return;
    toast(`${n.text} · ${Number(n.similarity||0).toFixed(1)}%`);
  });
  socket.on("gameFinished", payload => {
    if (!isCurrentRoomEvent(payload)) return;
    clearAllOverlays();
    queueOverlay({kind:"success",eyebrow:"本局结束",title:"🏁 本局游戏结束",subtitle:"可以投票再来一局",meta:"严格过半即自动开始",ms:1600});
    socket.emit("requestLeaderboards");
  });
  socket.on("rematchPassed", payload => {
    if (!isCurrentRoomEvent(payload)) return;
    playSound("rematch");
    showTransitionNotice("🔁 再来一局！","投票已通过，即将重新开始",850,"success");
  });

  // ---------- base controls ----------
  $("#nickname").value = localStorage.getItem("wuyue_guess_nick") || "";
  loadAccount();
  $("#refreshBtn").addEventListener("click",()=>location.reload());

  document.querySelectorAll(".leader-tab").forEach(btn=>btn.addEventListener("click",()=>{
    state.leaderboardPeriod=btn.dataset.period;
    document.querySelectorAll(".leader-tab").forEach(x=>x.classList.toggle("active",x===btn));
    renderLeaderboard();
  }));

  $("#packSelect").addEventListener("change",()=>{renderSourceOptions();updateDifficultyOptions();});
  $("#sourceMode").addEventListener("change",()=>{renderSourceOptions();updateDifficultyOptions();});

  $("#createBtn").addEventListener("click",()=>{
    ensureAudio();
    socket.emit("createRoom",identity({
      roomName:$("#roomName").value.trim(),
      password:$("#roomPassword").value,
      packId:$("#packSelect").value,
      sources:selectedSources(),
      difficulty:$("#difficulty").value,
      roundTime:Number($("#roundTime").value),
      totalRounds:Number($("#totalRounds").value),
      breakTime:Number($("#breakTime").value),
      maxPlayers:Number($("#maxPlayers").value),
      hintTempo:$("#hintTempo").value
    }));
  });
  $("#startBtn").addEventListener("click",()=>{ if(state.room) socket.emit("startGame",{roomId:state.room.id}); });
  $("#leaveBtn").addEventListener("click",()=>{
    if(state.roomId) socket.emit("leaveRoom",{roomId:state.roomId});
    leaveLocal();
  });
  $("#skipBtn").addEventListener("click",()=>{
    if(state.roomId) socket.emit("voteSkip",{roomId:state.roomId});
  });
  $("#rematchBtn").addEventListener("click",()=>{
    if(state.roomId) socket.emit("voteRematch",{roomId:state.roomId});
  });
  $("#restartBtn").addEventListener("click",()=>{
    if(!state.room || state.room.hostClientId!==state.clientId) return;
    if(!confirm("确定重新开局吗？当前轮数和本局积分会清零，房间成员会保留。")) return;
    socket.emit("restartRoom",{roomId:state.room.id});
  });
  $("#copyBtn").addEventListener("click",async()=>{
    if(!state.room)return;
    try{await navigator.clipboard.writeText(state.room.id);toast("房间号已复制");}
    catch{prompt("复制房间号：",state.room.id);}
  });
  $("#msgForm").addEventListener("submit",e=>{
    e.preventDefault();
    const input=$("#msgInput"),text=input.value.trim();
    if(!text || !state.roomId)return;
    socket.emit("submitMessage",{roomId:state.roomId,text});
    input.value="";
  });
  $("#passwordForm").addEventListener("submit",e=>{
    e.preventDefault();
    if(!state.pendingJoinRoom)return;
    socket.emit("joinRoom",identity({roomId:state.pendingJoinRoom.id,password:$("#joinPassword").value}));
    $("#passwordDialog").close();
  });

  // ---------- lobby ----------
  function renderPackSelect(){
    $("#packSelect").innerHTML=state.packs.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("");
    renderSourceOptions();updateDifficultyOptions();
  }
  function renderSourceOptions(){
    const pack=state.packs.find(p=>p.id===$("#packSelect").value);
    const wrap=$("#sourceWrap"),opts=$("#sourceOptions");
    if(!pack || !pack.sources?.length){wrap.classList.add("hidden");opts.innerHTML="";return;}
    wrap.classList.remove("hidden");
    opts.innerHTML=pack.sources.map((s,i)=>`<label class="source-chip"><input type="checkbox" value="${escapeHtml(s.id)}" ${i===0?"checked":""}> ${escapeHtml(s.name)}</label>`).join("");
    const mode=$("#sourceMode").value;
    opts.classList.toggle("hidden",mode==="all");
    if(mode==="single"){
      opts.querySelectorAll("input").forEach((x,i)=>{x.type="radio";x.name="singleSource";x.checked=i===0;});
    }else{
      opts.querySelectorAll("input").forEach(x=>{x.type="checkbox";x.removeAttribute("name");});
    }
    opts.querySelectorAll("input").forEach(x=>x.addEventListener("change",updateDifficultyOptions));
    updateDifficultyOptions();
  }
  function difficultyCountsForSelection(){
    const pack=state.packs.find(p=>p.id===$("#packSelect").value);
    if(!pack)return{"全部":0,"简单":0,"普通":0,"困难":0};
    const sources=selectedSources();
    if(!sources.length)return pack.counts||{"全部":0,"简单":0,"普通":0,"困难":0};
    const counts={"全部":0,"简单":0,"普通":0,"困难":0};
    for(const sourceId of sources){
      const src=pack.sources.find(s=>s.id===sourceId);
      if(!src?.counts)continue;
      for(const k of Object.keys(counts))counts[k]+=Number(src.counts[k]||0);
    }
    return counts;
  }
  function updateDifficultyOptions(){
    const counts=difficultyCountsForSelection(),select=$("#difficulty");
    for(const opt of select.options){
      const n=Number(counts[opt.value]||0);
      opt.textContent=`${opt.value}（${n}）`;opt.disabled=n<=0;
    }
    if(select.selectedOptions[0]?.disabled){
      const first=[...select.options].find(o=>!o.disabled);if(first)select.value=first.value;
    }
  }
  function selectedSources(){
    const pack=state.packs.find(p=>p.id===$("#packSelect").value);
    if(!pack?.sources?.length || $("#sourceMode").value==="all")return[];
    return[...$("#sourceOptions").querySelectorAll("input:checked")].map(x=>x.value);
  }
  function renderLeaderboard(){
    const data=state.leaderboards?.[state.leaderboardPeriod]||{top:[],self:null};
    const body=$("#leaderboardBody");
    if(!data.top?.length){
      body.innerHTML='<tr><td colspan="8" class="muted">暂无排行数据，登录后完成有效回合即可留下成绩。</td></tr>';
    }else{
      body.innerHTML=data.top.map(row=>`
        <tr class="${row.isSelf?"is-self":""}">
          <td class="leader-rank">${row.rank<=3?["🥇","🥈","🥉"][row.rank-1]:`#${row.rank}`}</td>
          <td><div class="player-ident">${avatarHtml(row,"leader-avatar")}<strong>${escapeHtml(row.nickname)}</strong>${memberNoHtml(row)}</div></td>
          <td><b>${row.score}</b></td>
          <td>${Number(row.accuracy||0).toFixed(1)}%</td>
          <td>${row.correct}</td><td>${row.played}</td><td>${row.bestStreak}</td>
          <td>${formatTimeSeconds(row.avgCorrectTime)}</td>
        </tr>`).join("");
    }
    const selfBox=$("#leaderboardSelf"),self=data.self;
    if(self && !data.top?.some(x=>x.isSelf)){
      selfBox.classList.remove("hidden");
      selfBox.innerHTML=`
        ${avatarHtml(self,"leader-avatar")}
        <span class="muted">你的排名</span><strong>#${self.rank} · ${escapeHtml(self.nickname)}</strong>${memberNoHtml(self)}
        <span>${self.score} 分</span><span>${Number(self.accuracy||0).toFixed(1)}%</span>
        <span>${self.correct}/${self.played} 题</span><span>最高 ${self.bestStreak} 连中</span>
        <span>平均 ${formatTimeSeconds(self.avgCorrectTime)}</span>`;
    }else{selfBox.classList.add("hidden");selfBox.innerHTML="";}
  }
  function renderLobby(){
    const box=$("#lobbyList");
    if(!state.rooms.length){box.innerHTML='<div class="empty">暂时没有房间，创建一个吧。</div>';return;}
    box.innerHTML=state.rooms.map(r=>`
      <div class="room-item"><div><h3>${escapeHtml(r.name)} ${r.locked?"🔒":""}</h3>
      <div class="muted">${escapeHtml(r.packName)} · ${r.players}/${r.maxPlayers}人 · ${statusText(r.state)}${r.round?` · 第${r.round}/${r.totalRounds}轮`:""}</div></div>
      <button class="join-btn primary" data-id="${r.id}" data-locked="${r.locked}">加入</button></div>`).join("");
    box.querySelectorAll(".join-btn").forEach(btn=>btn.addEventListener("click",()=>{
      const room=state.rooms.find(r=>r.id===btn.dataset.id);if(!room)return;
      ensureAudio();
      if(room.locked){state.pendingJoinRoom=room;$("#joinPassword").value="";$("#passwordDialog").showModal();}
      else socket.emit("joinRoom",identity({roomId:room.id,password:""}));
    }));
  }

  // ---------- room ----------
  function renderPlayerCard(p,r,isHost){
    return `<div class="player">
      <span class="${p.connected?"online-dot":"online-dot offline-dot"}"></span>
      ${avatarHtml(p)}
      <div><strong>${escapeHtml(p.nickname)}</strong> ${memberNoHtml(p)}
        ${p.clientId===r.hostClientId?'<span class="tag">房主</span>':""}
        ${p.loggedIn?'<span class="tag">已登录</span>':'<span class="tag">游客</span>'}
        ${(r.rematchVoterIds||[]).includes(p.clientId)?'<span class="tag success-tag">已投再来</span>':""}
        ${p.guessed?'<span class="tag success-tag">已猜中</span>':""}
        <div class="muted small">${p.connected?"在线":"重连中…"}</div>
      </div>
      ${isHost && p.clientId!==state.clientId?`<button class="kick" data-id="${p.clientId}">踢</button>`:""}
    </div>`;
  }
  function renderRoom(){
    const r=state.room;if(!r)return;
    $("#roomId").textContent=r.id;
    $("#roomTitle").textContent=r.name;
    $("#roomMeta").textContent=`${packName(r.settings.packId)} · 第 ${r.round}/${r.totalRounds} 轮 · ${r.settings.roundTime}秒/轮 · 提示${r.settings.hintTempo||"标准"}`;
    $("#stateBadge").textContent=statusText(r.state);
    $("#timer").textContent=r.remainingSeconds?`${r.remainingSeconds}s`:"—";

    const me=r.players.find(p=>p.clientId===state.clientId);
    const isHost=r.hostClientId===state.clientId;
    const mySkipVote=(r.skipVoterIds||[]).includes(state.clientId);
    const myRematchVote=(r.rematchVoterIds||[]).includes(state.clientId);

    $("#startBtn").classList.toggle("hidden",!isHost || r.awaitingRematch);
    $("#restartBtn").classList.toggle("hidden",!isHost);
    $("#startBtn").disabled=r.state!=="LOBBY";
    $("#skipBtn").classList.toggle("voted",mySkipVote);
    $("#skipBtn").disabled=r.state!=="PLAYING" || !!me?.spectatorUntilNextRound;
    $("#skipBtn").firstChild.textContent=mySkipVote?"撤回跳过 ":"全票跳过 ";
    $("#skipCount").textContent=`${r.skipVotes||0}/${r.skipNeeded||1}`;

    $("#rematchBtn").classList.toggle("hidden",!(r.state==="LOBBY"&&r.awaitingRematch));
    $("#rematchBtn").classList.toggle("voted",myRematchVote);
    $("#rematchBtn").firstChild.textContent=myRematchVote?"撤回再来 ":"再来一局 ";
    $("#rematchCount").textContent=`${r.rematchVotes||0}/${r.rematchNeeded||1}`;
    $("#spectatorNote").classList.toggle("hidden",!me?.spectatorUntilNextRound);

    const top=r.topGuesses||[];
    $("#topGuessPanel").classList.toggle("hidden",!top.length);
    $("#topGuesses").innerHTML=top.map((g,i)=>`<div class="top-guess-row"><span class="top-guess-index">#${i+1}</span><strong>${escapeHtml(g.word)}</strong><b>${Number(g.similarity||0).toFixed(1)}%</b></div>`).join("");

    if(!r.question){
      $("#questionBox").innerHTML=`<div class="big">${r.state==="COUNTDOWN"?"准备开始":"等待房主开始"}</div><div class="muted">${r.awaitingRematch?"本局已结束，可投票再来一局。":r.state==="COUNTDOWN"?"倒计时结束后开始第一题。":"游戏中也可以加入，新玩家从下一轮开始参与。"}</div>`;
    }else{
      $("#questionBox").innerHTML=`<div class="big">${escapeHtml(r.question.category||packName(r.settings.packId))}</div><div class="muted">${escapeHtml(r.question.sourceName||"")} · ${escapeHtml(r.question.difficulty)} · ${r.question.length}字</div>`;
    }

    $("#hints").innerHTML=(r.question?.hints||[]).map((h,i)=>{
      const text=typeof h==="string"?h:h.text;
      const stage=typeof h==="string"?`提示 ${i+1}`:(h.stage||`提示 ${i+1}`);
      return `<div class="hint"><span class="hint-stage">${escapeHtml(stage)}</span>${escapeHtml(text)}</div>`;
    }).join("");

    const participants=r.players.filter(p=>!p.spectatorUntilNextRound);
    const spectators=r.players.filter(p=>p.spectatorUntilNextRound);
    $("#players").innerHTML=participants.map(p=>renderPlayerCard(p,r,isHost)).join("")||'<div class="muted small">暂无参赛玩家</div>';
    $("#spectatorSection").classList.toggle("hidden",!spectators.length);
    $("#spectators").innerHTML=spectators.map(p=>`<div class="player spectator-player">
      <span class="${p.connected?"online-dot":"online-dot offline-dot"}"></span>${avatarHtml(p)}
      <div><strong>${escapeHtml(p.nickname)}</strong> ${memberNoHtml(p)} <span class="tag">观战</span><div class="muted small">下一轮自动参赛</div></div>
      ${isHost&&p.clientId!==state.clientId?`<button class="kick" data-id="${p.clientId}">踢</button>`:""}</div>`).join("");
    document.querySelectorAll("#players .kick,#spectators .kick").forEach(b=>b.addEventListener("click",()=>socket.emit("kickPlayer",{roomId:r.id,targetClientId:b.dataset.id})));

    const sorted=[...participants].sort((a,b)=>{
      if(a.guessed&&!b.guessed)return-1;if(!a.guessed&&b.guessed)return 1;
      if(a.guessed&&b.guessed)return b.roundScore-a.roundScore;
      return b.bestSimilarity-a.bestSimilarity;
    });
    $("#roundRank").innerHTML=sorted.map((p,i)=>`
      <div class="rank-row"><strong>#${i+1}</strong>${avatarHtml(p,"rank-avatar")}
      <div>${escapeHtml(p.nickname)} ${memberNoHtml(p)}<div class="muted small">${p.guessed?"已猜中":p.bestGuess?`最佳：${escapeHtml(p.bestGuess)}`:"暂无猜测"}</div></div>
      <strong>${p.guessed?(p.roundScore>=0?`+${p.roundScore}`:`${p.roundScore}`):`${Number(p.bestSimilarity||0).toFixed(1)}%`}</strong></div>`).join("")||'<div class="muted small">暂无排名</div>';

    $("#totalRank").innerHTML=[...r.players].sort((a,b)=>b.totalScore-a.totalScore).map((p,i)=>`
      <div class="rank-row"><strong>#${i+1}</strong>${avatarHtml(p,"rank-avatar")}
      <div>${escapeHtml(p.nickname)} ${memberNoHtml(p)} ${p.loggedIn?"":"<span class='tag'>不计长期排行</span>"}</div><strong>${p.totalScore}</strong></div>`).join("");
  }

  // ---------- overlays ----------
  function showTransitionNotice(title,subtitle,ms=1050,kind=""){
    if(!state.roomId)return;
    state.transitionNoticeActive=true;
    resetOverlayClasses();
    if(kind)$("#overlayCard").classList.add(`overlay-${kind}`);
    $("#overlayEyebrow").textContent="关键节点";
    $("#overlayTitle").textContent=title;
    $("#overlaySubtitle").textContent=subtitle||"";
    $("#overlayMeta").textContent="";
    $("#overlayResults").classList.add("hidden");
    $("#roundOverlay").classList.remove("hidden","overlay-leave");
    requestAnimationFrame(()=>$("#roundOverlay").classList.add("overlay-visible"));
    clearTimeout(showTransitionNotice.t);
    showTransitionNotice.t=setTimeout(()=>{
      hideOverlay(()=>{
        if(!state.roomId)return;
        state.transitionNoticeActive=false;
        const pending=state.pendingIntermission;state.pendingIntermission=null;
        if(pending && isCurrentRoomEvent(pending)) showIntermissionResult(pending);
        else if(state.room?.state==="INTERMISSION"&&state.room?.revealedAnswer){
          showIntermissionResult({
            roomId:state.room.id,answer:state.room.revealedAnswer,players:state.room.players||[],
            topGuesses:state.room.topGuesses||[],remainingSeconds:state.room.remainingSeconds,
            isFinal:state.room.isFinalIntermission,reason:state.room.intermissionReason||""
          });
        }
      });
    },ms);
  }
  function resetOverlayClasses(){
    const card=$("#overlayCard");card.className="round-overlay-card";
    $("#overlayCountdown").classList.add("hidden");
    $("#overlayTitle").classList.remove("hidden");
    $("#overlayResults").classList.add("hidden");$("#overlayResults").innerHTML="";
    $("#overlayProgressBar").style.animation="none";
  }
  function applyOverlay(item){
    if(!state.roomId)return;
    resetOverlayClasses();
    if(item.kind)$("#overlayCard").classList.add(`overlay-${item.kind}`);
    $("#overlayEyebrow").textContent=item.eyebrow||"";
    $("#overlayTitle").textContent=item.title||"";
    $("#overlaySubtitle").textContent=item.subtitle||"";
    $("#overlayMeta").textContent=item.meta||"";
    $("#roundOverlay").classList.remove("hidden","overlay-leave");
    $("#roundOverlay").classList.add("overlay-enter");
    requestAnimationFrame(()=>{$("#roundOverlay").classList.add("overlay-visible");$("#roundOverlay").classList.remove("overlay-enter");});
    const bar=$("#overlayProgressBar");bar.style.animation="none";void bar.offsetWidth;
    bar.style.animation=`overlayProgress ${Math.max(500,item.ms||1800)}ms linear forwards`;
  }
  function hideOverlay(after){
    $("#roundOverlay").classList.remove("overlay-visible");
    $("#roundOverlay").classList.add("overlay-leave");
    setTimeout(()=>{
      $("#roundOverlay").classList.add("hidden");$("#roundOverlay").classList.remove("overlay-leave");
      if(after)after();
    },280);
  }
  function queueOverlay(item){overlayQueue.push(item);runOverlayQueue();}
  function runOverlayQueue(){
    if(overlayBusy||currentCountdown||!overlayQueue.length||!state.roomId)return;
    overlayBusy=true;const item=overlayQueue.shift();applyOverlay(item);
    setTimeout(()=>hideOverlay(()=>{overlayBusy=false;setTimeout(runOverlayQueue,120);}),item.ms||1800);
  }
  function showRoundCountdown(n){
    if(!isCurrentRoomEvent(n))return;
    state.intermissionResult=null;state.pendingIntermission=null;
    currentCountdown=true;overlayBusy=false;overlayQueue.length=0;
    resetOverlayClasses();$("#overlayCard").classList.add("overlay-countdown-card");
    $("#overlayEyebrow").textContent="即将开始";
    $("#overlayTitle").textContent=`第 ${n.round||"—"} / ${n.totalRounds||"—"} 轮`;
    $("#overlaySubtitle").textContent=n.value==="开始！"?"开始猜词！":"准备好了吗？";
    $("#overlayMeta").textContent=`${n.packName||"题库"} · ${n.difficulty||"全部"}难度`;
    const count=$("#overlayCountdown");count.classList.remove("hidden");count.textContent=String(n.value);
    $("#roundOverlay").classList.remove("hidden","overlay-leave");$("#roundOverlay").classList.add("overlay-visible");
    count.classList.remove("count-pop");void count.offsetWidth;count.classList.add("count-pop");
    const bar=$("#overlayProgressBar");bar.style.animation="none";void bar.offsetWidth;bar.style.animation="overlayProgress 1100ms linear forwards";
    clearTimeout(showRoundCountdown.t);
    if(n.value==="开始！"){
      showRoundCountdown.t=setTimeout(()=>hideOverlay(()=>{
        if(!state.roomId)return;
        currentCountdown=false;$("#msgInput").focus();runOverlayQueue();
      }),900);
    }
  }
  function showIntermissionResult(result){
    if(!isCurrentRoomEvent(result))return;
    state.intermissionResult={answer:result.answer||"",players:result.players||[],topGuesses:result.topGuesses||[],isFinal:Boolean(result.isFinal)};
    currentCountdown=false;overlayBusy=false;overlayQueue.length=0;
    resetOverlayClasses();$("#overlayCard").classList.add("overlay-round-end","overlay-intermission");
    $("#overlayEyebrow").textContent=result.isFinal?"最终回合结算":"回合结算";
    $("#overlayTitle").textContent=`正确答案：${result.answer||"—"}`;
    $("#overlaySubtitle").textContent=result.isFinal?"本局最后一题已结束":"答案会保留到下一轮倒计时开始";
    const ranked=[...(result.players||[])].filter(p=>!p.spectatorUntilNextRound).sort((a,b)=>{
      if(a.guessed&&!b.guessed)return-1;if(!a.guessed&&b.guessed)return 1;
      if(a.guessed&&b.guessed)return b.roundScore-a.roundScore;
      return b.bestSimilarity-a.bestSimilarity;
    }).slice(0,3);
    const closest=(result.topGuesses||[])[0];
    $("#overlayResults").classList.remove("hidden");
    $("#overlayResults").innerHTML=`<div class="intermission-grid">
      <div class="intermission-block"><div class="intermission-label">本轮前三</div>
      ${ranked.length?ranked.map((p,i)=>`<div class="intermission-row"><span>${i+1}</span>${avatarHtml(p,"result-avatar")}<strong>${escapeHtml(p.nickname)} ${memberNoHtml(p)}</strong><b>${p.guessed?`${p.roundScore>=0?"+":""}${p.roundScore} 分`:`${Number(p.bestSimilarity||0).toFixed(1)}%`}</b></div>`).join(""):'<div class="muted small">暂无成绩</div>'}</div>
      <div class="intermission-block"><div class="intermission-label">最高接近词</div>
      ${closest?`<div class="closest-word">${escapeHtml(closest.word)}</div><div class="closest-sim">${Number(closest.similarity||0).toFixed(1)}%</div>`:'<div class="muted small">本轮没有错误猜测</div>'}</div></div>`;
    updateIntermissionCountdown(result.remainingSeconds??state.room?.remainingSeconds??0,result.isFinal);
    $("#roundOverlay").classList.remove("hidden","overlay-leave");requestAnimationFrame(()=>$("#roundOverlay").classList.add("overlay-visible"));
    $("#overlayProgressBar").style.animation="none";$("#overlayProgressBar").style.transform="scaleX(0)";
  }
  function updateIntermissionCountdown(seconds,isFinal=false){
    if(!state.intermissionResult)return;
    const n=Math.max(0,Number(seconds||0));
    $("#overlayMeta").textContent=isFinal?`本局将在 ${n} 秒后结束`:`下一轮将在 ${n} 秒后开始`;
  }

  function addFeed(type,nickname,text,similarity){
    const item=document.createElement("div");item.className=`feed-item ${type}`;
    if(type==="correct")item.innerHTML=`✅ <strong>${escapeHtml(nickname)}</strong> 猜中了！`;
    else if(type==="guess")item.innerHTML=`🎯 <b>${escapeHtml(nickname)}</b>：${escapeHtml(text)} <span class="sim">${Number(similarity||0).toFixed(1)}%</span>`;
    else if(type==="chat")item.innerHTML=`💬 <strong>${escapeHtml(nickname)}</strong>：${escapeHtml(text)}`;
    else item.innerHTML=`📢 ${escapeHtml(text)}`;
    $("#feed").prepend(item);
  }

  function clearAllOverlays(){
    clearTimeout(showTransitionNotice.t);clearTimeout(showRoundCountdown.t);
    state.transitionNoticeActive=false;state.pendingIntermission=null;state.intermissionResult=null;
    overlayQueue.length=0;overlayBusy=false;currentCountdown=false;
    $("#roundOverlay").classList.add("hidden");
    $("#roundOverlay").classList.remove("overlay-visible","overlay-leave","overlay-enter");
    $("#overlayResults").classList.add("hidden");$("#overlayResults").innerHTML="";
  }
  function leaveLocal(){
    clearAllOverlays();
    state.room=null;state.roomId="";
    localStorage.removeItem("wuyue_guess_room");
    $("#feed").innerHTML="";
    $("#roomView").classList.add("hidden");$("#entryView").classList.remove("hidden");
  }
})();
