import {captureControls, restoreControls, savedRecords} from './uiux-session.mjs?v=3ba308e9f6f1';
// Keep completed observations across experiments; never resume a live reaction timer.
const $ = (root, selector) => root.querySelector(selector);
const $$ = (root, selector) => [...root.querySelectorAll(selector)];
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const ms = value => `${Math.round(value).toLocaleString('ko-KR')} ms`;
const inputName = value => value === 'keyboard' ? '키보드' : value === 'touch' ? '터치' : value === 'pen' ? '펜' : '마우스';
function revealStage(stage) { if (window.innerWidth <= 700) stage.scrollIntoView({ block: 'start', behavior: 'instant' }); }
function random(seed) { let state = seed >>> 0; return () => { state += 0x6D2B79F5; let n = state; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; }; }
function shuffled(items, rng) { const out = [...items]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }
function scope({ stage, controls, signal, announce }) {
  const local = new AbortController(); const timers = new Set(); const finalizers = [];
  stage.classList.add('uiux-behavior-stage'); controls.classList.add('uiux-behavior-controls');
  const clean = () => { if (local.signal.aborted) return; local.abort(); timers.forEach(clearTimeout); timers.clear(); finalizers.forEach(fn => fn()); stage.classList.remove('uiux-behavior-stage'); controls.classList.remove('uiux-behavior-controls'); signal?.removeEventListener('abort', clean); };
  if (signal?.aborted) clean(); else signal?.addEventListener('abort', clean, { once: true });
  return { stage, controls, clean, active: () => !local.signal.aborted,
    on: (el, event, fn, options = {}) => el.addEventListener(event, fn, { ...options, signal: local.signal }),
    later: (fn, delay) => { const id = setTimeout(() => { timers.delete(id); if (!local.signal.aborted) fn(); }, delay); timers.add(id); return id; },
    cancel: () => { timers.forEach(clearTimeout); timers.clear(); },
    dispose: fn => finalizers.push(fn),
    say: message => {
      if (local.signal.aborted) return;
      let live = stage.querySelector('[data-sr-live]');
      if (!live) { live = document.createElement('p'); live.className = 'sr-only'; live.dataset.srLive = ''; live.setAttribute('aria-live', 'polite'); stage.append(live); }
      live.textContent = ''; setTimeout(() => { if (!local.signal.aborted) live.textContent = message; }, 40);
    }
  };
}
function status(root, message) { $(root, '[data-status]').textContent = message; }
function rememberPointer(ctx, el) { let pointer = 'mouse'; ctx.on(el, 'pointerdown', e => { pointer = e.pointerType || 'mouse'; }); return e => e.detail === 0 ? 'keyboard' : pointer; }
function history(root, rows, empty = '아직 기록이 없습니다. 한 번 실행해 보세요.') {
  const list = $(root, '[data-history]'); list.replaceChildren();
  if (!rows.length) { const p = document.createElement('p'); p.className = 'control-note'; p.textContent = empty; list.append(p); return; }
  for (const text of rows) { const p = document.createElement('p'); p.className = 'bh-history-row'; p.textContent = text; list.append(p); }
}
const resetButton = '<button type="button" class="lab-button" data-reset>내 기록 지우기</button>';
const endNote = '<p class="experiment-caption">조정값과 완료한 기록은 이 탭에 남습니다. 진행 중 측정은 화면을 떠나면 중단됩니다. 개인의 관찰 기록으로, 보편적인 법칙을 검증하는 결과는 아닙니다.</p>';
const mountedState = (ctx, extra) => ({ cleanup: ctx.clean, getState: () => ({ controls: captureControls(ctx.controls), ...extra() }) });
const restoredNotice = (stage, state) => { if (state?.interrupted) status(stage, '화면을 떠나 진행 중 측정은 중단됐습니다. 조정값과 완료한 기록은 남아 있습니다.'); };

