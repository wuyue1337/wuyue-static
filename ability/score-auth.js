'use strict';

(() => {
  let pending = null;

  async function currentAccount() {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await response.json();
      return response.ok && data.authenticated ? data.user : null;
    } catch { return null; }
  }

  function ensureDialog() {
    let dialog = document.getElementById('score-auth-dialog');
    if (dialog) return dialog;

    const style = document.createElement('style');
    style.textContent = `
      #score-auth-dialog{width:min(92vw,440px);border:1px solid #8f82cb66;border-radius:18px;padding:0;background:#171b31;color:#eef0ff;box-shadow:0 28px 90px #050615aa}
      #score-auth-dialog::backdrop{background:#050617b8;backdrop-filter:blur(4px)}
      .score-auth-inner{padding:24px}.score-auth-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.score-auth-head h2{margin:4px 0 0;font-size:23px}.score-auth-kicker{margin:0;color:#b9aaff;font-size:11px;font-weight:800;letter-spacing:2px}.score-auth-close{margin:0!important;min-height:34px!important;padding:4px 10px!important;border:1px solid #ffffff20!important;background:#ffffff0c!important;color:#d8d9e7!important}.score-auth-copy{margin:14px 0 18px;color:#aeb4cc;font-size:13px;line-height:1.65}.score-auth-tabs{display:flex;gap:6px;padding:4px;border-radius:11px;background:#0f1326}.score-auth-tabs button{flex:1;margin:0!important;min-height:38px!important;padding:7px 10px!important;border:0!important;border-radius:8px!important;background:transparent!important;color:#aeb4cc!important}.score-auth-tabs button.active{background:#4a426c!important;color:#fff!important}.score-auth-form{display:grid;gap:9px;margin-top:15px}.score-auth-form[hidden]{display:none!important}.score-auth-form label{font-size:12px;color:#c9cde0}.score-auth-form input{width:100%;padding:11px 12px;border:1px solid #777d9b77;border-radius:9px;background:#111528;color:#fff;font:inherit;outline:none}.score-auth-form input:focus{border-color:#ad9af0;box-shadow:0 0 0 3px #ad9af026}.score-auth-submit{margin-top:7px!important;width:100%;border:0!important;border-radius:9px!important;background:#aa9aec!important;color:#17172b!important;font-weight:800!important}.score-auth-status{min-height:20px;margin:10px 0 0;color:#efb9d4;font-size:12px}.score-auth-status.ok{color:#b5eccd}.score-auth-note{margin:12px 0 0;color:#868da7;font-size:11px;line-height:1.5}
    `;
    document.head.appendChild(style);

    dialog = document.createElement('dialog');
    dialog.id = 'score-auth-dialog';
    dialog.innerHTML = `
      <div class="score-auth-inner">
        <div class="score-auth-head"><div><p class="score-auth-kicker">SAVE YOUR SCORE</p><h2>保存这次成绩</h2></div><button type="button" class="score-auth-close" aria-label="关闭">✕</button></div>
        <p class="score-auth-copy">你还没有登录。现在注册或登录后，这一次刚刚测出的成绩会直接继续提交，不用重新测试。</p>
        <div class="score-auth-tabs"><button type="button" data-view="register" class="active">注册账号</button><button type="button" data-view="login">已有账号登录</button></div>
        <form class="score-auth-form" data-form="register">
          <label>用户名</label><input name="username" autocomplete="username" pattern="[A-Za-z0-9_]{3,20}" minlength="3" maxlength="20" placeholder="3–20 位字母、数字或下划线" required>
          <label>昵称</label><input name="nickname" autocomplete="nickname" maxlength="24" placeholder="排行榜会显示这个昵称" required>
          <label>密码</label><input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" placeholder="至少 8 位" required>
          <button class="score-auth-submit" type="submit">注册并保存成绩</button>
        </form>
        <form class="score-auth-form" data-form="login" hidden>
          <label>用户名</label><input name="username" autocomplete="username" maxlength="20" required>
          <label>密码</label><input name="password" type="password" autocomplete="current-password" maxlength="128" required>
          <button class="score-auth-submit" type="submit">登录并保存成绩</button>
        </form>
        <p class="score-auth-status" role="status"></p>
        <p class="score-auth-note">关闭窗口不会丢掉当前页面上的测试结果，只要不重新开始测试，仍可以再次点击提交。</p>
      </div>`;
    document.body.appendChild(dialog);

    const tabs = [...dialog.querySelectorAll('[data-view]')];
    const forms = [...dialog.querySelectorAll('[data-form]')];
    const status = dialog.querySelector('.score-auth-status');
    function show(view) {
      tabs.forEach(button => {
        const active = button.dataset.view === view;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
      });
      forms.forEach(form => { form.hidden = form.dataset.form !== view; });
      status.textContent = '';
      requestAnimationFrame(() => forms.find(form => form.dataset.form === view)?.querySelector('input')?.focus());
    }
    tabs.forEach(button => button.addEventListener('click', () => show(button.dataset.view)));
    dialog.querySelector('.score-auth-close').addEventListener('click', () => dialog.close('cancel'));
    dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close('cancel'); });

    forms.forEach(form => form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      status.classList.remove('ok');
      status.textContent = form.dataset.form === 'register' ? '正在创建账号…' : '正在登录…';
      try {
        const body = Object.fromEntries(new FormData(form));
        const response = await fetch(form.dataset.form === 'register' ? '/api/auth/register' : '/api/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || '操作失败，请稍后再试');
        status.classList.add('ok');
        status.textContent = form.dataset.form === 'register' ? '注册成功，正在保存刚才的成绩…' : '登录成功，正在保存刚才的成绩…';
        setTimeout(() => dialog.close('success'), 180);
      } catch (error) {
        status.textContent = error.message;
        button.disabled = false;
      }
    }));

    show('register');
    return dialog;
  }

  async function ensureAccount() {
    const existing = await currentAccount();
    if (existing) return existing;
    if (pending) return pending;
    const dialog = ensureDialog();
    pending = new Promise((resolve, reject) => {
      const onClose = async () => {
        dialog.removeEventListener('close', onClose);
        if (dialog.returnValue !== 'success') {
          pending = null;
          reject(new Error('成绩还没有提交，你可以稍后再次点击提交成绩'));
          return;
        }
        const account = await currentAccount();
        pending = null;
        if (account) resolve(account);
        else reject(new Error('账号状态确认失败，请再点一次提交成绩'));
      };
      dialog.addEventListener('close', onClose);
      dialog.returnValue = '';
      dialog.showModal();
    });
    return pending;
  }

  window.WuyueScoreAuth = { ensureAccount, currentAccount };
})();
