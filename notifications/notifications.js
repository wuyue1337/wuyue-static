'use strict';

const list = document.getElementById('list');
const status = document.getElementById('status');
const readAll = document.getElementById('read-all');
let markingRead = false;

function timeText(value) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

async function markVisibleAsRead() {
  if (markingRead) return;
  markingRead = true;
  try {
    const response = await fetch('/api/social/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (!response.ok) return;
    document.querySelectorAll('.item.unread').forEach(item => item.classList.remove('unread'));
    window.dispatchEvent(new Event('wuyue:notifications-read'));
  } catch {}
  finally { markingRead = false; }
}

async function load() {
  try {
    const response = await fetch('/api/social/notifications', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '加载失败');
    list.replaceChildren();
    if (!data.notifications.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '暂时没有通知。';
      list.append(empty);
      return;
    }
    for (const item of data.notifications) {
      const row = document.createElement(item.url ? 'a' : 'div');
      row.className = `item${item.read ? '' : ' unread'}`;
      if (item.url) row.href = item.url;
      const img = document.createElement('img');
      img.src = item.from?.avatar || '/default-avatar.jpg';
      img.alt = '';
      img.addEventListener('error', () => { img.src = '/default-avatar.jpg'; }, { once: true });
      const copy = document.createElement('div');
      copy.className = 'copy';
      const strong = document.createElement('strong');
      strong.textContent = item.text;
      const small = document.createElement('small');
      small.textContent = timeText(item.time);
      copy.append(strong, small);
      row.append(img, copy);
      list.append(row);
    }
    if (Number(data.unread || 0) > 0) await markVisibleAsRead();
  } catch (error) {
    list.innerHTML = '<div class="empty">通知暂时无法加载。</div>';
    status.textContent = error.message;
  }
}

readAll.addEventListener('click', async () => {
  readAll.disabled = true;
  try {
    const response = await fetch('/api/social/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '操作失败');
    document.querySelectorAll('.item.unread').forEach(item => item.classList.remove('unread'));
    window.dispatchEvent(new Event('wuyue:notifications-read'));
    status.textContent = '已全部标记为已读。';
  } catch (error) { status.textContent = error.message; }
  finally { readAll.disabled = false; }
});

load();
