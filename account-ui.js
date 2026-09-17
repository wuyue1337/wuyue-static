'use strict';

function ensureSocialStyles() {
  if (document.getElementById('wuyue-social-styles')) return;
  const style = document.createElement('style');
  style.id = 'wuyue-social-styles';
  style.textContent = `
    .notification-link{position:relative;display:inline-grid;place-items:center;min-width:34px;height:34px;margin-right:8px;border:1px solid #8b7dcf55;border-radius:10px;background:#ffffff12;color:#efeaff;text-decoration:none}
    .notification-link:hover{background:#ffffff1d;border-color:#a695e877}
    .settings-link{font-size:15px}
    .notification-badge{position:absolute;right:-5px;top:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#d96d9e;color:white;font-size:10px;line-height:18px;text-align:center;font-weight:800}
    .community-activity{margin-top:34px}
    .community-activity .sectionhead{margin-bottom:14px}
    .community-activity-shell{padding:14px;border:1px solid #8175bf45;border-radius:18px;background:linear-gradient(145deg,#171a31e8,#1d1d3ae8);box-shadow:0 14px 34px #07091d28}
    .community-activity-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .community-activity-item{display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:66px;padding:10px 12px;border:1px solid #8d82c62e;border-radius:13px;background:#22243dcc;color:#eef0ff;text-decoration:none;transition:background .16s ease,border-color .16s ease,transform .16s ease}
    .community-activity-item:hover{background:#2a2d4be6;border-color:#a593e85e;transform:translateY(-1px)}
    .community-activity-item img{width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid #ffffff24;background:#343650}
    .community-activity-copy{min-width:0;overflow:hidden}
    .community-activity-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f4f2ff;font-size:13px}
    .community-activity-copy span{display:block;overflow:hidden;margin-top:3px;color:#a8aec8;font-size:11px;line-height:1.45;text-overflow:ellipsis;white-space:nowrap}
    .community-activity-item time{align-self:start;margin-top:2px;color:#777f9c;font-size:10px;white-space:nowrap}
    .community-activity-empty{grid-column:1/-1;padding:22px;border:1px dashed #8b82b641;border-radius:13px;color:#9299b5;font-size:12px;text-align:center}
    @media(max-width:760px){.community-activity-list{grid-template-columns:1fr}.community-activity-shell{padding:10px}.community-activity-item{min-height:62px}.community-activity-item time{display:none}}
  `;
  document.head.appendChild(style);
}

function relativeTime(value) {
  const diff = Date.now() - Number(value || 0);
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return new Date(value).toLocaleDateString('zh-CN');
}

async function loadActivity() {
  try { if (localStorage.getItem('wuyue-show-community-activity') === '0') return; } catch {}
  const abilities = document.getElementById('abilities');
  if (!abilities || document.getElementById('community-activity')) return;
  const section = document.createElement('section');
  section.id = 'community-activity';
  section.className = 'community-activity';
  section.innerHTML = '<div class="sectionhead"><h2>最近动态</h2><span class="muted">最近 6 条</span></div><div class="community-activity-shell"><div class="community-activity-list"><div class="community-activity-empty">正在加载动态…</div></div></div>';
  abilities.after(section);
  try {
    const response = await fetch('/api/social/activity', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error();
    const list = section.querySelector('.community-activity-list');
    list.replaceChildren();
    if (!data.activity.length) {
      const empty = document.createElement('div'); empty.className = 'community-activity-empty'; empty.textContent = '暂时还没有公开动态。'; list.append(empty); return;
    }
    for (const item of data.activity.slice(0, 6)) {
      const row = document.createElement('a');
      row.className = 'community-activity-item';
      row.href = item.url || `/profile/?user=${encodeURIComponent(item.user.username)}`;
      const img = document.createElement('img'); img.src = item.user.avatar || 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg'; img.alt = ''; img.loading = 'lazy';
      const copy = document.createElement('div'); copy.className = 'community-activity-copy';
      const strong = document.createElement('strong'); strong.textContent = item.user.nickname;
      const text = document.createElement('span'); text.textContent = item.text;
      const time = document.createElement('time'); time.textContent = relativeTime(item.time);
      copy.append(strong, text); row.append(img, copy, time); list.append(row);
    }
  } catch {
    section.querySelector('.community-activity-list').innerHTML = '<div class="community-activity-empty">动态暂时无法加载。</div>';
  }
}

function setNotificationBadge(bell, unread) {
  bell.querySelector('.notification-badge')?.remove();
  if (unread <= 0) return;
  const badge = document.createElement('span');
  badge.className = 'notification-badge';
  badge.textContent = unread > 99 ? '99+' : String(unread);
  bell.append(badge);
}

async function refreshNotificationBadge(bell) {
  try {
    const notices = await fetch('/api/social/notifications', { cache: 'no-store' }).then(r => r.json());
    setNotificationBadge(bell, Number(notices.unread || 0));
  } catch {}
}

(async () => {
  ensureSocialStyles();
  loadActivity();
  const target = document.getElementById('account-nav');
  if (!target) return;
  try {
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    if (!data.authenticated) return;

    let unread = 0;
    try {
      const notices = await fetch('/api/social/notifications', { cache: 'no-store' }).then(r => r.json());
      unread = Number(notices.unread || 0);
    } catch {}

    const bell = document.createElement('a');
    bell.className = 'notification-link';
    bell.href = '/notifications/';
    bell.title = '通知中心';
    bell.textContent = '🔔';
    setNotificationBadge(bell, unread);

    const settings = document.createElement('a');
    settings.className = 'notification-link settings-link';
    settings.href = '/account/settings.html';
    settings.title = '账号设置';
    settings.textContent = '⚙';

    const link = document.createElement('a');
    link.className = 'account-link';
    link.href = `/profile/?user=${encodeURIComponent(data.user.username)}`;
    link.title = '进入个人资料';
    const avatar = document.createElement('img');
    avatar.src = data.user.avatar;
    avatar.alt = '';
    const name = document.createElement('span');
    name.textContent = data.user.nickname;
    const number = document.createElement('small');
    number.className = `account-member-no${data.user.memberNo <= 100 ? ' founder' : ''}`;
    number.textContent = `No.${data.user.memberNo}`;
    number.title = `第 ${data.user.memberNo} 位注册用户`;
    link.append(avatar, name, number);
    target.replaceChildren(bell, settings, link);

    const refresh = () => refreshNotificationBadge(bell);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    window.addEventListener('wuyue:notifications-read', refresh);
  } catch { /* 页面仍可正常浏览 */ }
})();
