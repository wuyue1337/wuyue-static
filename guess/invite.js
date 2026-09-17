(() => {
  'use strict';

  const roomView = document.getElementById('roomView');
  const roomActions = document.querySelector('#roomView .room-head .actions');
  const copyRoomButton = document.getElementById('copyBtn');
  const lobbyList = document.getElementById('lobbyList');
  const toast = document.getElementById('toast');

  function showToast(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.remove('hidden');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add('hidden'), 2200);
  }

  async function copyText(text) {
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('fallback');
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const input = document.createElement('textarea');
      input.value = text;
      input.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      return copied;
    }
  }

  function currentRoomId() {
    return String(document.getElementById('roomId')?.textContent || '').trim();
  }

  function inviteUrl(roomId) {
    const url = new URL('/guess/', location.origin);
    url.searchParams.set('room', roomId);
    return url.toString();
  }

  if (roomActions && !document.getElementById('guessInviteLinkBtn')) {
    const button = document.createElement('button');
    button.id = 'guessInviteLinkBtn';
    button.type = 'button';
    button.textContent = '🔗 复制邀请链接';
    button.addEventListener('click', async () => {
      const roomId = currentRoomId();
      if (!roomId) return showToast('房间信息还没准备好');
      const url = inviteUrl(roomId);
      if (await copyText(url)) showToast('邀请链接已复制，好友打开即可加入');
      else window.prompt('请复制邀请链接', url);
    });
    roomActions.insertBefore(button, copyRoomButton || roomActions.firstChild);
  }

  const params = new URLSearchParams(location.search);
  const invitedRoom = String(params.get('room') || '').trim();
  if (!invitedRoom || !lobbyList) return;

  let joined = false;
  function tryJoinFromLobby() {
    if (joined) return;
    const button = [...lobbyList.querySelectorAll('.join-btn')].find(btn => btn.dataset.id === invitedRoom);
    if (!button) return;
    joined = true;
    button.click();
  }

  const lobbyObserver = new MutationObserver(tryJoinFromLobby);
  lobbyObserver.observe(lobbyList, { childList: true, subtree: true });
  tryJoinFromLobby();

  if (roomView) {
    const roomObserver = new MutationObserver(() => {
      if (!roomView.classList.contains('hidden')) {
        history.replaceState(null, '', '/guess/');
        roomObserver.disconnect();
        lobbyObserver.disconnect();
      }
    });
    roomObserver.observe(roomView, { attributes: true, attributeFilter: ['class'] });
  }
})();
