(function () {
  'use strict';

  const list = document.getElementById('osu-board-list');
  const meta = document.getElementById('osu-board-meta');
  const tabs = document.getElementById('board-tabs');
  const pageLabel = document.getElementById('board-page');
  const previousButton = document.getElementById('board-prev');
  const nextButton = document.getElementById('board-next');
  const submit = document.getElementById('submit-score');
  const submitStatus = document.getElementById('submit-status');
  if (!list || !meta || !tabs || !pageLabel) return;

  let board = null;
  let decorating = false;

  function activeDuration() {
    return Number(tabs.querySelector('button.active')?.dataset.duration || 10);
  }

  function currentPage() {
    const match = pageLabel.textContent.match(/第\s*(\d+)/);
    return match ? Number(match[1]) : 1;
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
      script.src = 'https://wuyue1337.github.io/wuyue-static/ability/leaderboard.js';
      script.defer = true;
      script.dataset.wuyueSharedLeaderboard = '1';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function decorate(force = false) {
    if (decorating) return;
    const rows = [...list.querySelectorAll('li:not(.board-empty)')];
    if (!force && rows.length && rows.every(row => row.classList.contains('wuyue-standardized'))) return;
    decorating = true;
    try {
      await ensureSharedLeaderboard();
      if (!board) {
        const create = window.WuyueLeaderboard?.create || window.createLeaderboard;
        board = create('osu-stream', list, meta, {
          previousButton,
          nextButton,
          pageLabel,
          bindPagination: false
        });
      }
      await board.load({ duration: activeDuration() }, currentPage());
    } catch (error) {
      console.warn('统一 osu 排行榜加载失败', error);
    } finally {
      decorating = false;
    }
  }

  const observer = new MutationObserver(() => {
    clearTimeout(observer.timer);
    observer.timer = setTimeout(() => decorate(false), 30);
  });
  observer.observe(list, { childList: true, subtree: true });
  tabs.addEventListener('click', () => setTimeout(() => decorate(true), 80));
  previousButton?.addEventListener('click', () => setTimeout(() => decorate(true), 80));
  nextButton?.addEventListener('click', () => setTimeout(() => decorate(true), 80));
  submit?.addEventListener('click', () => setTimeout(() => decorate(true), 500));
  setTimeout(() => decorate(true), 120);

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
