'use strict';

const $ = id => document.getElementById(id);
const status = $('status');
const params = new URLSearchParams(location.search);
let auth = { authenticated: false };
let pendingEmail = '';

async function request(url, options = {}) {
  let response;
  try { response = await fetch(url, { cache: 'no-store', ...options }); }
  catch { throw new Error('连接失败，请稍后再试'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '操作失败，请稍后再试');
  return data;
}
function message(text, ok = false) {
  status.textContent = text;
  status.classList.toggle('ok', ok);
}
function inlineMessage(id, text, ok = false) {
  const node = $(id);
  if (!node) return;
  node.textContent = text;
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
function show(view) {
  $('login-form').hidden = view !== 'login';
  $('register-form').hidden = view !== 'register';
  $('reset-view').hidden = view !== 'reset';
  $('profile').hidden = view !== 'profile';
  $('auth-tabs').hidden = view === 'profile' || view === 'reset';
  $('login-tab').classList.toggle('active', view === 'login');
  $('register-tab').classList.toggle('active', view === 'register');
  $('page-title').textContent = view === 'profile' ? '个人资料' : view === 'register' ? '加入霧月乐园' : view === 'reset' ? '找回密码' : '欢迎回来';
  $('page-intro').textContent = view === 'profile' ? '在这里更新用户名、昵称、头像、邮箱和个人状态。' : view === 'register' ? '验证邮箱后创建一个属于你的账号。' : view === 'reset' ? '使用已验证邮箱收取验证码并重置密码。' : '登录后可以查看和修改你的个人资料。';
}
function drawProfile(user) {
  $('profile-avatar').src = user.avatar;
  $('reset-avatar').hidden = user.avatar === 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg';
  $('profile-nickname').textContent = user.nickname;
  $('profile-member-no').textContent = `No.${user.memberNo}`;
  $('profile-member-no').classList.toggle('founder', user.memberNo <= 10);
  $('profile-member-no').title = `第 ${user.memberNo} 位注册用户`;
  $('profile-username').textContent = `@${user.username}`;
  $('profile-role').textContent = user.role === 'admin' ? '管理员' : '普通用户';
  $('public-profile-link').href = `/profile/?user=${encodeURIComponent(user.username)}`;
  $('nickname').value = user.nickname;
  if ($('username')) $('username').value = user.username;
}
async function loadSocial() {
  if (!auth.authenticated) return;
  try {
    const data = await request('/api/social/me');
    $('status-message').value = data.statusMessage || '';
  } catch {}
}
async function loadEmail() {
  if (!auth.authenticated) return;
  try {
    const data = await request('/api/auth/email');
    $('email-address').value = data.email || '';
    $('email-state').textContent = data.verified ? '已验证' : '未绑定';
    $('email-state').classList.toggle('verified', !!data.verified);
    $('email-current').textContent = data.verified ? `当前邮箱：${data.email}` : '绑定邮箱后可以用邮箱验证码找回密码。';
    if (!data.mailConfigured) $('email-current').textContent += '（邮件服务还未配置）';
  } catch {}
}
async function load() {
  try {
    auth = await request('/api/auth/me');
    if (auth.authenticated) {
      drawProfile(auth.user);
      show('profile');
      await Promise.all([loadSocial(), loadEmail()]);
      return;
    }
    show(params.get('view') === 'register' ? 'register' : params.get('view') === 'reset' ? 'reset' : 'login');
    if (params.get('next') === 'profile') message('请先登录，再查看个人资料。');
  } catch (error) { show('login'); message(error.message); }
}
async function submit(form, route) {
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  message('');
  try {
    const data = Object.fromEntries(new FormData(form));
    auth = await request(route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    form.reset();
    drawProfile(auth.user);
    history.replaceState(null, '', '/account/profile');
    show('profile');
    await Promise.all([loadSocial(), loadEmail()]);
    message(route.endsWith('register') ? '注册成功，已登录。' : '登录成功。', true);
  } catch (error) { message(error.message); }
  finally { button.disabled = false; }
}
$('login-form').addEventListener('submit', event => { event.preventDefault(); submit(event.currentTarget, '/api/auth/login'); });

$('register-email-send').addEventListener('click', async () => {
  const button = $('register-email-send');
  const original = '发送邮箱验证码';
  const username = $('register-username').value.trim();
  const email = $('register-email').value.trim();
  if (!$('register-username').checkValidity()) {
    $('register-username').reportValidity();
    return;
  }
  if (!$('register-email').checkValidity()) {
    $('register-email').reportValidity();
    return;
  }

  let cooling = false;
  button.disabled = true;
  button.textContent = '发送中…';
  inlineMessage('register-email-status', '正在发送注册验证码…');
  message('正在发送注册验证码…');
  try {
    const data = await request('/api/auth/register/email/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, email })
    });
    const text = data.message || '注册验证码已发送。';
    inlineMessage('register-email-status', text, true);
    message(text, true);
    $('register-email-code').focus();
    cooling = true;
    startButtonCooldown(button, data.cooldownSeconds || 60, original);
  } catch (error) {
    inlineMessage('register-email-status', error.message);
    message(error.message);
  } finally {
    if (!cooling) {
      button.disabled = false;
      button.textContent = original;
    }
  }
});
$('register-email').addEventListener('input', () => inlineMessage('register-email-status', '邮箱改变后需要使用该邮箱收到的验证码。'));
$('register-form').addEventListener('submit', event => { event.preventDefault(); submit(event.currentTarget, '/api/auth/register'); });
$('forgot-password').addEventListener('click', () => { history.replaceState(null, '', '/account/?view=reset'); show('reset'); message(''); });
$('back-login').addEventListener('click', () => { history.replaceState(null, '', '/account/?view=login'); show('login'); message(''); });

$('reset-request-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  const original = '发送验证码';
  let cooling = false;
  button.disabled = true;
  button.textContent = '发送中…';
  inlineMessage('reset-action-status', '正在发送验证码…');
  try {
    const email = $('reset-email').value.trim();
    const data = await request('/api/auth/password-reset/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
    const text = data.message || '如果邮箱已绑定，验证码会发送到邮箱。';
    inlineMessage('reset-action-status', text, true);
    message(text, true);
    cooling = true;
    startButtonCooldown(button, data.cooldownSeconds || 60, original);
  } catch (error) {
    inlineMessage('reset-action-status', error.message);
    message(error.message);
  } finally {
    if (!cooling) {
      button.disabled = false;
      button.textContent = original;
    }
  }
});
$('reset-confirm-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  try {
    const data = await request('/api/auth/password-reset/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: $('reset-email').value.trim(), code: $('reset-code').value.trim(), password: $('reset-password').value }) });
    $('reset-request-form').reset(); $('reset-confirm-form').reset();
    show('login'); history.replaceState(null, '', '/account/?view=login');
    message(data.message || '密码已重置，请重新登录。', true);
  } catch (error) { message(error.message); }
  finally { button.disabled = false; }
});

$('email-request-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  const original = '发送验证码';
  let cooling = false;
  button.disabled = true;
  button.textContent = '发送中…';
  inlineMessage('email-action-status', '正在发送验证码…');
  message('正在发送验证码…');
  try {
    pendingEmail = $('email-address').value.trim();
    const data = await request('/api/auth/email/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: pendingEmail, password: $('email-password').value }) });
    $('email-code').focus();
    const text = data.message || '验证码已发送。';
    inlineMessage('email-action-status', text, true);
    message(text, true);
    cooling = true;
    startButtonCooldown(button, data.cooldownSeconds || 60, original);
  } catch (error) {
    pendingEmail = '';
    inlineMessage('email-action-status', error.message);
    message(error.message);
  } finally {
    if (!cooling) {
      button.disabled = false;
      button.textContent = original;
    }
  }
});
$('email-verify-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  try {
    const email = pendingEmail || $('email-address').value.trim();
    await request('/api/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code: $('email-code').value.trim() }) });
    $('email-password').value = ''; $('email-code').value = ''; pendingEmail = '';
    await loadEmail();
    inlineMessage('email-action-status', '邮箱绑定成功。', true);
    message('邮箱绑定成功。以后忘记密码可以通过这个邮箱找回。', true);
  } catch (error) { message(error.message); }
  finally { button.disabled = false; }
});

