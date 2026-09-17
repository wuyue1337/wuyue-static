(() => {
  'use strict';

  const STORAGE_KEY = 'rhythmPowerDisplayV9';
  const V8_KEY = 'rhythmPowerDisplayV8';
  const V7_KEY = 'rhythmPowerDisplayV7';
  const V6_KEY = 'rhythmPowerDisplayV6';
  const V5_KEY = 'rhythmPowerDisplayV5';
  const V4_KEY = 'rhythmPowerDisplayV4';
  const V3_KEY = 'rhythmPowerDisplayV3';
  const V2_KEY = 'rhythmPowerDisplayV2';
  const LEGACY_KEY = 'rhythmPowerDisplayV1';

  const ALT_COLOR = '#69c9ef';
  const COLOR_PRESETS = ['#9d88eb', '#69c9ef', '#f3a7dc', '#f0d66a', '#78d6a3', '#ef8295', '#f2f2f6'];

  function makeDefaultLaneOverrides() {
    return {
      4: {},
      5: { 1: ALT_COLOR, 3: ALT_COLOR },
      6: { 1: ALT_COLOR, 4: ALT_COLOR },
      7: { 1: ALT_COLOR, 3: ALT_COLOR, 5: ALT_COLOR }
    };
  }

  const skinDefaults = {
    default: { noteHeight: 50, noteWidth: 90, color: '#9d88eb', shape: 'soft', laneOverrides: makeDefaultLaneOverrides() },
    ball: { noteHeight: 100, noteWidth: 100, color: '#9d88eb', laneOverrides: makeDefaultLaneOverrides() }
  };

  const defaults = {
    trackWidth: 680,
    scrollSpeed: 1,
    guides: true,
    noteEffects: true,
    noteSkin: 'default',
    skins: {
      default: cloneSkinDefault('default'),
      ball: cloneSkinDefault('ball')
    }
  };

  const limits = {
    trackWidth: { min: 420, max: 1000 },
    noteHeight: { min: 4, max: 100 },
    noteWidth: { min: 8, max: 100 },
    scrollSpeed: { min: 0.5, max: 3, step: 0.25 }
  };

  const trackWidthInput = document.getElementById('track-width');
  const noteHeightInput = document.getElementById('note-height');
  const noteWidthInput = document.getElementById('note-width');
  const scrollSpeedInput = document.getElementById('scroll-speed');
  const guideLinesInput = document.getElementById('guide-lines');
  const noteSkinRow = document.getElementById('note-skin-row');
  const trackWidthValue = document.getElementById('track-width-value');
  const noteHeightValue = document.getElementById('note-height-value');
  const noteWidthValue = document.getElementById('note-width-value');
  const scrollSpeedValue = document.getElementById('scroll-speed-value');
  const guideLinesValue = document.getElementById('guide-lines-value');
  const resetButton = document.getElementById('reset-display');
  const gameShell = document.getElementById('game-shell');
  const displaySettings = document.getElementById('display-settings');
  const displayOptions = displaySettings?.querySelector('.display-options');

  if (!trackWidthInput || !noteHeightInput || !noteWidthInput || !scrollSpeedInput || !guideLinesInput || !noteSkinRow || !trackWidthValue || !noteHeightValue || !noteWidthValue || !scrollSpeedValue || !guideLinesValue || !resetButton || !gameShell || !displaySettings || !displayOptions) return;

  installExtraStyles();
  installSettingsDialog();
  const controls = installAppearanceControls();
  if (!controls) return;

  const {
    noteColorInput,
    noteColorValue,
    noteColorPresets,
    noteEffectsInput,
    noteEffectsValue,
    brickShapeControl,
    brickShapeRow,
    laneColorControl,
    laneColorTitle,
    laneColorGrid,
    resetLaneColorsButton
  } = controls;

  function cloneLaneOverrides(source = makeDefaultLaneOverrides()) {
    const result = { 4: {}, 5: {}, 6: {}, 7: {} };
    for (const count of [4, 5, 6, 7]) {
      const item = source?.[count] || source?.[String(count)] || {};
      for (let lane = 0; lane < count; lane++) {
        const value = item?.[lane] ?? item?.[String(lane)];
        if (/^#[0-9a-f]{6}$/i.test(String(value || ''))) result[count][lane] = String(value).toLowerCase();
      }
    }
    return result;
  }

  function cloneSkinDefault(name) {
    const source = skinDefaults[name];
    return {
      noteHeight: source.noteHeight,
      noteWidth: source.noteWidth,
      color: source.color,
      ...(name === 'default' ? { shape: source.shape } : {}),
      laneOverrides: cloneLaneOverrides(source.laneOverrides)
    };
  }

  function installExtraStyles() {
    for (const id of ['rhythm-display-v7-style', 'rhythm-display-v8-style', 'rhythm-display-v9-style']) document.getElementById(id)?.remove();
    if (document.getElementById('rhythm-display-v10-style')) return;

    const style = document.createElement('style');
    style.id = 'rhythm-display-v10-style';
    style.textContent = `
      .display-settings-launcher{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:16px;padding:12px 14px;border:1px solid #3a3e60;border-radius:12px;background:#17192a}
      .display-settings-launcher-copy{display:flex;flex-direction:column;gap:3px;min-width:0}.display-settings-launcher-copy strong{font-size:13px;color:#f3f0ff}.display-settings-launcher-copy span{font-size:11px;color:#868ca9}
      .open-display-settings,.close-display-settings{height:36px;padding:0 14px;border:1px solid #585080;border-radius:9px;background:#312b52;color:#eeeaff;font-size:11px;font-weight:800;white-space:nowrap}.open-display-settings:hover,.close-display-settings:hover{border-color:#9583e2;background:#40376d}
      .display-settings-dialog{width:min(94vw,860px);max-height:min(88vh,900px);padding:0;border:1px solid #474b70;border-radius:18px;background:#17192a;color:#ecebff;box-shadow:0 30px 90px #000b;overflow:hidden}
      .display-settings-dialog::backdrop{background:#080914b8;backdrop-filter:blur(4px)}
      .display-settings-dialog-head{position:sticky;z-index:5;top:0;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-bottom:1px solid #ffffff12;background:#1b1e31f2;backdrop-filter:blur(10px)}
      .display-settings-dialog-head>div{display:flex;flex-direction:column;gap:3px}.display-settings-dialog-head strong{font-size:15px;color:#f5f3ff}.display-settings-dialog-head span{font-size:11px;color:#8f94af}
      .display-settings-dialog-body{max-height:calc(min(88vh,900px) - 66px);padding:16px;overflow:auto}
      .display-settings-dialog .display-settings{margin:0;padding:0;border:0;background:transparent}
      .display-settings-dialog .display-settings-head{display:none}
      .display-options{grid-template-columns:repeat(auto-fit,minmax(140px,1fr));align-items:stretch}
      .display-options .reset-display{align-self:end;justify-self:start}
      .display-color,.display-brick-shape,.display-lane-colors{display:grid;gap:7px;min-height:58px;padding:9px 11px;border:1px solid #3f4365;border-radius:9px;background:#20233a;color:#c6c9dc;font-size:11px}
      .display-color-row{display:flex;align-items:center;gap:8px}.display-color input[type="color"]{width:42px;height:30px;padding:2px;border:1px solid #555a7e;border-radius:8px;background:#181a2c;cursor:pointer}.display-color output{font-size:10px;font-weight:800;color:#b9aaff;letter-spacing:.35px}
      .note-color-presets{display:flex;gap:5px;flex-wrap:wrap}.note-color-preset{width:22px;height:22px;padding:0;border:2px solid #ffffff38;border-radius:6px;box-shadow:0 1px 5px #0005;cursor:pointer}.note-color-preset:hover{transform:translateY(-1px);border-color:#fff9}
      .display-brick-shape[hidden]{display:none!important}.brick-shape-picker{display:flex;gap:6px}.brick-shape-picker button{flex:1;min-width:0;height:32px;padding:0 9px;border:1px solid #474b70;border-radius:8px;background:#242741;color:#aeb3ca;font-size:10px;font-weight:800}.brick-shape-picker button.active{border-color:#9583e2;background:#443b72;color:#fff;box-shadow:0 0 0 2px #8f7be11c inset}
      .display-lane-colors{grid-column:1/-1}.lane-color-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.lane-color-head button{height:28px;padding:0 9px;border:1px solid #474b70;border-radius:7px;background:#242741;color:#c9c6e8;font-size:10px}.lane-color-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:7px}.lane-color-item{display:grid;grid-template-columns:1fr auto;align-items:center;gap:7px;padding:8px;border:1px solid #393e60;border-radius:8px;background:#191c2f}.lane-color-item>span{font-size:10px;color:#aeb3cb}.lane-color-item>input{width:32px;height:26px;padding:1px;border:1px solid #525879;border-radius:6px;background:#111421;cursor:pointer}.lane-color-presets{grid-column:1/-1;display:flex;gap:4px;flex-wrap:wrap;padding-top:2px}.lane-color-preset{width:19px;height:19px;padding:0;border:1px solid #ffffff42;border-radius:5px;box-shadow:0 1px 4px #0005;cursor:pointer}.lane-color-preset:hover{transform:translateY(-1px);border-color:#fff}
      .tile-cell[data-lane="0"]{--cell-note-color:var(--lane-color-1,var(--note-color,#9d88eb))}.tile-cell[data-lane="1"]{--cell-note-color:var(--lane-color-2,var(--note-color,#9d88eb))}.tile-cell[data-lane="2"]{--cell-note-color:var(--lane-color-3,var(--note-color,#9d88eb))}.tile-cell[data-lane="3"]{--cell-note-color:var(--lane-color-4,var(--note-color,#9d88eb))}.tile-cell[data-lane="4"]{--cell-note-color:var(--lane-color-5,var(--note-color,#9d88eb))}.tile-cell[data-lane="5"]{--cell-note-color:var(--lane-color-6,var(--note-color,#9d88eb))}.tile-cell[data-lane="6"]{--cell-note-color:var(--lane-color-7,var(--note-color,#9d88eb))}
      .tile-cell.target::before,.tile-cell.target.tone-alt::before,.tile-row.active .tile-cell.target::before,.tile-row.active .tile-cell.target.tone-alt::before{background:var(--cell-note-color,var(--note-color,#9d88eb));box-shadow:none;filter:none;border-radius:20px}
      .game-shell.brick-square:not(.skin-ball) .tile-cell.target::before,.game-shell.brick-square:not(.skin-ball) .tile-cell.target.tone-alt::before,.game-shell.brick-square:not(.skin-ball) .tile-row.active .tile-cell.target::before,.game-shell.brick-square:not(.skin-ball) .tile-row.active .tile-cell.target.tone-alt::before{border-radius:0}
      .game-shell.brick-soft:not(.skin-ball) .tile-cell.target::before,.game-shell.brick-soft:not(.skin-ball) .tile-cell.target.tone-alt::before,.game-shell.brick-soft:not(.skin-ball) .tile-row.active .tile-cell.target::before,.game-shell.brick-soft:not(.skin-ball) .tile-row.active .tile-cell.target.tone-alt::before{border-radius:20px}
      .game-shell.note-effects:not(.skin-ball) .tile-cell.target::before,.game-shell.note-effects:not(.skin-ball) .tile-cell.target.tone-alt::before{background:linear-gradient(145deg,color-mix(in srgb,var(--cell-note-color) 42%,white),var(--cell-note-color));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--cell-note-color) 55%,white);filter:drop-shadow(0 0 9px color-mix(in srgb,var(--cell-note-color) 48%,transparent))}
      .game-shell.note-effects:not(.skin-ball) .tile-row.active .tile-cell.target::before,.game-shell.note-effects:not(.skin-ball) .tile-row.active .tile-cell.target.tone-alt::before{background:linear-gradient(145deg,color-mix(in srgb,var(--cell-note-color) 30%,white),var(--cell-note-color));filter:drop-shadow(0 0 13px color-mix(in srgb,var(--cell-note-color) 62%,transparent))}
      .game-shell.skin-ball .tile-cell.target::before,.game-shell.skin-ball .tile-cell.target.tone-alt::before,.game-shell.skin-ball .tile-row.active .tile-cell.target::before,.game-shell.skin-ball .tile-row.active .tile-cell.target.tone-alt::before{border-radius:999px;background:var(--cell-note-color,var(--note-color,#9d88eb));box-shadow:none;filter:none}
      .game-shell.skin-ball.note-effects .tile-cell.target::before,.game-shell.skin-ball.note-effects .tile-cell.target.tone-alt::before{background:radial-gradient(circle at 34% 26%,color-mix(in srgb,var(--cell-note-color) 18%,white) 0 8%,color-mix(in srgb,var(--cell-note-color) 45%,white) 22%,var(--cell-note-color) 58%,color-mix(in srgb,var(--cell-note-color) 76%,black) 84%,color-mix(in srgb,var(--cell-note-color) 60%,black) 100%);box-shadow:inset -8px -10px 16px color-mix(in srgb,var(--cell-note-color) 58%,black),inset 6px 6px 12px #ffffff55;filter:drop-shadow(0 0 11px color-mix(in srgb,var(--cell-note-color) 58%,transparent))}
      .game-shell.skin-ball.note-effects .tile-row.active .tile-cell.target::before,.game-shell.skin-ball.note-effects .tile-row.active .tile-cell.target.tone-alt::before{background:radial-gradient(circle at 34% 26%,color-mix(in srgb,var(--cell-note-color) 10%,white) 0 8%,color-mix(in srgb,var(--cell-note-color) 35%,white) 22%,var(--cell-note-color) 58%,color-mix(in srgb,var(--cell-note-color) 78%,black) 86%,color-mix(in srgb,var(--cell-note-color) 62%,black) 100%);filter:drop-shadow(0 0 15px color-mix(in srgb,var(--cell-note-color) 70%,transparent))}
      @media(max-width:700px){.display-settings-launcher{align-items:flex-start;flex-direction:column}.display-settings-launcher .open-display-settings{width:100%}.display-options{grid-template-columns:1fr}.display-lane-colors{grid-column:auto}.display-settings-dialog{width:96vw}.display-settings-dialog-body{padding:12px}}
    `;
    document.head.appendChild(style);
  }

  function installSettingsDialog() {
    if (document.getElementById('display-settings-dialog')) return;

    const parent = displaySettings.parentElement;
    if (!parent) return;

    const launcher = document.createElement('div');
    launcher.className = 'display-settings-launcher';
    launcher.innerHTML = '<div class="display-settings-launcher-copy"><strong>画面设置</strong><span>皮肤、Note 尺寸、颜色、分轨配色、速度与辅助线</span></div><button type="button" class="open-display-settings">打开设置</button>';
    parent.insertBefore(launcher, displaySettings);

    const dialog = document.createElement('dialog');
    dialog.className = 'display-settings-dialog';
    dialog.id = 'display-settings-dialog';

    const head = document.createElement('div');
    head.className = 'display-settings-dialog-head';
    head.innerHTML = '<div><strong>画面设置</strong><span>所有设置实时生效，并自动保存在本机</span></div><button type="button" class="close-display-settings">完成</button>';

    const body = document.createElement('div');
    body.className = 'display-settings-dialog-body';
    body.appendChild(displaySettings);
    dialog.append(head, body);
    document.body.appendChild(dialog);

    launcher.querySelector('.open-display-settings')?.addEventListener('click', () => {
      if (!dialog.open) dialog.showModal();
    });
    head.querySelector('.close-display-settings')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  }

  function installAppearanceControls() {
    document.getElementById('note-glow')?.closest('.display-toggle')?.remove();
    document.getElementById('ball-reflection-toggle')?.remove();

    const guideToggle = guideLinesInput.closest('.display-toggle');

    let brickShapeControl = document.getElementById('brick-shape-control');
    let brickShapeRow = document.getElementById('brick-shape-row');
    if (!brickShapeControl) {
      brickShapeControl = document.createElement('div');
      brickShapeControl.className = 'display-brick-shape';
      brickShapeControl.id = 'brick-shape-control';
      brickShapeControl.innerHTML = '<span>砖皮形状</span><div class="brick-shape-picker" id="brick-shape-row"><button type="button" class="active" data-brick-shape="soft" aria-pressed="true">圆角砖</button><button type="button" data-brick-shape="square" aria-pressed="false">直角砖</button></div>';
      displayOptions.insertBefore(brickShapeControl, guideToggle || resetButton);
      brickShapeRow = brickShapeControl.querySelector('#brick-shape-row');
    }

    let noteColorInput = document.getElementById('note-color');
    let noteColorValue = document.getElementById('note-color-value');
    let noteColorPresets = document.getElementById('note-color-presets');
    if (!noteColorInput) {
      const colorLabel = document.createElement('div');
      colorLabel.className = 'display-color';
      colorLabel.innerHTML = '<span>当前皮肤 Note 主色</span><div class="display-color-row"><input id="note-color" type="color" value="#9d88eb"><output id="note-color-value">#9D88EB</output></div><div class="note-color-presets" id="note-color-presets" aria-label="预设颜色"></div>';
      displayOptions.insertBefore(colorLabel, guideToggle || resetButton);
      noteColorInput = colorLabel.querySelector('#note-color');
      noteColorValue = colorLabel.querySelector('#note-color-value');
      noteColorPresets = colorLabel.querySelector('#note-color-presets');
    }
    if (noteColorPresets && !noteColorPresets.children.length) {
      for (const color of COLOR_PRESETS) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'note-color-preset';
        button.dataset.notePreset = color;
        button.title = color.toUpperCase();
        button.style.background = color;
        noteColorPresets.appendChild(button);
      }
    }

    let noteEffectsInput = document.getElementById('note-effects');
    let noteEffectsValue = document.getElementById('note-effects-value');
    if (!noteEffectsInput) {
      const effectsLabel = document.createElement('label');
      effectsLabel.className = 'display-toggle';
      effectsLabel.htmlFor = 'note-effects';
      effectsLabel.innerHTML = '<span>Note 特效</span><input id="note-effects" type="checkbox" checked><output id="note-effects-value" for="note-effects">开启</output>';
      displayOptions.insertBefore(effectsLabel, guideToggle || resetButton);
      noteEffectsInput = effectsLabel.querySelector('#note-effects');
      noteEffectsValue = effectsLabel.querySelector('#note-effects-value');
    }

    let laneColorControl = document.getElementById('lane-color-control');
    let laneColorTitle = document.getElementById('lane-color-title');
    let laneColorGrid = document.getElementById('lane-color-grid');
    let resetLaneColorsButton = document.getElementById('reset-lane-colors');
    if (!laneColorControl) {
      laneColorControl = document.createElement('div');
      laneColorControl.className = 'display-lane-colors';
      laneColorControl.id = 'lane-color-control';
      laneColorControl.innerHTML = '<div class="lane-color-head"><span id="lane-color-title">4K 轨道颜色</span><button type="button" id="reset-lane-colors">恢复该键数默认配色</button></div><div class="lane-color-grid" id="lane-color-grid"></div>';
      displayOptions.insertBefore(laneColorControl, resetButton);
      laneColorTitle = laneColorControl.querySelector('#lane-color-title');
      laneColorGrid = laneColorControl.querySelector('#lane-color-grid');
      resetLaneColorsButton = laneColorControl.querySelector('#reset-lane-colors');
    }

    if (!brickShapeControl || !brickShapeRow || !noteColorInput || !noteColorValue || !noteColorPresets || !noteEffectsInput || !noteEffectsValue || !laneColorControl || !laneColorTitle || !laneColorGrid || !resetLaneColorsButton) return null;
    return { brickShapeControl, brickShapeRow, noteColorInput, noteColorValue, noteColorPresets, noteEffectsInput, noteEffectsValue, laneColorControl, laneColorTitle, laneColorGrid, resetLaneColorsButton };
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function snapScrollSpeed(value) {
    const clamped = clamp(value, limits.scrollSpeed.min, limits.scrollSpeed.max, defaults.scrollSpeed);
    return Number((Math.round(clamped / limits.scrollSpeed.step) * limits.scrollSpeed.step).toFixed(2));
  }

  function previousOsuSpeedToScale(ss) {
    const value = clamp(ss, 1, 40, 20);
    if (value <= 20) return 0.2 + ((value - 1) / 19) * 0.8;
    return 1 + ((value - 20) / 20) * 4;
  }

  function normalizeSkin(value) { return value === 'ball' ? 'ball' : 'default'; }
  function normalizeShape(value) { return value === 'square' ? 'square' : 'soft'; }
  function normalizeColor(value, fallback) { return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback; }

  function cleanLaneOverrides(value) {
    const fallback = makeDefaultLaneOverrides();
    const result = cloneLaneOverrides(fallback);
    if (!value || typeof value !== 'object') return result;
    for (const count of [4, 5, 6, 7]) {
      const source = value[count] || value[String(count)];
      if (!source || typeof source !== 'object') continue;
      result[count] = {};
      for (let lane = 0; lane < count; lane++) {
        const color = source[lane] ?? source[String(lane)];
        if (/^#[0-9a-f]{6}$/i.test(String(color || ''))) result[count][lane] = String(color).toLowerCase();
      }
    }
    return result;
  }

  function cleanSkin(value, fallback, skinName) {
    const result = {
      noteHeight: clamp(value?.noteHeight, limits.noteHeight.min, limits.noteHeight.max, fallback.noteHeight),
      noteWidth: clamp(value?.noteWidth, limits.noteWidth.min, limits.noteWidth.max, fallback.noteWidth),
      color: normalizeColor(value?.color, fallback.color),
      laneOverrides: cleanLaneOverrides(value?.laneOverrides)
    };
    if (skinName === 'default') result.shape = normalizeShape(value?.shape ?? fallback.shape);
    return result;
  }

  function clean(source) {
    return {
      trackWidth: clamp(source?.trackWidth, limits.trackWidth.min, limits.trackWidth.max, defaults.trackWidth),
      scrollSpeed: snapScrollSpeed(source?.scrollSpeed),
      guides: source?.guides !== false,
      noteEffects: source?.noteEffects !== false,
      noteSkin: normalizeSkin(source?.noteSkin),
      skins: {
        default: cleanSkin(source?.skins?.default, skinDefaults.default, 'default'),
        ball: cleanSkin(source?.skins?.ball, skinDefaults.ball, 'ball')
      }
    };
  }

  function freshDefaults() { return clean(defaults); }

  function migrateV8(source) {
    return clean({
      ...source,
      skins: {
        default: { ...source?.skins?.default, laneOverrides: makeDefaultLaneOverrides() },
        ball: { ...source?.skins?.ball, laneOverrides: makeDefaultLaneOverrides() }
      }
    });
  }

  function migrateV7(source) {
    const active = normalizeSkin(source?.noteSkin);
    const activeOldSkin = source?.skins?.[active] || {};
    const mergedEffects = active === 'ball' ? (activeOldSkin.glow !== false || activeOldSkin.reflection !== false) : activeOldSkin.glow !== false;
    return clean({
      trackWidth: source?.trackWidth,
      scrollSpeed: source?.scrollSpeed,
      guides: source?.guides,
      noteSkin: active,
      noteEffects: mergedEffects,
      skins: {
        default: { noteHeight: source?.skins?.default?.noteHeight, noteWidth: source?.skins?.default?.noteWidth, color: source?.skins?.default?.color, shape: 'soft', laneOverrides: makeDefaultLaneOverrides() },
        ball: { noteHeight: source?.skins?.ball?.noteHeight, noteWidth: source?.skins?.ball?.noteWidth, color: source?.skins?.ball?.color, laneOverrides: makeDefaultLaneOverrides() }
      }
    });
  }

  function migrateFlat(source, scrollSpeed = source?.scrollSpeed) {
    return clean({
      trackWidth: source?.trackWidth,
      scrollSpeed,
      guides: source?.guides,
      noteEffects: true,
      noteSkin: source?.noteSkin,
      skins: {
        default: { noteHeight: source?.noteHeight, noteWidth: source?.noteWidth, color: skinDefaults.default.color, shape: 'soft', laneOverrides: makeDefaultLaneOverrides() },
        ball: cloneSkinDefault('ball')
      }
    });
  }

  function load() {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (current && typeof current === 'object') return clean(current);

      const v8 = JSON.parse(localStorage.getItem(V8_KEY) || 'null');
      if (v8 && typeof v8 === 'object') return migrateV8(v8);

      const v7 = JSON.parse(localStorage.getItem(V7_KEY) || 'null');
      if (v7 && typeof v7 === 'object') return migrateV7(v7);

      const v6 = JSON.parse(localStorage.getItem(V6_KEY) || 'null');
      if (v6 && typeof v6 === 'object') return clean({ ...v6, noteEffects: true, skins: { default: { ...v6?.skins?.default, laneOverrides: makeDefaultLaneOverrides() }, ball: { ...v6?.skins?.ball, laneOverrides: makeDefaultLaneOverrides() } } });

      const v5 = JSON.parse(localStorage.getItem(V5_KEY) || 'null');
      if (v5 && typeof v5 === 'object') return migrateFlat(v5);

      const v4 = JSON.parse(localStorage.getItem(V4_KEY) || 'null');
      if (v4 && typeof v4 === 'object') return migrateFlat(v4, previousOsuSpeedToScale(v4.osuSpeed));

      const v3 = JSON.parse(localStorage.getItem(V3_KEY) || 'null');
      if (v3 && typeof v3 === 'object') return migrateFlat(v3);

      const v2 = JSON.parse(localStorage.getItem(V2_KEY) || 'null');
      if (v2 && typeof v2 === 'object') {
        const oldThickness = clamp(v2.noteWidth, 40, 100, 100);
        return migrateFlat({ trackWidth: v2.trackWidth, noteHeight: Math.round(oldThickness * 0.5), noteWidth: skinDefaults.default.noteWidth, scrollSpeed: v2.scrollSpeed, guides: true, noteSkin: 'default' });
      }

      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
      if (legacy && typeof legacy === 'object') {
        const oldGap = clamp(legacy.noteGap, 0, 40, 0);
        return migrateFlat({ trackWidth: legacy.trackWidth, noteHeight: Math.round((100 - oldGap * 1.25) * 0.5), noteWidth: skinDefaults.default.noteWidth, scrollSpeed: defaults.scrollSpeed, guides: true, noteSkin: 'default' });
      }
    } catch {}
    return freshDefaults();
  }

  let settings = load();
  let lastLaneCount = currentLaneCount();

  function activeSkinSettings() { return settings.skins[settings.noteSkin]; }
  function currentLaneCount() {
    const value = Number.parseInt(gameShell.style.getPropertyValue('--lanes'), 10);
    return [4, 5, 6, 7].includes(value) ? value : 4;
  }
  function effectiveLaneColor(skin, count, lane) { return skin.laneOverrides?.[count]?.[lane] || skin.color; }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {} }

  function renderLaneColorControls() {
    const count = currentLaneCount();
    const skin = activeSkinSettings();
    laneColorTitle.textContent = `${count}K 轨道颜色`;
    laneColorGrid.innerHTML = '';
    for (let lane = 0; lane < count; lane++) {
      const item = document.createElement('div');
      item.className = 'lane-color-item';
      const presets = COLOR_PRESETS.map(color => `<button type="button" class="lane-color-preset" data-lane-preset="${color}" data-lane="${lane}" title="${color.toUpperCase()}" style="background:${color}"></button>`).join('');
      item.innerHTML = `<span>轨道 ${lane + 1}</span><input type="color" data-lane-color="${lane}" value="${effectiveLaneColor(skin, count, lane)}"><div class="lane-color-presets" aria-label="轨道 ${lane + 1} 预设颜色">${presets}</div>`;
      laneColorGrid.appendChild(item);
    }
  }

  function apply() {
    const skin = activeSkinSettings();
    const laneCount = currentLaneCount();

    trackWidthInput.value = String(settings.trackWidth);
    noteHeightInput.value = String(skin.noteHeight);
    noteWidthInput.value = String(skin.noteWidth);
    scrollSpeedInput.value = String(settings.scrollSpeed);
    guideLinesInput.checked = settings.guides;
    noteColorInput.value = skin.color;
    noteEffectsInput.checked = settings.noteEffects;

    trackWidthValue.textContent = `${settings.trackWidth} px`;
    noteHeightValue.textContent = `${Math.round(skin.noteHeight)}%`;
    noteWidthValue.textContent = `${Math.round(skin.noteWidth)}%`;
    scrollSpeedValue.textContent = `${settings.scrollSpeed.toFixed(2)}×`;
    guideLinesValue.textContent = settings.guides ? '开启' : '关闭';
    noteColorValue.textContent = skin.color.toUpperCase();
    noteEffectsValue.textContent = settings.noteEffects ? '开启' : '关闭';
    brickShapeControl.hidden = settings.noteSkin !== 'default';

    for (const button of noteSkinRow.querySelectorAll('[data-note-skin]')) {
      const active = button.dataset.noteSkin === settings.noteSkin;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    for (const button of brickShapeRow.querySelectorAll('[data-brick-shape]')) {
      const active = settings.noteSkin === 'default' && button.dataset.brickShape === skin.shape;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }

    const inverseScroll = 1 / settings.scrollSpeed;
    const noteHeightScale = (skin.noteHeight / 100) * inverseScroll;
    gameShell.style.setProperty('--track-width', `${settings.trackWidth}px`);
    gameShell.style.setProperty('--scroll-speed', String(settings.scrollSpeed));
    gameShell.style.setProperty('--scroll-inverse', String(inverseScroll));
    gameShell.style.setProperty('--note-height-scale', String(noteHeightScale));
    gameShell.style.setProperty('--note-width', `${skin.noteWidth}%`);
    gameShell.style.setProperty('--note-color', skin.color);
    for (let lane = 0; lane < 7; lane++) gameShell.style.setProperty(`--lane-color-${lane + 1}`, effectiveLaneColor(skin, laneCount, lane));

    gameShell.classList.toggle('guides-off', !settings.guides);
    gameShell.classList.toggle('skin-ball', settings.noteSkin === 'ball');
    gameShell.classList.toggle('brick-soft', settings.noteSkin === 'default' && skin.shape === 'soft');
    gameShell.classList.toggle('brick-square', settings.noteSkin === 'default' && skin.shape === 'square');
    gameShell.classList.toggle('note-effects', settings.noteEffects);

    renderLaneColorControls();
  }

  trackWidthInput.addEventListener('input', () => { settings.trackWidth = clamp(trackWidthInput.value, limits.trackWidth.min, limits.trackWidth.max, defaults.trackWidth); save(); apply(); });
  noteHeightInput.addEventListener('input', () => { const skin = activeSkinSettings(); skin.noteHeight = clamp(noteHeightInput.value, limits.noteHeight.min, limits.noteHeight.max, skinDefaults[settings.noteSkin].noteHeight); save(); apply(); });
  noteWidthInput.addEventListener('input', () => { const skin = activeSkinSettings(); skin.noteWidth = clamp(noteWidthInput.value, limits.noteWidth.min, limits.noteWidth.max, skinDefaults[settings.noteSkin].noteWidth); save(); apply(); });
  scrollSpeedInput.addEventListener('input', () => { settings.scrollSpeed = snapScrollSpeed(scrollSpeedInput.value); save(); apply(); });
  guideLinesInput.addEventListener('change', () => { settings.guides = guideLinesInput.checked; save(); apply(); });
  noteEffectsInput.addEventListener('change', () => { settings.noteEffects = noteEffectsInput.checked; save(); apply(); });

  noteColorInput.addEventListener('input', () => { const skin = activeSkinSettings(); skin.color = normalizeColor(noteColorInput.value, skinDefaults[settings.noteSkin].color); save(); apply(); });
  noteColorPresets.addEventListener('click', event => { const button = event.target.closest('[data-note-preset]'); if (!button) return; activeSkinSettings().color = normalizeColor(button.dataset.notePreset, skinDefaults[settings.noteSkin].color); save(); apply(); });

  laneColorGrid.addEventListener('input', event => {
    const input = event.target.closest('[data-lane-color]');
    if (!input) return;
    const count = currentLaneCount();
    const lane = Number(input.dataset.laneColor);
    if (!Number.isInteger(lane) || lane < 0 || lane >= count) return;
    activeSkinSettings().laneOverrides[count][lane] = normalizeColor(input.value, activeSkinSettings().color);
    save();
    apply();
  });

  laneColorGrid.addEventListener('click', event => {
    const button = event.target.closest('[data-lane-preset]');
    if (!button) return;
    const count = currentLaneCount();
    const lane = Number(button.dataset.lane);
    if (!Number.isInteger(lane) || lane < 0 || lane >= count) return;
    activeSkinSettings().laneOverrides[count][lane] = normalizeColor(button.dataset.lanePreset, activeSkinSettings().color);
    save();
    apply();
  });

  resetLaneColorsButton.addEventListener('click', () => {
    const count = currentLaneCount();
    activeSkinSettings().laneOverrides[count] = cloneLaneOverrides(makeDefaultLaneOverrides())[count];
    save();
    apply();
  });

  brickShapeRow.addEventListener('click', event => { const button = event.target.closest('[data-brick-shape]'); if (!button || settings.noteSkin !== 'default') return; activeSkinSettings().shape = normalizeShape(button.dataset.brickShape); save(); apply(); });
  noteSkinRow.addEventListener('click', event => { const button = event.target.closest('[data-note-skin]'); if (!button) return; settings.noteSkin = normalizeSkin(button.dataset.noteSkin); save(); apply(); });
  resetButton.addEventListener('click', () => { settings = freshDefaults(); save(); apply(); });

  const laneObserver = new MutationObserver(() => {
    const count = currentLaneCount();
    if (count === lastLaneCount) return;
    lastLaneCount = count;
    apply();
  });
  laneObserver.observe(gameShell, { attributes: true, attributeFilter: ['style'] });

  window.WuyueRhythmDisplaySettings = {
    get() {
      const skin = activeSkinSettings();
      return {
        ...settings,
        noteHeight: skin.noteHeight,
        noteWidth: skin.noteWidth,
        noteColor: skin.color,
        noteEffects: settings.noteEffects,
        brickShape: skin.shape || null,
        laneColors: Array.from({ length: currentLaneCount() }, (_, lane) => effectiveLaneColor(skin, currentLaneCount(), lane))
      };
    }
  };

  save();
  apply();
})();
