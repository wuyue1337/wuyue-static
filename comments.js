'use strict';

const commentForm = document.getElementById('comment-form');
const commentList = document.getElementById('comment-list');
const commentStatus = document.getElementById('comment-status');
const commentCount = document.getElementById('comment-count');
const hotComments = document.getElementById('hot-comments');
let selectedHotCommentId = null;
const avatarPath = 'https://wuyue1337.github.io/wuyue-static/default-avatar.jpg';
let currentAuth = null;
let currentAccount = null;
let currentMod = { canModerate: false };
let currentPage = 1;
let totalPages = 1;
const icons = {
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 5-8a2 2 0 0 1 2 2v5h5a3 3 0 0 1 2.9 3.8l-2 7A3 3 0 0 1 17 22H7"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14V3H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3Zm0 0 5 8a2 2 0 0 0 2-2v-5h5a3 3 0 0 0 2.9-3.8l-2-7A3 3 0 0 0 17 2H7"/></svg>'
};

async function request(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '操作失败，请稍后再试');
  return data;
}

function avatar(small = false, src = avatarPath) {
  const image = document.createElement('img');
  image.className = `comment-avatar${small ? ' small' : ''}`;
  image.src = src;
  image.alt = '';
  image.loading = 'lazy';
  image.addEventListener('error', () => { image.src = avatarPath; }, { once: true });
  return image;
}

function profileHref(memberNo) {
  return Number.isSafeInteger(memberNo) && memberNo > 0 ? `/account/user.html?no=${memberNo}` : null;
}

function memberBadge(number) {
  if (!Number.isSafeInteger(number) || number < 1) return null;
  const badge = document.createElement('span');
  badge.className = 'member-no';
  if (number <= 100) badge.dataset.tier = 'founder';
  badge.textContent = `No.${number}`;
  badge.title = `第 ${number} 位注册用户`;
  badge.setAttribute('aria-label', `注册序号 ${number}`);
  return badge;
}

function roleBadge(role) {
  if (role !== 'founder' && role !== 'admin') return null;
  const badge = document.createElement('span');
  badge.className = `comment-role ${role === 'founder' ? 'comment-role-owner' : 'comment-role-staff'}`;
  badge.textContent = role === 'founder' ? 'OWNER' : 'STAFF';
  badge.title = role === 'founder' ? '站长' : '管理员';
  return badge;
}

function profileName(item, className) {
  const href = profileHref(item.memberNo);
  const el = document.createElement(href ? 'a' : 'strong');
  el.className = className;
  el.textContent = item.name;
  if (href) el.href = href;
  return el;
}

function ensurePager() {
  let pager = document.getElementById('comment-pagination');
  if (pager) return pager;
  pager = document.createElement('nav');
  pager.id = 'comment-pagination';
  pager.className = 'comment-pagination';
  pager.setAttribute('aria-label', '留言分页');
  pager.innerHTML = '<button type="button" data-page-action="prev">上一页</button><span id="comment-page-label">第 1 / 1 页</span><button type="button" data-page-action="next">下一页</button>';
  commentList.after(pager);
  pager.addEventListener('click', event => {
    const button = event.target.closest('button[data-page-action]');
    if (!button || button.disabled) return;
    const next = button.dataset.pageAction === 'prev' ? currentPage - 1 : currentPage + 1;
    loadComments(next, true);
  });
  return pager;
}

function updatePager() {
  const pager = ensurePager();
  pager.hidden = totalPages <= 1;
  const label = document.getElementById('comment-page-label');
  if (label) label.textContent = `第 ${currentPage} / ${totalPages} 页`;
  const prev = pager.querySelector('[data-page-action="prev"]');
  const next = pager.querySelector('[data-page-action="next"]');
  prev.disabled = currentPage <= 1;
  next.disabled = currentPage >= totalPages;
}

function openReplyForm(target, rootArticle) {
  if (!currentAccount) {
    commentStatus.textContent = '请先登录后回复。';
    document.getElementById('comment-login-link')?.focus();
    return;
  }
  const existing = document.querySelector('.reply-form');
  if (existing?.dataset.targetId === target.id) { existing.remove(); return; }
  existing?.remove();

  const form = document.createElement('form');
  form.className = 'reply-form';
  form.dataset.targetId = target.id;
  form.append(avatar(true, currentAccount.avatar));
  const fields = document.createElement('div');
  fields.className = 'composer-fields';
  const name = document.createElement('input');
  name.name = 'nickname'; name.type = 'text'; name.maxLength = 40; name.value = currentAccount.nickname; name.readOnly = true;
  name.setAttribute('aria-label', '你的昵称');
  const message = document.createElement('textarea');
  message.name = 'message'; message.required = true; message.maxLength = 5000; message.rows = 2;
  message.placeholder = `回复 @${target.name}…`; message.setAttribute('aria-label', `回复 ${target.name}`);
  const actions = document.createElement('div'); actions.className = 'comment-actions';
  const status = document.createElement('span'); status.className = 'reply-status'; status.setAttribute('role', 'status');
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'reply-cancel'; cancel.textContent = '取消';
  cancel.addEventListener('click', () => form.remove());
  const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = '发布回复';
  actions.append(status, cancel, submit); fields.append(name, message, actions); form.append(fields);
  form.addEventListener('submit', async event => {
    event.preventDefault(); submit.disabled = true; status.textContent = '正在发布…';
    try {
      await request('/api/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.value, message: message.value, parentId: target.id })
      });
      await loadComments(currentPage);
      commentStatus.textContent = '回复已发布。';
    } catch (error) { status.textContent = error.message; submit.disabled = false; }
  });
  rootArticle.querySelector('.comment-content').append(form);
  message.focus();
}

