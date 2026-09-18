(() => {
  'use strict';

  const roomCodeInput = document.getElementById('roomCodeInput');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const nicknameInput = document.getElementById('nicknameInput');
  const roomCodeBadge = document.getElementById('roomCodeBadge');
  const roomHeader = document.querySelector('.room-header');
  const roomScreen = document.getElementById('screen-room');
  const toast = document.getElementById('toast');

  function showToast(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.remove('hidden');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add('hidden'), 2400);
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

  function currentRoomCode() {
    const match = roomCodeBadge?.textContent?.match(/[A-Z0-9]{5}/i);
    return match ? match[0].toUpperCase() : '';
  }

  function inviteUrl(code) {
    const url = new URL('/lol/', location.origin);
    url.searchParams.set('room', code);
    return url.toString();
  }

  if (roomHeader && !document.getElementById('copyInviteLinkBtn')) {
    const button = document.createElement('button');
    button.id = 'copyInviteLinkBtn';
    button.className = 'room-invite-btn';
    button.type = 'button';
    button.textContent = '🔗 复制邀请链接';
    button.addEventListener('click', async () => {
      const code = currentRoomCode();
      if (!code) return showToast('房间信息还没准备好');
      const url = inviteUrl(code);
      if (await copyText(url)) showToast('邀请链接已复制，发给好友即可直接加入');
      else window.prompt('请复制邀请链接', url);
    });
    roomHeader.appendChild(button);
  }

  const params = new URLSearchParams(location.search);
  const invitedRoom = String(params.get('room') || '').trim().toUpperCase();
  if (/^[A-Z0-9]{5}$/.test(invitedRoom) && roomCodeInput && joinRoomBtn) {
    roomCodeInput.value = invitedRoom;
    if (nicknameInput && !nicknameInput.value.trim()) nicknameInput.value = '召唤师';
    setTimeout(() => joinRoomBtn.click(), 80);

    if (roomScreen) {
      const observer = new MutationObserver(() => {
        if (!roomScreen.classList.contains('hidden')) {
          history.replaceState(null, '', '/lol/');
          observer.disconnect();
        }
      });
      observer.observe(roomScreen, { attributes: true, attributeFilter: ['class'] });
    }
  }
})();
