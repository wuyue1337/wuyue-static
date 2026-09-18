'use strict';

const STATIC_BASE = 'https://wuyue1337.github.io/wuyue-static';
const websites = [
  { id: 'acgbox', name: 'ACG盒子', description: '二次元网站导航', url: 'https://www.acgbox.link/', icon: `${STATIC_BASE}/site-icons/acgbox.png`, fallback: 'ACG' },
  { id: 'touhou', name: '東方联机', description: '可以多人联机的東方原作', url: 'https://touhou.vip/', icon: 'https://touhou.vip/favicon.ico', fallback: '東' },
  { id: 'acg123', name: '二刺螈导航', description: '动漫与二次元入口', url: 'https://www.acg123.co/', icon: `${STATIC_BASE}/site-icons/acg123.ico`, fallback: '二' },
  { id: 'lkssite', name: 'LKs网站推荐', description: '有趣网站合集', url: 'https://lkssite.vip/', icon: `${STATIC_BASE}/site-icons/lkssite.ico`, fallback: 'LKs' },
  { id: '2dfan', name: '2DFan', description: '视觉小说资料', url: 'https://2dfan.com/', icon: `${STATIC_BASE}/site-icons/2dfan.ico`, fallback: '2D' },
  { id: 'kungal', name: '鲲Galgame', description: 'Galgame 交流社区', url: 'https://www.kungal.com/', icon: `${STATIC_BASE}/site-icons/kungal.ico`, fallback: '鲲' },
  { id: 'vndb', name: 'vndb', description: '视觉小说数据库', url: 'https://vndb.org/', icon: `${STATIC_BASE}/site-icons/vndb.ico`, fallback: 'VN' },
  { id: 'cycani', name: '次元城动漫', description: '动漫与追番', url: 'https://www.cycani.org/', icon: `${STATIC_BASE}/site-icons/cycani.png`, fallback: '次' }
];

const intro = document.querySelector('.intro');
if (intro && !document.querySelector('.community-banner')) {
  const banner = document.createElement('section');
  banner.className = 'community-banner';
  banner.setAttribute('aria-label', '霧月乐园交流群');
  banner.innerHTML = `
    <div class="community-mark" aria-hidden="true">群</div>
    <div class="community-copy">
      <span class="community-kicker">霧月乐园交流群</span>
      <strong>QQ群：781919956</strong>
      <small>音游玩家为主，也欢迎来聊网站、小游戏和日常。</small>
    </div>
    <button class="community-copy-btn" type="button" data-copy-qq="781919956">复制群号</button>
  `;
  intro.appendChild(banner);

  const button = banner.querySelector('[data-copy-qq]');
  button?.addEventListener('click', async () => {
    const number = button.dataset.copyQq;
    try {
      await navigator.clipboard.writeText(number);
      button.textContent = '已复制 ✓';
    } catch (_) {
      const input = document.createElement('textarea');
      input.value = number;
      input.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      button.textContent = copied ? '已复制 ✓' : `群号 ${number}`;
    }
    setTimeout(() => { button.textContent = '复制群号'; }, 1800);
  });
}

const gameList = document.querySelector('#games .games');
const gameCoverLabels = new Map([
  ['/lol/', 'LOL猜英雄'],
  ['/guess/', '猜猜词'],
  ['/undercover/', '谁是卧底']
]);
for (const [href, label] of gameCoverLabels) {
  const card = gameList?.querySelector(`[href="${href}"]`);
  const cover = card?.querySelector('.cover');
  if (cover) {
    cover.textContent = label;
    cover.classList.add('cover-title');
  }
}
if (gameList && !gameList.querySelector('[href="/undercover/"]')) {
  const card = document.createElement('a');
  card.className = 'game';
  card.href = '/undercover/';
  card.innerHTML = '<span class="cover cover-title">谁是卧底</span><strong>谁是卧底</strong><p>谁是卧底 + 白板 + 迷雾身份 + 随机禁词。</p><span class="game-status-note">玩法改进中，可能会遇到 Bug</span><span class="play">进入游戏 ↗</span>';
  gameList.append(card);
}

