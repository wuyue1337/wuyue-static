(function () {
  'use strict';

  const list = document.getElementById('osu-board-list');
  const meta = document.getElementById('osu-board-meta');
  const pageLabel = document.getElementById('board-page');
  const previousButton = document.getElementById('board-prev');
  const nextButton = document.getElementById('board-next');
  const title = document.getElementById('osu-board-title');
  const contextLabel = document.getElementById('osu-board-context');
  const submit = document.getElementById('submit-score');
  const submitStatus = document.getElementById('submit-status');
  if (!list || !meta || !pageLabel) return;

  let boardPromise = null;
  let currentDuration = 10;
  let currentRanked = true;

  function readTestContext() {
    const active = document.querySelector('#duration-row [data-seconds].active');
    if (!active) return { duration: 10, ranked: true };
    if (active.dataset.seconds === 'custom') {
      const input = document.getElementById('custom-time');
      return {
        duration: Math.max(3, Math.min(120, Math.round(Number(input?.value) || 15))),
        ranked: false
      };
    }
    const duration = Number(active.dataset.seconds) || 10;
    return { duration, ranked: [10, 20, 30].includes(duration) };
  }

  function currentPage() {
    const match = pageLabel.textContent.match(/第\s*(\d+)/);
    return match ? Number(match[1]) : 1;
  }

  function syncHeading() {
    if (currentRanked) {
      if (title) title.textContent = `osu! Stream 排行榜 · ${currentDuration} 秒`;
      if (contextLabel) contextLabel.textContent = `当前：${currentDuration} 秒`;
    } else {
      if (title) title.textContent = 'osu! Stream 排行榜';
      if (contextLabel) contextLabel.textContent = `自定义 ${currentDuration} 秒 · 不参与排行`;
    }
  }

  function renderUnrankedState() {
    const overview = list.previousElementSibling;
    if (overview?.classList.contains('wuyue-board-overview')) overview.hidden = true;
    list.replaceChildren();
    const item = document.createElement('li');
    item.className = 'board-empty';
    item.textContent = '自定义时长仅用于测试，不设置排行榜。请选择上方 10 / 20 / 30 秒查看对应排行榜。';
    list.appendChild(item);
    meta.textContent = '';
    pageLabel.textContent = '第 1 / 1 页';
    if (previousButton) previousButton.disabled = true;
    if (nextButton) nextButton.disabled = true;
  }

  function ensureSharedLeaderboard() {
    if (window.WuyueLeaderboard?.create || window.createLeaderboard) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-wuyue-shared-leaderboard]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://wuyue1337.github.io/wuyue-static/ability/leaderboard.js?v=20260919-1';
      script.defer = true;
      script.dataset.wuyueSharedLeaderboard = '1';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function getBoard() {
    if (!boardPromise) boardPromise = ensureSharedLeaderboard().then(() => {
      const create = window.WuyueLeaderboard?.create || window.createLeaderboard;
      return create('osu-stream', list, meta, { previousButton, nextButton, pageLabel });
    });
    return boardPromise;
  }

  async function refresh(page = 1) {
    if (!currentRanked) {
      renderUnrankedState();
      return;
    }
    try {
      const board = await getBoard();
      const overview = list.previousElementSibling;
      if (overview?.classList.contains('wuyue-board-overview')) overview.hidden = false;
      await board.load({ duration: currentDuration }, page);
    } catch (error) {
      console.warn('统一 osu 排行榜加载失败', error);
    }
  }

  window.addEventListener('wuyue:osu-duration-change', event => {
    const duration = Number(event.detail?.duration);
    if (!Number.isSafeInteger(duration) || duration < 3 || duration > 120) return;
    const ranked = event.detail?.ranked === true && [10, 20, 30].includes(Number(event.detail?.leaderboardDuration));
    if (duration === currentDuration && ranked === currentRanked) return;
    currentDuration = duration;
    currentRanked = ranked;
    syncHeading();
    refresh(1);
  });

  window.addEventListener('wuyue:osu-leaderboard-refresh', event => {
    const duration = Number(event.detail?.duration);
    if (duration && duration !== currentDuration) return;
    refresh(Number(event.detail?.page) || currentPage());
  });

  {
    const initial = readTestContext();
    currentDuration = initial.duration;
    currentRanked = initial.ranked;
  }
  syncHeading();
  refresh(1);

  let authLoader = null;
  let bypassAuth = false;
  async function ensureScoreAuth() {
    if (window.WuyueScoreAuth) return window.WuyueScoreAuth;
    if (!authLoader) authLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://wuyue1337.github.io/wuyue-static/ability/score-auth.js';
      script.dataset.scoreAuthLoader = '1';
      script.onload = () => resolve(window.WuyueScoreAuth);
      script.onerror = () => reject(new Error('账号组件加载失败，请刷新页面重试'));
      document.head.appendChild(script);
    });
    return authLoader;
  }

  submit?.addEventListener('click', async event => {
    if (bypassAuth || submit.disabled) return;
    let me = null;
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data.authenticated) me = data.user;
    } catch {}
    if (me) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const auth = await ensureScoreAuth();
      await auth.ensureAccount();
      bypassAuth = true;
      submit.click();
      bypassAuth = false;
    } catch (error) {
      bypassAuth = false;
      if (submitStatus) submitStatus.textContent = error.message;
    }
  }, true);
})();