function reactionButton(item, kind) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'reaction';
  button.setAttribute('aria-label', `${kind === 'up' ? '点赞' : '倒赞'}，目前 ${kind === 'up' ? item.likes : item.dislikes} 票`);
  button.setAttribute('aria-pressed', String(item.myVote === kind)); button.innerHTML = icons[kind];
  const count = document.createElement('span'); count.textContent = String(kind === 'up' ? item.likes : item.dislikes); button.append(count);
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await request(`/api/comments/${encodeURIComponent(item.id)}/vote`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: item.myVote === kind ? null : kind })
      });
      await loadComments(currentPage);
    } catch (error) { commentStatus.textContent = error.message; button.disabled = false; }
  });
  return button;
}

function moderationDeleteButton(item) {
  if (!currentMod?.canModerate || !currentAuth?.csrf) return null;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'comment-mod-delete';
  button.textContent = '删除';
  button.title = '以站长/管理员身份删除这条留言';
  button.addEventListener('click', async () => {
    if (!confirm('确定删除这条留言吗？如果是主留言，它下面的回复也会一起删除。')) return;
    button.disabled = true;
    try {
      const data = await request(`/api/mod/comments/${encodeURIComponent(item.id)}`, {
        method: 'DELETE', headers: { 'x-csrf-token': currentAuth.csrf }
      });
      selectedHotCommentId = null;
      commentStatus.textContent = data.removed > 1 ? `已删除这条留言及 ${data.removed - 1} 条回复。` : '留言已删除。';
      await loadComments(currentPage);
    } catch (error) {
      commentStatus.textContent = error.message;
      button.disabled = false;
    }
  });
  return button;
}

function renderComment(item, rootArticle, isReply = false) {
  const article = document.createElement('article'); article.className = isReply ? 'reply-item' : 'comment-item';
  if (!isReply) article.id = `comment-${item.id}`;
  article.append(avatar(isReply, item.avatar || avatarPath));
  const content = document.createElement('div'); content.className = 'comment-content';
  content.append(profileName(item, 'comment-username'));
  const role = roleBadge(item.role); if (role) content.append(role);
  const number = memberBadge(item.memberNo); if (number) content.append(number);
  if (isReply && item.replyTo) {
    const target = document.createElement('span'); target.className = 'reply-target'; target.textContent = `回复 @${item.replyTo}`; content.append(target);
  }
  const message = document.createElement('p'); message.className = 'comment-message'; message.textContent = item.message;
  const meta = document.createElement('div'); meta.className = 'comment-meta';
  const time = document.createElement('time'); time.dateTime = item.time; time.textContent = new Date(item.time).toLocaleString('zh-CN');
  const province = document.createElement('span'); province.className = 'comment-province'; province.textContent = `IP属地：${item.province || '未知'}`;
  const reply = document.createElement('button'); reply.type = 'button'; reply.className = 'reply-trigger'; reply.textContent = '回复';
  reply.addEventListener('click', () => openReplyForm(item, isReply ? rootArticle : article));
  meta.append(time, province, reactionButton(item, 'up'), reactionButton(item, 'down'), reply);
  const del = moderationDeleteButton(item); if (del) meta.append(del);
  content.append(message, meta);
  if (!isReply && item.replies?.length) {
    const replies = document.createElement('div'); replies.className = 'comment-replies';
    for (const child of item.replies) replies.append(renderComment(child, article, true));
    content.append(replies);
  }
  article.append(content); return article;
}

async function showHotComment(id) {
  let article = document.getElementById(`comment-${id}`);
  if (!article) {
    try {
      const data = await request(`/api/comments/${encodeURIComponent(id)}`);
      article = renderComment(data.comment); commentList.querySelector('.comment-empty')?.remove(); commentList.prepend(article);
    } catch (error) { commentStatus.textContent = error.message; return; }
  }
  selectedHotCommentId = id; article.scrollIntoView({ behavior: 'smooth', block: 'center' }); article.classList.add('comment-spotlight');
  setTimeout(() => article.classList.remove('comment-spotlight'), 2400);
}