const osuHomeIcon = '<span class="ability-icon ability-icon-osu" aria-hidden="true"><svg class="osu-mark" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="32" cy="32" r="20" fill="currentColor" opacity=".12"/><text x="32" y="38" text-anchor="middle" fill="currentColor" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="800" font-style="italic">osu!</text></svg></span>';
const maniaHomeIcon = '<span class="ability-icon ability-icon-mania" aria-hidden="true"><svg class="mania-mark" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" stroke-width="3"/><g fill="currentColor" opacity=".92"><rect x="16" y="15" width="6" height="29" rx="2"/><rect x="25" y="15" width="6" height="29" rx="2"/><rect x="34" y="15" width="6" height="29" rx="2"/><rect x="43" y="15" width="6" height="29" rx="2"/></g><g fill="#1f2340"><rect x="16" y="35" width="6" height="9" rx="1.5"/><rect x="25" y="32" width="6" height="12" rx="1.5"/><rect x="34" y="35" width="6" height="9" rx="1.5"/><rect x="43" y="32" width="6" height="12" rx="1.5"/></g><path d="M15 48h34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></span>';

const abilityList = document.querySelector('.abilities');
let osuCard = abilityList?.querySelector('[href="/ability/osu-stream/"]');
if (abilityList && !osuCard) {
  osuCard = document.createElement('a');
  osuCard.className = 'ability-card';
  osuCard.href = '/ability/osu-stream/';
  osuCard.innerHTML = `${osuHomeIcon}<span class="ability-copy"><strong>osu! 手速测试</strong><small>双键连打，测试 Stream BPM 与稳定度</small><em>开始测试 ↗</em></span>`;
  abilityList.append(osuCard);
} else if (osuCard) {
  osuCard.querySelector('.ability-icon')?.replaceWith(document.createRange().createContextualFragment(osuHomeIcon));
}

let maniaCard = abilityList?.querySelector('[href="/ability/rhythm-power/"]');
if (abilityList && !maniaCard) {
  maniaCard = document.createElement('a');
  maniaCard.className = 'ability-card';
  maniaCard.href = '/ability/rhythm-power/';
  maniaCard.innerHTML = `${maniaHomeIcon}<span class="ability-copy"><strong>音游底力测试</strong><small>DFJK 渐进加压，测试键型处理与耐力</small><em>开始测试 ↗</em></span>`;
  abilityList.append(maniaCard);
} else if (maniaCard) {
  maniaCard.querySelector('.ability-icon')?.replaceWith(document.createRange().createContextualFragment(maniaHomeIcon));
}

const list = document.getElementById('links');
if (list) for (const site of websites) {
  const link = document.createElement('a');
  link.className = 'link';
  link.href = site.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  const badge = document.createElement('span');
  badge.className = 'icon';
  badge.dataset.site = site.id;
  const image = document.createElement('img');
  image.src = site.icon;
  image.alt = '';
  image.loading = 'lazy';
  image.addEventListener('error', () => { badge.textContent = site.fallback; });
  badge.append(image);

  const label = document.createElement('span');
  label.textContent = site.name;
  const description = document.createElement('small');
  description.textContent = site.description;
  label.append(description);
  link.append(badge, label);
  list.append(link);
}

const footer = document.querySelector('footer');
if (footer && !footer.querySelector('.ai-assisted-badge')) {
  if (!document.getElementById('ai-assisted-style')) {
    const style = document.createElement('style');
    style.id = 'ai-assisted-style';
    style.textContent = `
      .ai-assisted-badge{display:inline-flex;align-items:center;gap:7px;margin-left:14px;padding:5px 10px;border:1px solid rgba(184,156,255,.26);border-radius:999px;background:linear-gradient(180deg,rgba(137,92,255,.14),rgba(89,72,150,.10));color:#d9ccff;font-size:12px;font-weight:700;letter-spacing:.2px;vertical-align:middle;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 0 14px rgba(120,90,255,.10);cursor:default;backdrop-filter:blur(6px);transition:border-color .18s ease,background .18s ease,box-shadow .18s ease,color .18s ease}
      .ai-assisted-badge::before{content:'✦';color:#b89cff;font-size:11px;line-height:1;text-shadow:0 0 9px rgba(184,156,255,.48)}
      .ai-assisted-badge small{font-size:11px;font-weight:500;color:#9fa7c9}
      .ai-assisted-badge:hover{border-color:rgba(201,183,255,.42);background:linear-gradient(180deg,rgba(154,116,255,.20),rgba(100,82,168,.14));color:#eee8ff;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 0 18px rgba(132,96,255,.18)}
      .ai-assisted-badge:hover small{color:#b7bddb}
      @media(max-width:650px){.ai-assisted-badge{margin:8px 0 0;display:inline-flex}}
    `;
    document.head.appendChild(style);
  }

  const aiBadge = document.createElement('span');
  aiBadge.className = 'ai-assisted-badge';
  aiBadge.title = '本站部分设计与代码由 AI 辅助完成，并由站长人工维护';
  aiBadge.innerHTML = '<span>AI-assisted</span><small>· 人工维护</small>';
  footer.querySelector('#visit-stats')?.before(aiBadge);
}
