(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const panel = $('moderation-panel');
  if (!panel) return;
  const PAGE_SIZE = 12;
  let auth = null;
  let mod = null;
  let users = [];
  let filteredUsers = [];
  let userPage = 1;

  async function json(url, options={}) {
    const response = await fetch(url, { cache:'no-store', ...options });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || '操作失败');
    return data;
  }
  function setNotice(text, ok=false) {
    const node = $('moderation-status');
    node.textContent = text;
    node.classList.toggle('ok', ok);
  }
  function roleLabel(role) { return role === 'founder' ? '站长' : role === 'admin' ? '管理员' : '普通用户'; }
  function fmtMute(ts) {
    if (!ts || ts <= Date.now()) return '';
    return ` · 禁言至 ${new Date(ts).toLocaleString('zh-CN')}`;
  }
  function applyFilter() {
    const query = String($('moderation-search')?.value || '').trim().toLowerCase();
    filteredUsers = !query ? users : users.filter(user => {
      const haystack = `${user.nickname || ''} ${user.username || ''} ${user.memberNo || ''} no.${user.memberNo || ''}`.toLowerCase();
      return haystack.includes(query);
    });
    userPage = Math.min(userPage, Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE)));
    renderUsers();
  }
  function renderUsers() {
    const list = $('moderation-users');
    list.innerHTML = '';
    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    userPage = Math.max(1, Math.min(totalPages, userPage));
    const pageUsers = filteredUsers.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE);
    if (!pageUsers.length) {
      const empty = document.createElement('p');
      empty.className = 'inline-status';
      empty.textContent = '没有找到匹配的用户。';
      list.appendChild(empty);
    }
    for (const user of pageUsers) {
      const row = document.createElement('div');
      row.className = 'moderation-user';
      const info = document.createElement('div');
      info.className = 'moderation-user-info';
      info.innerHTML = `<strong></strong><span></span>`;
      info.querySelector('strong').textContent = `${user.nickname} @${user.username}`;
      info.querySelector('span').textContent = `No.${user.memberNo} · ${user.roleTitle}${user.status === 'banned' ? ' · 已封禁' : ''}${fmtMute(user.mutedUntil)}`;
      const actions = document.createElement('div');
      actions.className = 'moderation-actions';
      if (user.role !== 'founder' && user.id !== auth?.user?.id) {
        const add = (text, action, payload={}) => {
          const b = document.createElement('button');
          b.type = 'button'; b.textContent = text; b.className = 'secondary';
          b.addEventListener('click', () => actUser(user.id, action, payload, b));
          actions.appendChild(b);
        };
        add(user.status === 'banned' ? '解除封禁' : '封禁', user.status === 'banned' ? 'unban' : 'ban');
        add(user.mutedUntil > Date.now() ? '解除禁言' : '禁言1小时', user.mutedUntil > Date.now() ? 'unmute' : 'mute', { minutes:60 });
        if (mod.canManageAdmins) add(user.role === 'admin' ? '取消管理员' : '设为管理员', user.role === 'admin' ? 'demote' : 'promote');
      }
      row.append(info, actions);
      list.appendChild(row);
    }
    $('moderation-count').textContent = `共 ${filteredUsers.length} 人`;
    $('moderation-page-info').textContent = `${userPage} / ${totalPages}`;
    $('moderation-prev').disabled = userPage <= 1;
    $('moderation-next').disabled = userPage >= totalPages;
  }
  async function loadUsers() {
    const data = await json('/api/mod/users');
    users = Array.isArray(data.users) ? data.users : [];
    filteredUsers = users;
    applyFilter();
  }
  async function actUser(id, action, payload, button) {
    if (['ban','demote'].includes(action) && !confirm(action === 'ban' ? '确定封禁这个用户吗？' : '确定取消这个管理员吗？')) return;
    button.disabled = true;
    try {
      await json(`/api/mod/users/${encodeURIComponent(id)}`, {
        method:'PATCH', headers:{'Content-Type':'application/json','x-csrf-token':auth.csrf}, body:JSON.stringify({action,...payload})
      });
      setNotice('操作成功。', true); await loadUsers();
    } catch (error) { setNotice(error.message); }
    finally { button.disabled = false; }
  }
  async function loadAnnouncements() {
    if (!mod.canManageAdmins) return;
    const data = await json('/api/announcements', { headers:{'x-csrf-token':auth.csrf} });
    const list = $('announcement-list'); list.innerHTML = '';
    for (const item of data.announcements || []) {
      const row = document.createElement('div'); row.className = 'announcement-admin-item';
      const text = document.createElement('span'); text.textContent = `${item.text} · ${new Date(item.expiresAt).toLocaleString('zh-CN')}`;
      const del = document.createElement('button'); del.type='button'; del.className='secondary'; del.textContent='删除';
      del.addEventListener('click', async()=>{del.disabled=true;try{await json(`/api/announcements/${item.id}`,{method:'DELETE',headers:{'x-csrf-token':auth.csrf}});await loadAnnouncements();}catch(e){setNotice(e.message);}finally{del.disabled=false;}});
      row.append(text, del); list.append(row);
    }
  }
  async function init() {
    try {
      auth = await json('/api/auth/me');
      if (!auth.authenticated) return;
      mod = await json('/api/mod/me');
      const roleNode = $('profile-role');
      if (roleNode) roleNode.textContent = roleLabel(mod.role);
      if (!mod.canModerate) return;
      panel.hidden = false;
      $('moderation-title').textContent = mod.role === 'founder' ? '站长控制台' : '管理员控制台';
      $('announcement-editor').hidden = !mod.canManageAdmins;
      await loadUsers();
      if (mod.canManageAdmins) await loadAnnouncements();
    } catch (error) { console.warn('管理面板加载失败', error); }
  }
  $('moderation-search')?.addEventListener('input', () => { userPage = 1; applyFilter(); });
  $('moderation-prev')?.addEventListener('click', () => { if (userPage > 1) { userPage -= 1; renderUsers(); } });
  $('moderation-next')?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    if (userPage < totalPages) { userPage += 1; renderUsers(); }
  });
  $('announcement-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    try {
      const text = $('announcement-text').value.trim();
      const hours = Number($('announcement-hours').value) || 24;
      await json('/api/announcements', { method:'POST', headers:{'Content-Type':'application/json','x-csrf-token':auth.csrf}, body:JSON.stringify({text,hours}) });
      $('announcement-text').value=''; setNotice('公告已发布。', true); await loadAnnouncements();
    } catch (error) { setNotice(error.message); }
    finally { button.disabled = false; }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