async function loadHotComments() {
  try {
    const data = await request('/api/comments/hot'); hotComments.replaceChildren();
    if (!data.comments.length) {
      const empty = document.createElement('p'); empty.className = 'hot-empty'; empty.textContent = '还没有留言，期待第一条。'; hotComments.append(empty); return;
    }
    data.comments.forEach((item, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'hot-comment';
      button.setAttribute('aria-label', `查看${item.name}的留言：${item.message}`);
      const rank = document.createElement('span'); rank.className = 'hot-rank'; rank.textContent = String(index + 1);
      const body = document.createElement('span'); body.className = 'hot-comment-body';
      const hotAvatar = document.createElement('img'); hotAvatar.className = 'hot-comment-avatar'; hotAvatar.src = item.avatar || avatarPath; hotAvatar.alt = ''; hotAvatar.loading = 'lazy';
      hotAvatar.addEventListener('error', () => { hotAvatar.src = avatarPath; }, { once: true });
      const name = profileName(item, 'hot-comment-name');
      const role = roleBadge(item.role);
      const number = memberBadge(item.memberNo);
      const message = document.createElement('span'); message.className = 'hot-comment-message'; message.textContent = item.message;
      const likes = document.createElement('span'); likes.className = 'hot-comment-likes'; likes.textContent = `♥ ${item.likes} 赞`;
      body.append(hotAvatar, name); if (role) body.append(role); if (number) body.append(number); body.append(message, likes); button.append(rank, body);
      button.addEventListener('click', event => { if (event.target.closest('a')) return; showHotComment(item.id); });
      hotComments.append(button);
    });
  } catch { hotComments.textContent = '热门留言暂时无法加载。'; }
}

async function loadComments(page = currentPage, scroll = false) {
  try {
    const data = await request(`/api/comments?page=${Math.max(1, page)}`);
    currentPage = data.page || 1; totalPages = data.totalPages || 1;
    commentCount.textContent = `${data.total} 条留言 · 每页 ${data.pageSize || 15} 条`;
    commentList.replaceChildren();
    if (!data.comments.length) {
      const empty = document.createElement('p'); empty.className = 'comment-empty'; empty.textContent = '还没有留言，来写下第一句话吧。'; commentList.append(empty);
    } else {
      for (const item of data.comments) commentList.append(renderComment(item));
    }
    updatePager();
    if (selectedHotCommentId && !document.getElementById(`comment-${selectedHotCommentId}`)) {
      try {
        const selected = await request(`/api/comments/${encodeURIComponent(selectedHotCommentId)}`);
        commentList.querySelector('.comment-empty')?.remove(); commentList.prepend(renderComment(selected.comment));
      } catch { selectedHotCommentId = null; }
    }
    if (scroll) document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await loadHotComments();
  } catch { commentStatus.textContent = '留言暂时无法加载，请稍后刷新网页。'; }
}

commentForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = commentForm.querySelector('button[type="submit"]'); button.disabled = true; commentStatus.textContent = '正在发布…';
  try {
    await request('/api/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: commentForm.elements.nickname.value, message: commentForm.elements.message.value })
    });
    commentForm.elements.message.value = ''; selectedHotCommentId = null; await loadComments(1); commentStatus.textContent = '发布成功！';
  } catch (error) { commentStatus.textContent = error.message; }
  finally { button.disabled = false; }
});

async function loadIdentity() {
  commentForm.hidden = true;
  let prompt = document.getElementById('comment-login-prompt');
  try {
    currentAuth = await request('/api/auth/me');
    currentAccount = currentAuth.authenticated ? currentAuth.user : null;
  } catch { currentAuth = null; currentAccount = null; }
  try { currentMod = currentAccount ? await request('/api/mod/me') : { canModerate:false }; }
  catch { currentMod = { canModerate:false }; }
  if (currentAccount) {
    prompt?.remove(); commentForm.hidden = false; commentForm.elements.nickname.value = currentAccount.nickname; commentForm.elements.nickname.readOnly = true;
    commentForm.querySelector('.comment-avatar').src = currentAccount.avatar;
  } else {
    document.querySelector('.reply-form')?.remove();
    if (!prompt) {
      prompt = document.createElement('p'); prompt.id = 'comment-login-prompt'; prompt.className = 'comment-login-prompt';
      const link = document.createElement('a'); link.id = 'comment-login-link'; link.href = '/account/?view=login'; link.textContent = '登录后留言 ↗';
      prompt.append('登录账号后即可发布留言或回复。', link); commentForm.before(prompt);
    }
  }
}

(async () => {
  await loadIdentity();
  await loadComments(1);
})();
setInterval(() => { if (!document.hidden && !document.querySelector('.reply-form')) loadComments(currentPage); }, 30000);