function mountHick(args) {
  const ctx = scope(args); const { stage, controls } = ctx;
  const symbols = ['●', '▲', '■', '◆', '★', '☾', '＋', '☰'];
  const names = ['원', '삼각형', '정사각형', '마름모', '별', '초승달', '더하기', '세 줄'];
  controls.innerHTML = `<div class="control-group"><label class="control-label" for="bh-hick-count">선택지 수</label><select id="bh-hick-count" data-count><option value="2">2개</option><option value="4">4개</option><option value="8">8개</option></select></div><div class="control-group"><label class="control-label" for="bh-hick-input">입력 방법</label><select id="bh-hick-input" data-input><option value="pointer">터치 / 마우스</option><option value="keyboard">숫자키 1–8</option></select><p class="control-note">기호와 키의 짝은 고정됩니다. 키보드 실험은 숫자키로만 응답합니다.</p></div><div class="control-actions"><button type="button" class="lab-button primary" data-start>테스트 시작</button>${resetButton}</div><p class="control-note">조건마다 연습 2회 후 8회를 기록합니다. 기록 구간에서 각 기호는 같은 횟수로 나옵니다.</p>`;
  stage.innerHTML = `<div class="bh-experiment bh-hick" tabindex="0" aria-label="기호 선택 실험. 숫자키로 응답할 수 있습니다."><div class="mini-label" data-progress>먼저 기호와 키의 짝을 살펴보세요</div><div class="bh-stimulus" data-stimulus aria-label="아직 제시된 기호 없음">?</div><p class="readout" data-status role="status" aria-live="polite">선택지 수와 입력 방법을 고른 뒤 ‘테스트 시작’을 누르세요.</p><div class="bh-stage-actions"><button type="button" class="lab-button primary" data-stage-start>테스트 시작</button></div><div class="bh-choice-grid" data-choices></div><div class="bh-results"><h3 class="mini-label">내 조건별 기록</h3><div data-history></div></div><p class="experiment-caption">이 실험은 고정된 자극–응답 매핑의 선택 반응을 관찰합니다. 기록은 기호가 나온 순간부터 정답 선택까지 걸린 시간이며, 오답을 고치는 시간도 포함됩니다. 버튼 입력에는 시각 탐색과 손의 이동도 포함됩니다. 목록 검색 속도와 힉 법칙을 동일하게 해석하지 않습니다.</p>${endNote}</div>`;
  const board = $(stage, '.bh-experiment'); let phase = 'idle', n = 2, method = 'pointer', trial = 0, target = 0, shownAt = 0, wrong = 0, anticipations = 0, deck = [], seed = 19052;
  const records = savedRecords(args.state); const start = $(controls, '[data-start]'); const count = $(controls, '[data-count]'); const input = $(controls, '[data-input]');
  function renderChoices() { const choices = $(stage, '[data-choices]'); choices.innerHTML = symbols.map((symbol, i) => `<button type="button" class="lab-button bh-choice" data-choice="${i}" aria-label="${i + 1}번 ${names[i]}" ${i >= n ? 'hidden' : ''}><span aria-hidden="true">${symbol}</span><span class="bh-key">${i + 1}</span></button>`).join(''); }
  const stageStart = $(stage, '[data-stage-start]'); let runRecorded = 0;
  function setRunning(running, idleLabel = '테스트 시작') { count.disabled = running; input.disabled = running; start.textContent = running ? '테스트 중단' : idleLabel; start.classList.toggle('primary', !running); stageStart.textContent = idleLabel; stageStart.parentElement.hidden = running; }
  function idleStimulus() { $(stage, '[data-stimulus]').textContent = '?'; $(stage, '[data-stimulus]').setAttribute('aria-label', '아직 제시된 기호 없음'); }
  function stop(message) { ctx.cancel(); phase = 'idle'; trial = 0; setRunning(false); idleStimulus(); $(stage, '[data-progress]').textContent = '테스트를 중단했습니다'; status(stage, message); }
  function showHistory() { const groups = new Map(); records.forEach(r => { const key = `${r.n}개 · ${inputName(r.device)}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); }); history(stage, [...groups].map(([key, values]) => `${key} · ${values.length}회 · 정답 선택까지 평균 ${ms(mean(values.map(v => v.time)))} · 오답 ${values.reduce((s, v) => s + v.wrong, 0)}회`)); }
  function finish() { phase = 'done'; setRunning(false, '다시 테스트'); $(stage, '[data-stimulus]').textContent = '완료'; $(stage, '[data-stimulus]').setAttribute('aria-label', '테스트 완료'); status(stage, `8회 기록 완료. 신호 전 응답 ${anticipations}회. 선택지 수를 바꿔 다시 테스트하고 비교해 보세요.`); }
  function next() {
    if (trial >= 10) { finish(); return; }
    phase = 'waiting'; target = deck[trial]; wrong = 0;
    $(stage, '[data-progress]').textContent = trial < 2 ? `연습 ${trial + 1} / 2 · 기록 제외` : `${n}개 선택지 · 기록 ${trial - 1} / 8`;
    $(stage, '[data-stimulus]').textContent = '…'; $(stage, '[data-stimulus]').setAttribute('aria-label', '기호가 나올 때까지 기다리세요'); status(stage, '기호가 나오면 응답하세요.');
    ctx.later(() => { $(stage, '[data-stimulus]').textContent = symbols[target]; $(stage, '[data-stimulus]').setAttribute('aria-label', names[target]); phase = 'active'; shownAt = performance.now(); ctx.say(names[target]); }, 650 + (trial % 3) * 170);
  }
  function respond(choice, device) {
    if (phase === 'waiting') { anticipations++; status(stage, '아직 기호가 나오지 않았습니다. 잠시 기다려주세요.'); return; }
    if (phase !== 'active') return;
    if ((method === 'keyboard') !== (device === 'keyboard')) { status(stage, method === 'keyboard' ? '이 조건은 숫자키로 응답합니다.' : '이 조건은 터치나 마우스로 응답합니다.'); return; }
    if (choice !== target) { wrong++; status(stage, `다른 기호입니다. 오답 ${wrong}회. 제시된 기호를 다시 확인하세요.`); return; }
    const elapsed = performance.now() - shownAt; phase = 'feedback';
    if (trial >= 2) { records.push({ n, device, time: elapsed, wrong }); runRecorded++; showHistory(); }
    status(stage, `${trial < 2 ? '연습' : '이번 기록'} · 정답 선택까지 ${ms(elapsed)} · 오답 ${wrong}회`); trial++; ctx.later(next, 850);
  }
  const device = rememberPointer(ctx, board);
  ctx.on(board, 'click', e => { const button = e.target.closest('[data-choice]'); if (button) respond(Number(button.dataset.choice), device(e)); });
  ctx.on(board, 'keydown', e => { if (/^[1-8]$/.test(e.key) && Number(e.key) <= n && !e.repeat) { e.preventDefault(); respond(Number(e.key) - 1, 'keyboard'); } });
  function begin() { n = Number(count.value); method = input.value; trial = 0; anticipations = 0; runRecorded = 0; const rng = random(seed); deck = [Math.floor(rng() * n), Math.floor(rng() * n), ...shuffled(Array.from({ length: 8 }, (_, i) => i % n), rng)]; renderChoices(); setRunning(true); revealStage(stage); board.focus({ preventScroll: true }); next(); }
  const running = () => ['waiting', 'active', 'feedback'].includes(phase);
  ctx.on(start, 'click', () => { if (running()) stop(runRecorded ? `테스트를 중단했습니다. 이번 테스트에서 끝낸 기록 ${runRecorded}회는 남아 있습니다.` : '테스트를 중단했습니다. 이번 테스트의 기록은 없습니다.'); else begin(); });
  ctx.on(stageStart, 'click', () => { if (!running()) begin(); });
  ctx.on(count, 'change', () => { n = Number(count.value); renderChoices(); status(stage, '‘테스트 시작’을 누르면 연습 2회부터 진행합니다.'); });
  ctx.on($(controls, '[data-reset]'), 'click', () => { ctx.cancel(); records.length = 0; seed = 19052; phase = 'idle'; trial = 0; setRunning(false); idleStimulus(); $(stage, '[data-progress]').textContent = '기호와 키의 짝을 다시 살펴보세요'; status(stage, '기록을 지웠습니다. ‘테스트 시작’을 누르면 같은 자극 순서로 다시 시작합니다.'); showHistory(); });
  ctx.on(document, 'visibilitychange', () => { if (document.hidden && running()) stop('화면을 벗어나 테스트를 중단했습니다. 끝낸 기록만 남습니다.'); });
  restoreControls(controls, args.state?.controls); n = Number(count.value); method = input.value;
  renderChoices(); showHistory(); restoredNotice(stage, args.state);
  return mountedState(ctx, () => ({ records, interrupted: ['waiting', 'active', 'feedback'].includes(phase) }));
}

function mountFitts(args) {
  const ctx = scope(args); const { stage, controls } = ctx;
  controls.innerHTML = `<div class="control-group"><label class="control-label" for="bh-fitts-variable">이번에 바꿀 변수</label><select id="bh-fitts-variable" data-variable><option value="width">목표 너비 W · 거리는 고정</option><option value="distance">거리 D · 너비는 고정</option></select></div><div class="control-group"><label class="control-label" for="bh-fitts-level" data-level-label>목표 너비</label><select id="bh-fitts-level" data-level></select><p class="control-note" data-fixed></p></div><div class="control-actions">${resetButton}</div><p class="control-note">출발 버튼을 누른 뒤 목표를 누르세요. 같은 조건에서 여러 번 반복한 기록을 비교합니다.</p>`;
  stage.innerHTML = `<div class="bh-experiment"><div class="mini-label" data-geometry></div><div class="bh-fitts-field" data-field><div class="bh-distance-line" aria-hidden="true"></div><button type="button" class="lab-button bh-fitts-start" data-origin aria-label="출발. 누른 뒤 목표를 누르세요.">출발</button><button type="button" class="bh-fitts-target" data-target disabled aria-label="목표"><span aria-hidden="true">◎</span></button></div><p class="readout" data-status role="status" aria-live="polite">출발 → 목표. 첫 기록을 만들어 보세요.</p><div class="bh-results"><h3 class="mini-label">내 조건별 기록</h3><div data-history></div></div><p class="experiment-caption">D는 두 버튼의 중심 거리, W는 이동 방향의 목표 너비입니다. 실제 화면의 px로 기록합니다. 창 크기와 입력 도구를 유지해 비교하세요.</p><p class="experiment-caption">Tab과 Enter로도 조작할 수 있습니다. 키보드 조작 시간은 포인터 이동 시간에 합치지 않습니다.</p>${endNote}</div>`;
  const variable = $(controls, '[data-variable]'); const level = $(controls, '[data-level]'); const field = $(stage, '[data-field]'); const origin = $(stage, '[data-origin]'); const target = $(stage, '[data-target]');
  let active = false, time = 0, misses = 0, width = 48, distance = 180, startDevice = 'mouse'; const records = savedRecords(args.state); let lastSize = 0;
  const device = rememberPointer(ctx, field);
  function draw() { const available = Math.max(1, field.clientWidth - 36 - 40 - 12); width = variable.value === 'width' ? Number(level.value) : 48; distance = Math.min(variable.value === 'distance' ? Number(level.value) : 180, available); target.style.width = `${width}px`; target.style.left = `${36 + distance}px`; field.style.setProperty('--bh-distance', `${distance}px`); $(stage, '[data-geometry]').textContent = `거리 D ${Math.round(distance)} px · 목표 너비 W ${width} px`; $(controls, '[data-fixed]').textContent = variable.value === 'width' ? `거리 ${Math.round(distance)} px 고정. 목표 높이는 64 px입니다.` : `목표 너비 48 px 고정. 화면이 좁으면 거리가 화면 안으로 조정됩니다.`; lastSize = field.clientWidth; }
  function options() { level.innerHTML = variable.value === 'width' ? '<option value="24">24 px</option><option value="48" selected>48 px</option><option value="80">80 px</option>' : '<option value="80">80 px</option><option value="140" selected>140 px</option><option value="220">220 px</option>'; $(controls, '[data-level-label]').textContent = variable.value === 'width' ? '목표 너비 W' : '중심 거리 D'; draw(); }
  function unlock() { active = false; variable.disabled = false; level.disabled = false; target.disabled = true; origin.disabled = false; field.classList.remove('is-running'); }
  function showHistory() { const groups = new Map(); records.forEach(r => { const key = `D ${r.distance} / W ${r.width} px · ${inputName(r.device)}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); }); history(stage, [...groups].map(([key, rows]) => `${key} · ${rows.length}회 · 평균 ${ms(mean(rows.map(r => r.time)))} · 빗나감 ${rows.reduce((s, r) => s + r.misses, 0)}회`)); }
  ctx.on(origin, 'click', e => { e.stopPropagation(); draw(); misses = 0; startDevice = device(e); active = true; time = performance.now(); variable.disabled = true; level.disabled = true; origin.disabled = true; target.disabled = false; field.classList.add('is-running'); status(stage, '목표를 누르세요. 빗나감 0회'); if (startDevice === 'keyboard') target.focus({ preventScroll: true }); });
  ctx.on(target, 'click', e => { e.stopPropagation(); if (!active) return; const elapsed = performance.now() - time; const endDevice = device(e); unlock(); if (startDevice === 'keyboard' || endDevice === 'keyboard') { status(stage, '키보드 연습 완료 · 포인터 이동 기록에서 제외'); } else if (startDevice !== endDevice) { status(stage, '입력 도구가 바뀌어 이번 기록은 제외했습니다.'); } else { records.push({ width, distance: Math.round(distance), device: endDevice, time: elapsed, misses }); showHistory(); status(stage, `${ms(elapsed)} · 빗나감 ${misses}회 · ${inputName(endDevice)}`); } });
  ctx.on(field, 'click', e => { if (active && !e.target.closest('[data-origin], [data-target]')) { misses++; status(stage, `목표를 다시 눌러주세요. 빗나감 ${misses}회`); } });
  ctx.on(variable, 'change', () => { options(); status(stage, '한 변수만 바뀝니다. 출발 버튼으로 시작하세요.'); }); ctx.on(level, 'change', draw);
  ctx.on($(controls, '[data-reset]'), 'click', () => { unlock(); records.length = 0; draw(); showHistory(); status(stage, '기록을 지웠습니다. 출발 버튼으로 다시 시작하세요.'); });
  if (typeof ResizeObserver !== 'undefined') { const observer = new ResizeObserver(() => { if (lastSize && Math.abs(lastSize - field.clientWidth) > 1 && active) { unlock(); status(stage, '화면 크기가 바뀌어 이번 이동을 취소했습니다. 출발부터 다시 시작하세요.'); } draw(); }); observer.observe(field); ctx.dispose(() => observer.disconnect()); }
  ctx.on(document, 'visibilitychange', () => { if (document.hidden && active) { unlock(); status(stage, '화면을 벗어나 이번 이동을 취소했습니다.'); } });
  restoreControls(controls, args.state?.controls); options(); restoreControls(controls, args.state?.controls); draw(); showHistory(); restoredNotice(stage, args.state);
  return mountedState(ctx, () => ({ records, interrupted: active }));
}

