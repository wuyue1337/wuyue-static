'use strict';

const params = new URLSearchParams(location.search);
const memberNo = Number(params.get('no'));
const errorCard = document.getElementById('error-card');
const errorText = document.getElementById('error-text');

async function load() {
  if (!Number.isSafeInteger(memberNo) || memberNo < 1) return fail('用户编号无效。');
  try {
    const response = await fetch(`/api/profile/${memberNo}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '加载失败');
    if (!data.user?.username) throw new Error('用户资料缺少用户名。');
    location.replace(`/profile/?user=${encodeURIComponent(data.user.username)}`);
  } catch (error) { fail(error.message); }
}

function fail(message) {
  errorText.textContent = message;
  errorCard.hidden = false;
}

load();
