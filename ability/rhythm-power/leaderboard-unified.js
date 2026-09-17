(() => {
  'use strict';

  const list = document.getElementById('power-board-list');
  const status = document.getElementById('board-status');
  const keyRow = document.getElementById('key-count-row');
  const durationRow = document.getElementById('duration-row');
  const submit = document.getElementById('submit-score');
  if (!list || !status || !keyRow || !durationRow) return;

  let board = null;
  let decorating = false;

  const selectedKeys = () => Number(keyRow.querySelector('[data-keys].active')?.dataset.keys || 4);
  const selectedDuration = () => Number(durationRow.querySelector('[data-duration].active')?.dataset.duration || 20);

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
        board = create('rhythm-power', list, status, {
          bindPagination: false,
          emptyText: '还没有成绩，来拿第一个名次吧。',
          emptyMeta: '共 0 位上榜'
        });
      }
      await board.load({ duration: selectedDuration(), keys: selectedKeys() }, 1);
    } catch (error) {
      console.warn('统一音游底力排行榜加载失败', error);
    } finally {
      decorating = false;
    }
  }

  const observer = new MutationObserver(() => {
    clearTimeout(observer.timer);
    observer.timer = setTimeout(() => decorate(false), 30);
  });
  observer.observe(list, { childList: true, subtree: true });
  keyRow.addEventListener('click', () => setTimeout(() => decorate(true), 80));
  durationRow.addEventListener('click', () => setTimeout(() => decorate(true), 80));
  submit?.addEventListener('click', () => setTimeout(() => decorate(true), 500));
  setTimeout(() => decorate(true), 120);
})();