const jakobItems = [
  { id: 'home', icon: '⌂', name: '홈', task: '서비스 첫 화면으로 돌아가세요.' },
  { id: 'search', icon: '⌕', name: '검색', task: '필요한 장비를 찾아보세요.' },
  { id: 'cart', icon: '▣', name: '장바구니', task: '담아 둔 장비 목록을 확인하세요.' },
  { id: 'account', icon: '○', name: '내 정보', task: '내 계정 정보를 확인하세요.' }
];
function mountJakob(args) {
  const ctx = scope(args); const { stage, controls } = ctx;
  controls.innerHTML = `<div class="control-group"><label class="control-label" for="bh-jakob-layout">비교할 배치</label><select id="bh-jakob-layout" data-layout><option value="learned">연습한 배치</option><option value="changed">순서를 바꾼 배치</option></select><p class="control-note">먼저 4회 연습합니다. 비교에서는 메뉴 이름·크기와 과제 순서를 유지하고 위치만 바꿉니다.</p></div><div class="control-actions"><button type="button" class="lab-button primary" data-start>기본 배치 4회 연습</button>${resetButton}</div><p class="control-note">연습 뒤에는 두 조건을 번갈아 실행해 보세요. 시작 순서와 반복 학습도 결과에 영향을 줍니다.</p>`;
  stage.innerHTML = `<div class="bh-experiment"><div class="mini-label" data-progress>장비 대여 서비스 · 메뉴 찾기</div><p class="bh-task" data-task>기본 배치부터 익혀봅니다.</p><div class="bh-shop demo-card"><div class="bh-shop-heading"><span>GEAR ROOM</span><span class="control-note">메뉴 탐색 체험</span></div><nav class="bh-jakob-menu" aria-label="실험용 장비 서비스 메뉴" data-menu></nav><div class="bh-shop-content" aria-hidden="true"><span>CAMERA</span><span>LIGHT</span><span>AUDIO</span></div></div><p class="readout" data-status role="status" aria-live="polite">‘기본 배치 4회 연습’을 눌러 시작하세요.</p><div class="bh-results"><h3 class="mini-label">내 배치별 기록</h3><div data-history></div></div><p class="experiment-caption">다른 제품에서 익힌 기대와, 이 실험에서 방금 배운 위치를 구분해 보세요. 낯선 배치를 나쁜 디자인으로 단정하지 않습니다. 이 기록에는 탐색·이동·학습 효과가 함께 들어갑니다.</p>${endNote}</div>`;
  const layout = $(controls, '[data-layout]'); const start = $(controls, '[data-start]'); const menu = $(stage, '[data-menu]'); const device = rememberPointer(ctx, menu);
  let trained = args.state?.trained === true, running = false, busy = false, training = true, round = 0, wrong = 0, began = 0, condition = 'learned', target = '', order = []; const records = savedRecords(args.state);
  function renderMenu() { const order = condition === 'changed' ? [2, 0, 3, 1] : [0, 1, 2, 3]; menu.innerHTML = order.map(i => `<button type="button" class="lab-button bh-menu-item" data-item="${jakobItems[i].id}"><span aria-hidden="true">${jakobItems[i].icon}</span>${jakobItems[i].name}</button>`).join(''); }
  function summary() { const groups = new Map(); records.forEach(r => { const key = `${r.condition === 'learned' ? '연습한 배치' : '바꾼 배치'} · ${inputName(r.device)}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); }); history(stage, [...groups].map(([key, rows]) => `${key} · ${rows.length}회 · 평균 ${ms(mean(rows.map(r => r.time)))} · 잘못 선택 ${rows.reduce((s, r) => s + r.wrong, 0)}회`)); }
  const idleLabel = () => trained ? '선택한 배치 4회 실행' : '기본 배치 4회 연습';
  function setBusy(value) { busy = value; layout.disabled = value; start.textContent = value ? '중단' : idleLabel(); start.classList.toggle('primary', !value); }
  function next() { if (round >= 4) { running = false; if (training) trained = true; setBusy(false); $(stage, '[data-task]').textContent = training ? '배치를 익혔습니다. 두 조건을 비교해 보세요.' : '4회 완료. 다른 배치도 실행해 보세요.'; status(stage, training ? '연습 기록은 비교에서 제외했습니다.' : '이번 조건의 기록을 아래에 합쳤습니다.'); return; } wrong = 0; target = order[round]; const item = jakobItems.find(item => item.id === target); $(stage, '[data-progress]').textContent = `${training ? '연습 · 기록 제외' : condition === 'learned' ? '연습한 배치' : '바꾼 배치'} · ${round + 1} / 4`; $(stage, '[data-task]').textContent = item.task; status(stage, '알맞은 메뉴를 선택하세요.'); running = true; began = performance.now(); ctx.say(item.task); }
  function stop(message) { ctx.cancel(); running = false; setBusy(false); $(stage, '[data-progress]').textContent = '장비 대여 서비스 · 메뉴 찾기'; $(stage, '[data-task]').textContent = trained ? '배치를 익혔습니다. 두 조건을 비교해 보세요.' : '기본 배치부터 익혀봅니다.'; status(stage, message); }
  ctx.on(start, 'click', () => { if (busy) { stop(training ? '연습을 중단했습니다. 다시 연습할 수 있습니다.' : '중단했습니다. 끝낸 회차의 기록은 남아 있습니다.'); return; } training = !trained; condition = training ? 'learned' : layout.value; round = 0; order = shuffled(jakobItems.map(item => item.id), random(41024)); setBusy(true); renderMenu(); revealStage(stage); next(); });
  ctx.on(menu, 'click', e => { const button = e.target.closest('[data-item]'); if (!button || !running) return; if (button.dataset.item !== target) { wrong++; status(stage, `다른 메뉴입니다. 잘못 선택 ${wrong}회. 과제를 다시 읽어보세요.`); return; } const elapsed = performance.now() - began; if (!training) records.push({ condition, device: device(e), time: elapsed, wrong }); running = false; status(stage, `${training ? '연습' : '이번 기록'} ${ms(elapsed)} · 잘못 선택 ${wrong}회`); summary(); round++; ctx.later(next, 1000); });
  ctx.on(layout, 'change', () => { if (trained) { condition = layout.value; renderMenu(); } });
  ctx.on($(controls, '[data-reset]'), 'click', () => { ctx.cancel(); records.length = 0; trained = false; running = false; training = true; condition = 'learned'; round = 0; layout.value = 'learned'; setBusy(false); renderMenu(); summary(); $(stage, '[data-progress]').textContent = '장비 대여 서비스 · 메뉴 찾기'; $(stage, '[data-task]').textContent = '기본 배치부터 익혀봅니다.'; status(stage, '기록을 지웠습니다. 다시 연습할 수 있습니다.'); });
  ctx.on(document, 'visibilitychange', () => { if (document.hidden && busy) stop('화면을 벗어나 이번 진행을 멈췄습니다. 끝낸 기록만 남습니다.'); });
  restoreControls(controls, args.state?.controls);
  if (trained) { condition = layout.value; start.textContent = '선택한 배치 4회 실행'; $(stage, '[data-task]').textContent = '배치를 익혔습니다. 두 조건을 비교해 보세요.'; status(stage, '선택한 배치로 다시 실행할 수 있습니다.'); }
  renderMenu(); summary(); restoredNotice(stage, args.state);
  return mountedState(ctx, () => ({ records, trained, interrupted: busy }));
}

function mountMiller(args) {
  const ctx = scope(args); const { stage, controls } = ctx;
  controls.innerHTML = `<div class="control-group"><label class="control-label" for="bh-miller-count">숫자 길이</label><select id="bh-miller-count" data-count><option value="6">6자리</option><option value="9" selected>9자리</option><option value="12">12자리</option></select><p class="control-note">두 표시 방식 모두 4초간 보여줍니다. 길이를 바꾸면 현재 비교 기록이 초기화됩니다.</p></div><div class="control-group"><span class="control-label">이번 비교 순서</span><p class="control-note" data-order></p></div><div class="control-actions"><button type="button" class="lab-button primary" data-start>4초 보고 기억하기</button>${resetButton}</div><p class="control-note">숫자는 매번 달라집니다. 묶음 없음과 3자리씩 구분을 각각 2회 비교합니다.</p>`;
  stage.innerHTML = `<div class="bh-experiment bh-miller"><div class="mini-label" data-progress>숫자 기억 · 4회 비교</div><div class="bh-memory-window" data-window><span class="bh-memory-placeholder">잠깐 보고, 가린 뒤 적어보세요.</span></div><form class="bh-recall" data-form><label class="control-label" for="bh-miller-answer">기억나는 숫자를 순서대로 입력</label><div class="bh-recall-row"><input id="bh-miller-answer" data-answer type="text" inputmode="numeric" autocomplete="off" spellcheck="false" disabled placeholder="숫자를 본 뒤 입력할 수 있어요"><button type="submit" class="lab-button primary" data-check disabled>기록 확인</button></div><p class="control-note">공백과 하이픈은 채점에서 제외합니다. 기억나는 앞부분만 입력해도 됩니다.</p></form><p class="readout" data-status role="status" aria-live="polite">먼저 기억할 준비를 해주세요.</p><div class="bh-results"><h3 class="mini-label">내 회상 기록</h3><div data-history></div></div><p class="experiment-caption">청킹은 여러 정보를 의미 있는 단위로 묶는 과정입니다. 여기서는 시각적 구분의 도움을 관찰합니다. 띄어쓰기만으로 의미 있는 청크가 생기지는 않습니다. ‘7개’를 모든 메뉴와 기억의 한계로 적용하지 않습니다.</p>${endNote}</div>`;
  const count = $(controls, '[data-count]'); const start = $(controls, '[data-start]'); const answer = $(stage, '[data-answer]'); const check = $(stage, '[data-check]'); const win = $(stage, '[data-window]'); const form = $(stage, '[data-form]');
  let round = 0, phase = 'idle', digits = '', length = 9, seed = 71056, conditions = ['plain', 'grouped', 'grouped', 'plain']; const records = [];
  const label = value => value === 'grouped' ? '3자리씩 구분' : '묶음 없음';
  function summary() { history(stage, records.map(r => `${r.round}회 · ${label(r.condition)} · 위치 일치 ${r.correct} / ${length}자리${r.exact ? ' · 전체 일치' : ''}`)); }
  function preview() { $(controls, '[data-order]').textContent = conditions.map(label).join(' → '); $(stage, '[data-progress]').textContent = round < 4 ? `${round + 1} / 4 · ${label(conditions[round])} · ${length}자리 · 4초` : '4회 비교 완료'; }
  function reset(message) { ctx.cancel(); phase = 'idle'; round = 0; length = Number(count.value); digits = ''; records.length = 0; count.disabled = false; start.disabled = false; start.textContent = '4초 보고 기억하기'; answer.disabled = true; check.disabled = true; answer.value = ''; win.innerHTML = '<span class="bh-memory-placeholder">잠깐 보고, 가린 뒤 적어보세요.</span>'; conditions = seed % 2 ? ['plain', 'grouped', 'grouped', 'plain'] : ['grouped', 'plain', 'plain', 'grouped']; preview(); summary(); status(stage, message); }
  ctx.on(start, 'click', () => {
    if (phase !== 'idle' || round >= 4) return;
    revealStage(stage);
    const rng = random(seed + round * 167 + length * 29); digits = Array.from({ length }, () => Math.floor(rng() * 10)).join(''); phase = 'showing'; start.disabled = true; count.disabled = true; answer.value = ''; answer.disabled = true; check.disabled = true; preview();
    win.replaceChildren(); const text = document.createElement('span'); text.className = conditions[round] === 'grouped' ? 'bh-digits is-grouped' : 'bh-digits'; text.textContent = conditions[round] === 'grouped' ? digits.match(/.{1,3}/g).join(' ') : digits; win.append(text); status(stage, '4초 동안 기억해 보세요.'); ctx.say(`숫자 ${text.textContent}. 4초 뒤 가립니다.`);
    ctx.later(() => { phase = 'recall'; win.innerHTML = '<span class="bh-memory-placeholder">이제 기억나는 숫자를 적어보세요.</span>'; answer.disabled = false; check.disabled = false; answer.focus({ preventScroll: true }); status(stage, '숫자를 가렸습니다. 기억나는 순서대로 입력하세요.'); }, 4000);
  });
  ctx.on(form, 'submit', e => { e.preventDefault(); if (phase !== 'recall') return; const raw = answer.value.trim(); if (!raw || /[^0-9\s-]/.test(raw)) { status(stage, '숫자를 한 자리 이상 입력해주세요. 공백과 하이픈도 사용할 수 있습니다.'); answer.focus(); return; } const typed = raw.replace(/[\s-]/g, ''); if (!typed.length || typed.length > length) { status(stage, `${length}자리 이하의 숫자를 입력해주세요.`); answer.focus(); return; } const correct = [...digits].reduce((sum, digit, i) => sum + (digit === typed[i] ? 1 : 0), 0); const condition = conditions[round]; records.push({ round: round + 1, condition, correct, exact: typed === digits }); round++; phase = 'idle'; answer.disabled = true; check.disabled = true; win.replaceChildren(); const solution = document.createElement('p'); solution.className = 'bh-memory-solution'; solution.textContent = `제시한 숫자 ${digits} · 내 입력 ${typed}`; win.append(solution); status(stage, `위치 일치 ${correct} / ${length}자리${typed === digits ? ' · 전체 일치' : ''}`); summary(); if (round < 4) { start.disabled = false; start.textContent = '다음 숫자 보기'; } else { phase = 'done'; start.disabled = true; start.textContent = '4회 비교 완료'; count.disabled = false; const plain = records.filter(r => r.condition === 'plain'), grouped = records.filter(r => r.condition === 'grouped'); status(stage, `4회 완료 · 묶음 없음 평균 ${mean(plain.map(r => r.correct)).toFixed(1)}자리 · 3자리 구분 평균 ${mean(grouped.map(r => r.correct)).toFixed(1)}자리. ‘내 기록 지우기’로 새 숫자를 다시 비교할 수 있습니다.`); } preview(); });
  ctx.on(count, 'change', () => { seed++; reset('길이가 바뀌어 비교 기록을 초기화했습니다.'); });
  ctx.on($(controls, '[data-reset]'), 'click', () => { seed++; reset('기록을 지웠습니다. 새 숫자와 반대 순서로 시작합니다.'); });
  ctx.on(document, 'visibilitychange', () => { if (document.hidden && (phase === 'showing' || phase === 'recall')) { ctx.cancel(); phase = 'idle'; answer.disabled = true; check.disabled = true; start.disabled = false; seed++; win.innerHTML = '<span class="bh-memory-placeholder">화면을 벗어나 이번 숫자를 취소했습니다.</span>'; status(stage, '완료된 기록은 남습니다. 새 숫자로 이어갈 수 있습니다.'); } });
  restoreControls(controls, args.state?.controls);
  reset('준비되면 ‘4초 보고 기억하기’를 누르세요. 숫자는 4초 뒤 가려집니다.');
  if (args.state) {
    records.push(...savedRecords(args.state).slice(0, 4)); round = records.length;
    if (Number.isSafeInteger(args.state.seed)) seed = args.state.seed;
    if (Array.isArray(args.state.conditions) && args.state.conditions.length === 4 && args.state.conditions.every(item => ['plain', 'grouped'].includes(item))) conditions = [...args.state.conditions];
    phase = round === 4 ? 'done' : 'idle'; start.disabled = round === 4; count.disabled = round > 0 && round < 4;
    if (round > 0) start.textContent = round === 4 ? '4회 비교 완료' : '다음 숫자 보기';
    preview(); summary(); restoredNotice(stage, args.state);
    if (round === 4) status(stage, '4회 비교 기록을 불러왔습니다. ‘내 기록 지우기’로 다시 시작할 수 있습니다.');
  }
  return mountedState(ctx, () => { const interrupted = phase === 'showing' || phase === 'recall'; return { records, seed: seed + (interrupted ? 1 : 0), conditions, interrupted }; });
}

export const behaviorModules = [
  { id: 'hick', title: '힉의 법칙', en: "Hick’s Law", week: 4, category: '사용성 법칙', summary: '선택 반응에서는 가능한 응답의 불확실성이 결정 시간에 영향을 줍니다.', prompt: '선택지가 늘어날 때, 정답 선택까지 걸린 시간과 오답은 함께 어떻게 바뀌나요?', applications: { service: '자주 하는 과제의 선택지를 명확히 분류하고, 선택에 필요한 정보를 먼저 보여줍니다.', game: '상황에 맞는 명령을 구분하고, 익숙해질 수 있는 입력 매핑을 유지합니다.' }, sources: [{ title: 'Hick (1952), On the Rate of Gain of Information', url: 'https://journals.sagepub.com/doi/10.1080/17470215208416600' }], mount: mountHick },
  { id: 'fitts', title: '피츠의 법칙', en: "Fitts’s Law", week: 4, category: '사용성 법칙', summary: '목표까지의 거리와 이동 방향의 목표 너비가 포인터 이동 시간에 영향을 줍니다.', prompt: '거리 또는 너비 하나만 바꾸면, 이동 시간과 빗나감은 어떻게 달라지나요?', applications: { service: '자주 누르는 버튼의 실제 클릭 영역과, 작업 위치에서의 거리를 함께 살펴봅니다.', game: '정확히 눌러야 하는 조작부의 크기와 배치를 입력 도구에 맞춰 조정합니다.' }, sources: [{ title: 'NN/g, Fitts’s Law and Its Applications in UX', url: 'https://www.nngroup.com/articles/fitts-law/' }], mount: mountFitts },
  { id: 'jakob', title: '제이콥의 법칙', en: "Jakob’s Law", week: 4, category: '사용성 법칙', summary: '사용자는 다른 제품에서 익힌 기대를 새로운 제품에도 가져옵니다.', prompt: '익숙해진 위치가 바뀌면 무엇을 다시 찾아야 하나요? 새 배치에 익숙해지면 어떨까요?', applications: { service: '대상 사용자가 이미 아는 메뉴 이름과 조작 관례를 조사해 활용합니다.', game: '장르와 플랫폼에서 익숙한 조작을 바꾼다면, 새 방식의 이점과 학습 지원을 함께 설계합니다.' }, sources: [{ title: 'NN/g, Consistency and Standards', url: 'https://www.nngroup.com/articles/consistency-and-standards/' }], mount: mountJakob },
  { id: 'miller', title: '밀러와 청킹', en: 'Miller & Chunking', week: 4, category: '사용성 법칙', summary: '정보를 의미 있는 단위로 묶으면 기억하고 다루는 방식이 달라질 수 있습니다.', prompt: '숫자 사이의 구분이 회상에 도움이 되었나요? 의미를 아는 묶음이라면 어떨까요?', applications: { service: '긴 코드를 구분해 읽게 하고, 필요한 정보를 화면에 남겨 기억 부담을 줄입니다.', game: '아이템과 행동을 의미 있는 범주로 묶고, 중요한 상태를 다시 확인할 수 있게 합니다.' }, sources: [{ title: 'Miller (1956), The Magical Number Seven, Plus or Minus Two', url: 'https://psychclassics.yorku.ca/Miller/' }], mount: mountMiller }
];
