'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const status = $('status');
  let auth = null;
  let pendingEmail = '';
  const integrationParams = new URLSearchParams(location.search);

  async function request(url, options = {}) {
    let response;
    try { response = await fetch(url, { cache: 'no-store', ...options }); }
    catch { throw new Error('连接失败，请稍后再试'); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '操作失败，请稍后再试');
    return data;
  }

  function message(text, ok = false) {
    status.textContent = text || '';
    status.classList.toggle('ok', ok);
  }

  function inlineMessage(id, text, ok = false) {
    const node = $(id);
    if (!node) return;
    node.textContent = text || '';
    node.classList.toggle('ok', ok);
  }

  function startButtonCooldown(button, seconds, idleText) {
    let left = Math.max(1, Number(seconds) || 60);
    button.disabled = true;
    clearInterval(button._cooldownTimer);
    const render = () => { button.textContent = `${left} 秒后可重发`; };
    render();
    button._cooldownTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(button._cooldownTimer);
        button._cooldownTimer = null;
        button.disabled = false;
        button.textContent = idleText;
        return;
      }
      render();
    }, 1000);
  }

  function drawProfile(user) {
    $('profile-avatar').src = user.avatar || 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg';
    $('profile-nickname').textContent = user.nickname;
    $('profile-username').textContent = `@${user.username}`;
    $('profile-member-no').textContent = user.memberNo ? `No.${user.memberNo}` : '';
    $('profile-member-no').classList.toggle('founder', Number(user.memberNo) <= 10);
    $('profile-member-no').title = user.memberNo ? `第 ${user.memberNo} 位注册用户` : '';
    $('profile-role').textContent = Number(user.memberNo) === 1 ? '站长' : user.role === 'admin' ? '管理员' : '普通用户';
    $('nickname').value = user.nickname;
    $('username').value = user.username;
    const profileHref = `/profile/?user=${encodeURIComponent(user.username)}`;
    $('public-profile-link').href = profileHref;
    $('top-profile-link').href = profileHref;
    $('reset-avatar').hidden = user.avatar === 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg';
  }

  async function loadSocial() {
    try {
      const data = await request('/api/social/me');
      $('status-message').value = data.statusMessage || '';
    } catch {}
  }

  async function loadEmail() {
    try {
      const data = await request('/api/auth/email');
      $('email-address').value = data.email || '';
      $('email-state').textContent = data.verified ? '已验证' : '未绑定';
      $('email-state').classList.toggle('verified', !!data.verified);
      $('email-current').textContent = data.verified ? `当前邮箱：${data.email}` : '绑定邮箱后可以用邮箱验证码找回密码。';
      if (!data.mailConfigured) $('email-current').textContent += '（邮件服务还未配置）';
    } catch {}
  }

  function formatNumber(value, digits = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    return number.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function drawOsuProvider(provider) {
    const account = provider?.account || null;
    const configured = provider?.configured === true;
    const host = $('osu-provider');
    const icon = host?.querySelector('.linked-provider-icon');
    const avatar = $('osu-provider-avatar');
    const verified = $('osu-provider-verified');
    const detail = $('osu-provider-detail');
    const stats = $('osu-provider-stats');
    const linkButton = $('osu-link-button');
    const profileButton = $('osu-profile-button');
    const refreshButton = $('osu-refresh-button');
    const unlinkButton = $('osu-unlink-button');
    if (!host || !avatar || !verified || !detail || !stats || !linkButton || !profileButton || !refreshButton || !unlinkButton) return;

    if (!account) {
      if (icon) icon.hidden = false;
      avatar.hidden = true;
      avatar.removeAttribute('src');
      verified.hidden = true;
      profileButton.hidden = true;
      refreshButton.hidden = true;
      unlinkButton.hidden = true;
      linkButton.hidden = false;
      linkButton.setAttribute('aria-disabled', configured ? 'false' : 'true');
      if (configured) {
        linkButton.href = '/api/integrations/osu/start';
        linkButton.style.pointerEvents = '';
        detail.textContent = '未绑定 osu! 账号';
        stats.textContent = '绑定时会跳转到 osu! 官方授权页面。';
      } else {
        linkButton.removeAttribute('href');
        linkButton.style.pointerEvents = 'none';
        detail.textContent = 'osu! 授权尚未完成服务器配置';
        stats.textContent = '需要先在本机填写 OSU_CLIENT_SECRET 并重启网站。';
      }
      return;
    }

    if (icon) icon.hidden = Boolean(account.avatarUrl);
    if (account.avatarUrl) {
      avatar.src = account.avatarUrl;
      avatar.hidden = false;
    } else {
      avatar.hidden = true;
      avatar.removeAttribute('src');
    }
    verified.hidden = false;
    detail.textContent = account.username || '已绑定 osu! 账号';
    const parts = [];
    if (account.mode) parts.push(account.mode);
    if (account.pp != null && Number.isFinite(Number(account.pp))) parts.push(`${formatNumber(account.pp, 0)} pp`);
    if (Number.isSafeInteger(Number(account.globalRank)) && Number(account.globalRank) > 0) parts.push(`全球 #${formatNumber(account.globalRank)}`);
    if (Number.isSafeInteger(Number(account.countryRank)) && Number(account.countryRank) > 0) parts.push(`国家 #${formatNumber(account.countryRank)}`);
    stats.textContent = parts.join(' · ') || '已通过 osu! 官方 OAuth 验证';
    linkButton.hidden = true;
    profileButton.hidden = !account.profileUrl;
    if (account.profileUrl) profileButton.href = account.profileUrl;
    refreshButton.hidden = false;
    unlinkButton.hidden = false;
  }

  async function loadIntegrations() {
    try {
      const data = await request('/api/integrations/me');
      drawOsuProvider(data.providers?.osu);
    } catch (error) {
      inlineMessage('osu-action-status', error.message);
    }
  }

  function showIntegrationReturnStatus() {
    if (integrationParams.get('integration') !== 'osu') return;
    const result = integrationParams.get('status');
    const messages = {
      linked: ['osu! 账号绑定成功。', true],
      cancelled: ['已取消 osu! 授权。', false],
      taken: ['这个 osu! 账号已经绑定到另一个霧月账号。', false],
      'invalid-state': ['osu! 授权已过期，请重新绑定。', false],
      'not-configured': ['服务器还没有配置 osu! Client Secret。', false],
      error: ['osu! 绑定失败，请稍后再试。', false]
    };
    const item = messages[result];
    if (item) {
      inlineMessage('osu-action-status', item[0], item[1]);
      message(item[0], item[1]);
    }
    history.replaceState(null, '', location.pathname);
  }

  function loadPreferences() {
    try {
      $('pref-presence-open').checked = localStorage.getItem('wuyue-presence-open') === '1';
      $('pref-community-activity').checked = localStorage.getItem('wuyue-show-community-activity') !== '0';
    } catch {
      $('pref-community-activity').checked = true;
    }
  }

  function bindPreferences() {
    $('pref-presence-open').addEventListener('change', event => {
      try { localStorage.setItem('wuyue-presence-open', event.currentTarget.checked ? '1' : '0'); } catch {}
      message('在线面板偏好已保存。', true);
    });
    $('pref-community-activity').addEventListener('change', event => {
      try { localStorage.setItem('wuyue-show-community-activity', event.currentTarget.checked ? '1' : '0'); } catch {}
      message(event.currentTarget.checked ? '首页最近动态已开启。' : '首页最近动态已关闭。', true);
    });
  }

  $('status-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
      const data = await request('/api/social/status', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ statusMessage: $('status-message').value }) });
      $('status-message').value = data.statusMessage || '';
      message('个人状态已保存。', true);
    } catch (error) { message(error.message); }
    finally { button.disabled = false; }
  });

  $('nickname-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
      const data = await request('/api/auth/me', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-csrf-token': auth.csrf }, body: JSON.stringify({ nickname: $('nickname').value }) });
      auth.user = data.user;
      drawProfile(auth.user);
      message('昵称已保存。', true);
    } catch (error) { message(error.message); }
    finally { button.disabled = false; }
  });

  $('username-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    inlineMessage('username-action-status', '正在验证并修改用户名…');
    try {
      const data = await request('/api/auth/username', {
        method: 'PATCH', headers: { 'content-type': 'application/json', 'x-csrf-token': auth.csrf },
        body: JSON.stringify({ username: $('username').value.trim(), password: $('username-password').value })
      });
      auth.user.username = data.username;
      $('username-password').value = '';
      drawProfile(auth.user);
      inlineMessage('username-action-status', data.message || '用户名已修改。', true);
      message(data.message || '用户名已修改。', true);
    } catch (error) {
      inlineMessage('username-action-status', error.message);
      message(error.message);
      if (error.message === '当前密码不正确') { $('username-password').select(); $('username-password').focus(); }
    } finally { button.disabled = false; }
  });

  $('avatar-form').addEventListener('submit', async event => {
    event.preventDefault();
    const file = $('avatar-file').files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1024 * 1024) { message('请选择 1 MB 以内的 PNG 或 JPEG 图片。'); return; }
    const button = event.currentTarget.querySelector('button[type=submit]'); button.disabled = true;
    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('图片读取失败')); reader.readAsDataURL(file);
      });
      const data = await request('/api/auth/avatar', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': auth.csrf }, body: JSON.stringify({ image }) });
      auth.user.avatar = data.avatar; drawProfile(auth.user); $('avatar-file').value = '';
      message('头像已更新。', true);
    } catch (error) { message(error.message); }
    finally { button.disabled = false; }
  });

  $('reset-avatar').addEventListener('click', async () => {
    const button = $('reset-avatar'); button.disabled = true;
    try {
      const data = await request('/api/auth/avatar', { method: 'DELETE', headers: { 'x-csrf-token': auth.csrf } });
      auth.user.avatar = data.avatar; drawProfile(auth.user); message('已恢复默认头像。', true);
    } catch (error) { message(error.message); }
    finally { button.disabled = false; }
  });

  $('email-request-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    const original = '发送验证码'; let cooling = false;
    button.disabled = true; button.textContent = '发送中…'; inlineMessage('email-action-status', '正在发送验证码…');
    try {
      pendingEmail = $('email-address').value.trim();
      const data = await request('/api/auth/email/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: pendingEmail, password: $('email-password').value }) });
      $('email-code').focus();
      inlineMessage('email-action-status', data.message || '验证码已发送。', true);
      message(data.message || '验证码已发送。', true);
      cooling = true; startButtonCooldown(button, data.cooldownSeconds || 60, original);
    } catch (error) {
      pendingEmail = ''; inlineMessage('email-action-status', error.message); message(error.message);
    } finally {
      if (!cooling) { button.disabled = false; button.textContent = original; }
    }
  });

  $('email-verify-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
      const email = pendingEmail || $('email-address').value.trim();
      await request('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code: $('email-code').value.trim() }) });
      $('email-password').value = ''; $('email-code').value = ''; pendingEmail = '';
      await loadEmail(); message('邮箱绑定成功。以后忘记密码可以通过这个邮箱找回。', true);
    } catch (error) { message(error.message); }
    finally { button.disabled = false; }
  });

  $('osu-refresh-button').addEventListener('click', async () => {
    const button = $('osu-refresh-button');
    button.disabled = true;
    inlineMessage('osu-action-status', '正在从 osu! 刷新公开资料…');
    try {
      const data = await request('/api/integrations/osu/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': auth.csrf },
        body: '{}'
      });
      await loadIntegrations();
      inlineMessage('osu-action-status', 'osu! 资料已刷新。', true);
      message('osu! 资料已刷新。', true);
    } catch (error) {
      inlineMessage('osu-action-status', error.message);
      message(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $('osu-unlink-button').addEventListener('click', async () => {
    if (!confirm('确定解除 osu! 账号绑定吗？之后可以重新授权绑定。')) return;
    const button = $('osu-unlink-button');
    button.disabled = true;
    inlineMessage('osu-action-status', '正在解除绑定…');
    try {
      await request('/api/integrations/osu', {
        method: 'DELETE',
        headers: { 'x-csrf-token': auth.csrf }
      });
      await loadIntegrations();
      inlineMessage('osu-action-status', '已解除 osu! 账号绑定。', true);
      message('已解除 osu! 账号绑定。', true);
    } catch (error) {
      inlineMessage('osu-action-status', error.message);
      message(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $('logout').addEventListener('click', async () => {
    const button = $('logout'); button.disabled = true;
    try {
      await request('/api/auth/logout', { method: 'POST', headers: { 'x-csrf-token': auth.csrf } });
      location.replace('/account/?view=login');
    } catch (error) { message(error.message); button.disabled = false; }
  });

  async function init() {
    try {
      auth = await request('/api/auth/me');
      if (!auth.authenticated) { location.replace('/account/?view=login&next=settings'); return; }
      drawProfile(auth.user);
      loadPreferences(); bindPreferences();
      await Promise.all([loadSocial(), loadEmail(), loadIntegrations()]);
      $('settings-loading').hidden = true;
      $('settings-shell').hidden = false;
      showIntegrationReturnStatus();
    } catch (error) {
      $('settings-loading').textContent = error.message;
    }
  }

  init();
})();
