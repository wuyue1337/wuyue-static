'use strict';

const loginForm = document.getElementById('login-form');
const management = document.getElementById('management');
const list = document.getElementById('admin-comments');
const status = document.getElementById('admin-status');
let csrf = '';
let page = 0;
let total = 0;
let usersPage = 0;
let usersTotal = 0;
let selectedUser = null;
let userCommentsPage = 0;
let userCommentsTotal = 0;

async function request(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '操作失败');
  return data;
}
function showLogin(visible) {
  loginForm.hidden = !visible;
  management.hidden = visible;
}
function date(value) { return value ? new Date(value).toLocaleString('zh-CN') : '从未登录'; }
function fieldList(fields) {
  const details = document.createElement('dl');
  details.className = 'visitor-details';
  for (const [label, value] of fields) {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value ?? '未记录';
    details.append(term, description);
  }
  return details;
}
function commentCard(item) {
  const article = document.createElement('article');
  article.className = 'admin-comment';
  const top = document.createElement('div');
  top.className = 'comment-top';
  const name = document.createElement('strong');
  name.textContent = item.name;
  const memberNo = document.createElement('span');
  memberNo.className = `member-no${item.memberNo <= 10 ? ' founder' : ''}`;
  memberNo.textContent = `No.${item.memberNo}`;
  const time = document.createElement('time');
  time.dateTime = item.time;
  time.textContent = date(item.time);
  top.append(name);
  if (Number.isSafeInteger(item.memberNo) && item.memberNo > 0) top.append(memberNo);
  top.append(time);
  const context = document.createElement('small');
  context.className = 'hint';
  context.textContent = item.parentId ? `回复 @${item.replyTo || '已删除的留言'} · 赞 ${item.likes} · 踩 ${item.dislikes}` : `赞 ${item.likes} · 踩 ${item.dislikes}`;
  const details = fieldList([
    ...(item.userId ? [['注册序号', `No.${item.memberNo}`], ['用户 ID', item.userId], ['用户名', item.username], ['账号昵称', item.nickname]] : []),
    ['访客 ID', item.visitorId], ['IP', item.ip], ['省份', item.province],
    ['浏览器', item.browser], ['User-Agent', item.userAgent], ['留言时间', date(item.time)]
  ]);
  const message = document.createElement('p');
  message.textContent = item.message;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'danger';
  remove.textContent = '删除这条留言';
  remove.addEventListener('click', async () => {
    if (!confirm(item.parentId ? '确定删除这条回复吗？' : '确定删除这条留言及其所有回复吗？')) return;
    remove.disabled = true;
    try {
      await request(`/api/admin/comments/${encodeURIComponent(item.id)}`, {
        method: 'DELETE', headers: { 'x-csrf-token': csrf }
      });
      status.textContent = '留言已删除。';
      await load();
      if (selectedUser) await loadUserComments();
    } catch (error) { status.textContent = error.message; remove.disabled = false; }
  });
  article.append(top, context, message, details, remove);
  return article;
}
function draw(data) {
  total = data.total;
  document.getElementById('total').textContent = `${total} 条留言`;
  document.getElementById('page-number').textContent = `第 ${page + 1} 页`;
  document.getElementById('previous').disabled = page === 0;
  document.getElementById('next').disabled = (page + 1) * 50 >= total;
  list.replaceChildren();
  if (!data.comments.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = '这里还没有留言。';
    list.append(empty);
    return;
  }
  for (const item of data.comments) list.append(commentCard(item));
}
async function load() {
  try { draw(await request(`/api/admin/comments?page=${page}`)); }
  catch (error) { status.textContent = error.message; if (error.message === '请先登录后台') showLogin(true); }
}
function selectTab(tab) {
  const users = tab === 'users';
  document.getElementById('comments-panel').hidden = users;
  document.getElementById('users-panel').hidden = !users;
  for (const [id, active] of [['comments-tab', !users], ['users-tab', users]]) {
    const button = document.getElementById(id);
    button.setAttribute('aria-selected', String(active));
    button.classList.toggle('quiet', !active);
  }
  status.textContent = '';
  if (users) loadUsers();
  else load();
}
async function loadUsers() {
  try {
    const data = await request(`/api/admin/users?page=${usersPage}`);
    usersTotal = data.total;
    document.getElementById('users-total').textContent = `${usersTotal} 位用户`;
    document.getElementById('users-page-number').textContent = `第 ${usersPage + 1} 页`;
    document.getElementById('users-previous').disabled = usersPage === 0;
    document.getElementById('users-next').disabled = (usersPage + 1) * 50 >= usersTotal;
    const list = document.getElementById('admin-users');
    list.replaceChildren();
    if (!data.users.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = '这里还没有用户。';
      list.append(empty);
    }
    for (const user of data.users) {
      const card = document.createElement('article');
      card.className = 'user-card';
      const title = document.createElement('strong');
      title.textContent = user.nickname;
      const number = document.createElement('span');
      number.className = `member-no${user.memberNo <= 10 ? ' founder' : ''}`;
      number.textContent = `No.${user.memberNo}`;
      number.title = `第 ${user.memberNo} 位注册用户`;
      const details = fieldList([
        ['注册序号', `No.${user.memberNo}`], ['用户 ID', user.id], ['用户名', user.username], ['昵称', user.nickname],
        ['角色', user.role === 'admin' ? '管理员' : '普通用户'],
        ['状态', user.status === 'banned' ? '已封禁' : '正常'],
        ['注册时间', date(user.createdAt)], ['最后登录', date(user.lastLoginAt)]
      ]);
      const actions = document.createElement('div');
      actions.className = 'user-actions';
      const view = document.createElement('button');
      view.type = 'button';
      view.className = 'quiet';
      view.textContent = '查看留言';
      view.addEventListener('click', () => {
        selectedUser = user;
        userCommentsPage = 0;
        document.getElementById('users-list-view').hidden = true;
        document.getElementById('user-comments-view').hidden = false;
        loadUserComments();
      });
      const change = document.createElement('button');
      change.type = 'button';
      change.className = user.status === 'banned' ? 'quiet' : 'danger';
      change.textContent = user.status === 'banned' ? '解封' : '封禁';
      change.addEventListener('click', async () => {
        const desired = user.status === 'banned' ? 'active' : 'banned';
        if (!confirm(`确定${desired === 'banned' ? '封禁' : '解封'}用户 ${user.username} 吗？`)) return;
        change.disabled = true;
        try {
          await request(`/api/admin/users/${encodeURIComponent(user.id)}/status`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
            body: JSON.stringify({ status: desired })
          });
          status.textContent = desired === 'banned' ? '用户已封禁，现有登录已失效。' : '用户已解封。';
          await loadUsers();
        } catch (error) { status.textContent = error.message; change.disabled = false; }
      });
      actions.append(view, change);
      card.append(title, number, details, actions);
      list.append(card);
    }
  } catch (error) { status.textContent = error.message; if (error.message === '请先登录后台') showLogin(true); }
}
async function loadUserComments() {
  if (!selectedUser) return;
  try {
    const data = await request(`/api/admin/users/${encodeURIComponent(selectedUser.id)}/comments?page=${userCommentsPage}`);
    userCommentsTotal = data.total;
    document.getElementById('user-comments-title').textContent = `${selectedUser.nickname} 的留言（${userCommentsTotal}）`;
    document.getElementById('user-comments-page-number').textContent = `第 ${userCommentsPage + 1} 页`;
    document.getElementById('user-comments-previous').disabled = userCommentsPage === 0;
    document.getElementById('user-comments-next').disabled = (userCommentsPage + 1) * 50 >= userCommentsTotal;
    const list = document.getElementById('user-comments');
    list.replaceChildren();
    if (!data.comments.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = '这位用户还没有留言。';
      list.append(empty);
    }
    for (const item of data.comments) list.append(commentCard(item));
  } catch (error) { status.textContent = error.message; if (error.message === '请先登录后台') showLogin(true); }
}
document.getElementById('comments-tab').addEventListener('click', () => selectTab('comments'));
document.getElementById('users-tab').addEventListener('click', () => selectTab('users'));
document.getElementById('users-previous').addEventListener('click', () => { if (usersPage > 0) { usersPage--; loadUsers(); } });
document.getElementById('users-next').addEventListener('click', () => { if ((usersPage + 1) * 50 < usersTotal) { usersPage++; loadUsers(); } });
document.getElementById('back-to-users').addEventListener('click', () => {
  selectedUser = null;
  document.getElementById('users-list-view').hidden = false;
  document.getElementById('user-comments-view').hidden = true;
  loadUsers();
});
document.getElementById('user-comments-previous').addEventListener('click', () => { if (userCommentsPage > 0) { userCommentsPage--; loadUserComments(); } });
document.getElementById('user-comments-next').addEventListener('click', () => { if ((userCommentsPage + 1) * 50 < userCommentsTotal) { userCommentsPage++; loadUserComments(); } });
loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = loginForm.querySelector('button');
  button.disabled = true;
  status.textContent = '';
  try {
    const data = await request('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: loginForm.elements.password.value })
    });
    csrf = data.csrf;
    loginForm.reset();
    showLogin(false);
    await load();
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
document.getElementById('logout').addEventListener('click', async () => {
  try {
    await request('/api/admin/logout', { method: 'POST', headers: { 'x-csrf-token': csrf } });
    csrf = '';
    showLogin(true);
    status.textContent = '已退出后台。';
  } catch (error) { status.textContent = error.message; }
});
document.getElementById('previous').addEventListener('click', () => { if (page > 0) { page--; load(); } });
document.getElementById('next').addEventListener('click', () => { if ((page + 1) * 50 < total) { page++; load(); } });
request('/api/admin/session').then(data => {
  if (data.authenticated) { csrf = data.csrf; showLogin(false); load(); }
  else showLogin(true);
}).catch(() => { showLogin(true); status.textContent = '后台暂时无法连接，请稍后刷新。'; });
