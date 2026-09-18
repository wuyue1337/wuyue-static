(() => {
  'use strict';

  const list = document.getElementById('power-board-list');
  const status = document.getElementById('board-status');
  const keyRow = document.getElementById('key-count-row');
  const durationRow = document.getElementById('duration-row');
  if (!list || !status || !keyRow || !durationRow) return;

  let boardPromise = null;

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
      script.src = 'https://wuyue1337.github.io/wuyue-static/ability/leaderboard.js?v=20260918-2';
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
      return create('rhythm-power', list, status, {
        bindPagination: false,
        emptyText: '还没有成绩，来拿第一个名次吧。',
        emptyMeta: '共 0 位上榜'
      });
    });
    return boardPromise;
  }

  async function refresh() {
    try {
      const board = await getBoard();
      await board.load({ duration: selectedDuration(), keys: selectedKeys() }, 1);
    } catch (error) {
      console.warn('统一音游底力排行榜加载失败', error);
    }
  }

  window.addEventListener('wuyue:rhythm-power-leaderboard-refresh', refresh);
  refresh();
})();
