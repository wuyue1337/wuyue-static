'use strict';

const STATIC_BASE = 'https://wuyue1337.github.io/wuyue-static';
const websites = [
  { id: 'acgbox', name: 'ACG盒子', description: '二次元网站导航', url: 'https://www.acgbox.link/', icon: `${STATIC_BASE}/site-icons/acgbox.png`, fallback: 'ACG' },
  { id: 'allcc', name: '樱之空导航', description: 'ACG资源导航', url: 'https://www.allcc.cc/', icon: `${STATIC_BASE}/site-icons/allcc.png`, fallback: '樱' },
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
const guessCard = gameList?.querySelector('[href="/guess/"]');
if (guessCard) {
  const title = guessCard.querySelector('strong');
  if (title) title.textContent = '猜猜词';
}
if (gameList && !gameList.querySelector('[href="/undercover/"]')) {
  const card = document.createElement('a');
  card.className = 'game';
  card.href = '/undercover/';
  card.innerHTML = '<span class="cover">卧</span><strong>谁是卧底</strong><p>谁是卧底 + 白板 + 迷雾身份 + 随机禁词。</p><span class="play">进入游戏 ↗</span>';
  gameList.append(card);
}

const abilityList = document.querySelector('.abilities');
if (abilityList && !abilityList.querySelector('[href="/ability/osu-stream/"]')) {
  const card = document.createElement('a');
  card.className = 'ability-card';
  card.href = '/ability/osu-stream/';
  card.innerHTML = '<span class="ability-icon" aria-hidden="true"><strong style="font-size:18px;letter-spacing:2px">ZX</strong></span><span class="ability-copy"><strong>osu! 手速测试</strong><small>双键连打，测试 Stream BPM 与稳定度</small><em>开始测试 ↗</em></span>';
  abilityList.append(card);
}
if (abilityList && !abilityList.querySelector('[href="/ability/rhythm-power/"]')) {
  const card = document.createElement('a');
  card.className = 'ability-card';
  card.href = '/ability/rhythm-power/';
  card.innerHTML = '<span class="ability-icon" aria-hidden="true">4K</span><span class="ability-copy"><strong>音游底力测试</strong><small>DFJK 渐进加压，测试键型处理与耐力</small><em>开始测试 ↗</em></span>';
  abilityList.append(card);
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