$('username-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  message('');
  inlineMessage('username-action-status', '正在验证并修改用户名…');
  try {
    const username = $('username').value.trim();
    const data = await request('/api/auth/username', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-csrf-token': auth.csrf },
      body: JSON.stringify({ username, password: $('username-password').value })
    });
    auth.user.username = data.username;
    $('username-password').value = '';
    drawProfile(auth.user);
    const text = data.message || '用户名已修改。';
    inlineMessage('username-action-status', text, true);
    message(text, true);
  } catch (error) {
    inlineMessage('username-action-status', error.message);
    message(error.message);
    if (error.message === '当前密码不正确') {
      $('username-password').select();
      $('username-password').focus();
    }
  }
  finally { button.disabled = false; }
});
$('status-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  try {
    const data = await request('/api/social/status', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ statusMessage: $('status-message').value }) });
    $('status-message').value = data.statusMessage;
    message('个人状态已保存。', true);
  } catch (error) { message(error.message); }
  finally { button.disabled = false; }
});
$('nickname-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  message('');
  try {
    const data = await request('/api/auth/me', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-csrf-token': auth.csrf }, body: JSON.stringify({ nickname: $('nickname').value }) });
    auth.user = data.user;
    drawProfile(auth.user);
    message('昵称已保存。', true);
  } catch (error) { message(error.message); }
  finally { button.disabled = false; }
});
const AVATAR_MAX_SIDE = 2048;
const AVATAR_MAX_BYTES = 1024 * 1024;

