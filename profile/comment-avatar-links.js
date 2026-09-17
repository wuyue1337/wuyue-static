(() => {
  'use strict';
  const style = document.createElement('style');
  style.textContent = '.comment-avatar[data-profile-click],.hot-comment-avatar[data-profile-click]{cursor:pointer;transition:transform .15s ease}.comment-avatar[data-profile-click]:hover,.hot-comment-avatar[data-profile-click]:hover{transform:scale(1.06)}';
  document.head.appendChild(style);

  function refresh() {
    document.querySelectorAll('.comment-item,.reply-item').forEach(item => {
      const avatar = item.querySelector(':scope > .comment-avatar');
      const link = item.querySelector('.comment-username[href]');
      if (avatar && link) {
        avatar.dataset.profileClick = '1';
        avatar.title = '查看个人主页';
      }
    });
    document.querySelectorAll('.hot-comment').forEach(item => {
      const avatar = item.querySelector('.hot-comment-avatar');
      const link = item.querySelector('.hot-comment-name[href]');
      if (avatar && link) {
        avatar.dataset.profileClick = '1';
        avatar.title = '查看个人主页';
      }
    });
  }

  document.addEventListener('click', event => {
    const avatar = event.target.closest('.comment-avatar[data-profile-click],.hot-comment-avatar[data-profile-click]');
    if (!avatar) return;
    const container = avatar.closest('.comment-item,.reply-item,.hot-comment');
    const link = container?.querySelector('.comment-username[href],.hot-comment-name[href]');
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    location.href = link.href;
  }, true);

  new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true });
  refresh();
})();