async function decodeAvatarImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('请选择图片文件。');
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { /* Safari / HEIC 等情况回退到 img 解码 */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('这张图片无法读取，请尝试换一张或先保存为 JPEG / PNG。'));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('头像处理失败，请换一张图片重试。')),
    'image/jpeg',
    quality
  ));
}

async function prepareAvatar(file) {
  const source = await decodeAvatarImage(file);
  try {
    const sourceWidth = source.width || source.naturalWidth;
    const sourceHeight = source.height || source.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new Error('无法识别图片尺寸。');

    let scale = Math.min(1, AVATAR_MAX_SIDE / Math.max(sourceWidth, sourceHeight));
    let width = Math.max(1, Math.round(sourceWidth * scale));
    let height = Math.max(1, Math.round(sourceHeight * scale));

    for (let resizePass = 0; resizePass < 4; resizePass++) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('当前浏览器无法处理头像图片。');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(source, 0, 0, width, height);

      for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58]) {
        const blob = await canvasToJpeg(canvas, quality);
        if (blob.size <= AVATAR_MAX_BYTES) {
          return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('头像处理失败，请重试。'));
            reader.readAsDataURL(blob);
          });
        }
      }

      width = Math.max(1, Math.round(width * 0.8));
      height = Math.max(1, Math.round(height * 0.8));
    }
    throw new Error('图片处理后仍然过大，请尝试换一张图片。');
  } finally {
    source.close?.();
  }
}

$('avatar-form').addEventListener('submit', async event => {
  event.preventDefault();
  const file = $('avatar-file').files[0];
  if (!file) return;
  if (!file.type?.startsWith('image/')) { message('请选择图片文件。'); return; }
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  message('正在处理头像…');
  try {
    const image = await prepareAvatar(file);
    const data = await request('/api/auth/avatar', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': auth.csrf }, body: JSON.stringify({ image }) });
    auth.user.avatar = data.avatar;
    drawProfile(auth.user);
    $('avatar-file').value = '';
    message('头像已更新。', true);
  } catch (error) { message(error.message); }
  finally { button.disabled = false; }
});
$('reset-avatar').addEventListener('click', async () => {
  const button = $('reset-avatar');
  button.disabled = true;
  message('');
  try {
    const data = await request('/api/auth/avatar', { method: 'DELETE', headers: { 'x-csrf-token': auth.csrf } });
    auth.user.avatar = data.avatar;
    drawProfile(auth.user);
    message('已恢复默认头像。', true);
  } catch (error) { message(error.message); }
  finally { button.disabled = false; }
});
$('logout').addEventListener('click', async () => {
  $('logout').disabled = true;
  message('');
  try {
    await request('/api/auth/logout', { method: 'POST', headers: { 'x-csrf-token': auth.csrf } });
    auth = { authenticated: false };
    history.replaceState(null, '', '/account/?view=login');
    show('login');
    message('已退出登录。', true);
  } catch (error) { message(error.message); }
  finally { $('logout').disabled = false; }
});
load();
