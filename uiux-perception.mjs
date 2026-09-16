// Color remains a stimulus only where the experiment compares color grouping.
// Screen approximations of Mocha Mousse and Cloud Dancer.
const COLORS = { ink: '#e8e8e8', muted: '#a8a8a8', stimulus: '#dedede', mocha: '#a47864', cloud: '#f0eee9', ground: '#080808' };
const colorDescription = '모카 무스(갈색)와 클라우드 댄서(부드러운 흰색)';
const source = (title, path) => ({ title, url: `https://www.nngroup.com/${path}` });
const SOURCES = {
  proximity: source('NN/g · Proximity Principle in Visual Design', 'articles/gestalt-proximity/'),
  similarity: source('NN/g · Similarity Principle in Visual Design', 'articles/gestalt-similarity/'),
  closure: source('NN/g · Principle of Closure in Visual Design', 'articles/principle-closure/'),
  continuation: source('NN/g · Visual Design: Glossary — Continuation', 'articles/visual-design-cheat-sheet/'),
  commonGlossary: source('NN/g · Visual Design: Glossary — Common Fate', 'articles/visual-design-cheat-sheet/'),
  common: { title: 'Common Fate for Animated Transitions in Visualization', url: 'https://arxiv.org/abs/1908.00661' },
  hierarchy: source('NN/g · 5 Principles of Visual Design in UX', 'articles/principles-visual-design/'),
};

const on = (element, event, fn, signal) => element.addEventListener(event, fn, signal ? { signal } : undefined);
const query = (root, selector) => root.querySelector(selector);
const value = (root, id) => query(root, `[data-control="${id}"]`);
const listen = (root, id, fn, signal, event = 'input') => on(value(root, id), event, fn, signal);
const range = (id, label, min, max, initial, suffix = '', step = 1) => `<div class="control-group"><label class="control-label" for="pc-${id}">${label}<output class="control-value" data-value="${id}">${initial}${suffix}</output></label><input id="pc-${id}" data-control="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${initial}"></div>`;
const select = (id, label, options) => `<div class="control-group"><label class="control-label" for="pc-${id}">${label}</label><select id="pc-${id}" data-control="${id}">${options.map(([key, text]) => `<option value="${key}">${text}</option>`).join('')}</select></div>`;
const actions = (buttons) => `<div class="control-actions">${buttons.map(([id, text, primary = false]) => `<button type="button" class="lab-button${primary ? ' primary' : ''}" data-control="${id}">${text}</button>`).join('')}</div>`;
const setOutput = (root, id, text) => { query(root, `[data-value="${id}"]`).textContent = text; };
function canvas(stage, id, description) {
  stage.innerHTML = `<div class="pc-experiment pc-${id}"><svg class="pc-canvas" viewBox="0 0 760 400" role="img" aria-labelledby="pc-${id}-title pc-${id}-description"><title id="pc-${id}-title">${description}</title><desc id="pc-${id}-description"></desc><g data-art></g></svg><p class="experiment-caption pc-caption" data-caption></p></div>`;
  return { art: query(stage, '[data-art]'), desc: query(stage, 'desc'), caption: query(stage, '[data-caption]') };
}
function caption(scene, text, description = text) {
  scene.caption.textContent = text;
  scene.desc.textContent = description;
}
const emptyCleanup = () => {};

function mountProximity({ stage, controls, signal }) {
  const scene = canvas(stage, 'proximity', '같은 크기와 색의 점 24개. 점 사이 간격을 바꾸는 근접성 실험.');
  controls.innerHTML = range('proximity-gap', '묶음 사이 간격', 0, 100, 65, '%') + select('proximity-axis', '간격을 벌릴 방향', [['columns', '가로 · 세 묶음'], ['rows', '세로 · 두 묶음']]) + actions([['proximity-even', '같은 간격'], ['proximity-group', '간격 벌리기', true]]) + '<p class="control-note">점의 크기, 색, 개수는 그대로입니다.</p>';
  function draw() {
    const strength = Number(value(controls, 'proximity-gap').value);
    const rows = value(controls, 'proximity-axis').value === 'rows';
    const extra = strength * .9;
    scene.art.innerHTML = Array.from({ length: 24 }, (_, i) => {
      const col = i % 6, row = Math.floor(i / 6);
      const x = 380 + (col - 2.5) * 54 + (rows ? 0 : (Math.floor(col / 2) - 1) * extra);
      const y = 200 + (row - 1.5) * 54 + (rows ? (Math.floor(row / 2) - .5) * extra : 0);
      return `<circle cx="${x}" cy="${y}" r="10" fill="${COLORS.stimulus}"/>`;
    }).join('');
    setOutput(controls, 'proximity-gap', `${strength}%`);
    caption(scene, strength === 0 ? '모든 점이 같은 간격으로 놓여 있습니다.' : '간격이 벌어진 곳을 경계로 점들이 묶여 보이나요?', `같은 색의 점 24개. ${rows ? '두 행씩' : '두 열씩'} 가까이 놓이고, 묶음 사이 간격 설정은 ${strength}%입니다.`);
  }
  ['proximity-gap', 'proximity-axis'].forEach(id => listen(controls, id, draw, signal));
  for (const [id, n] of [['proximity-even', 0], ['proximity-group', 85]]) listen(controls, id, () => { value(controls, 'proximity-gap').value = n; draw(); }, signal, 'click');
  draw();
  return emptyCleanup;
}

function mountSimilarity({ stage, controls, signal }) {
  const scene = canvas(stage, 'similarity', '같은 간격의 도형 24개. 색과 형태의 유사성 실험.');
  controls.innerHTML = select('similarity-cue', '같게 보이는 단서', [['color', '색'], ['shape', '형태'], ['both', '색 + 형태'], ['none', '단서 없음 · 모두 같은 점']]) + select('similarity-pattern', '단서의 배치', [['columns', '세로로 반복'], ['rows', '가로로 반복'], ['mixed', '위치를 섞어서']]) + '<p class="control-note">간격은 고정되어 있습니다. 떨어져 있어도 같은 색이나 형태를 먼저 찾아보세요.</p>';
  function draw() {
    const cue = value(controls, 'similarity-cue').value;
    const pattern = value(controls, 'similarity-pattern').value;
    scene.art.innerHTML = Array.from({ length: 24 }, (_, i) => {
      const col = i % 6, row = Math.floor(i / 6);
      const group = pattern === 'columns' ? col % 2 : pattern === 'rows' ? row % 2 : (col + row + Math.floor(col / 3)) % 2;
      const x = 180 + col * 80, y = 95 + row * 70;
      const fill = cue === 'none' || cue === 'shape' ? COLORS.stimulus : group ? COLORS.cloud : COLORS.mocha;
      return group && (cue === 'shape' || cue === 'both') ? `<rect x="${x - 11}" y="${y - 11}" width="22" height="22" rx="2" fill="${fill}"/>` : `<circle cx="${x}" cy="${y}" r="12" fill="${fill}"/>`;
    }).join('');
    caption(scene, cue === 'none' ? '간격과 모양이 모두 같습니다. 어느 방향으로 읽히나요?' : '공간은 그대로인데, 무엇이 같은 묶음으로 보이나요?', `같은 간격의 도형 24개. ${cue === 'none' ? '모두 같은 원입니다.' : `${cue === 'color' ? colorDescription : cue === 'shape' ? '원과 사각형' : `${colorDescription}, 원과 사각형`} 단서가 ${pattern === 'columns' ? '열' : pattern === 'rows' ? '행' : '섞인 위치'}에 반복됩니다.`}`);
  }
  ['similarity-cue', 'similarity-pattern'].forEach(id => listen(controls, id, draw, signal));
  draw();
  return emptyCleanup;
}

function mountClosure({ stage, controls, signal }) {
  const scene = canvas(stage, 'closure', '부분적으로 끊어진 원, 사각형, 삼각형의 폐쇄성 실험.');
  controls.innerHTML = range('closure-gap', '비어 있는 윤곽', 0, 92, 48, '%') + actions([['closure-guide', '완성 윤곽 보기'], ['closure-reset', '처음 상태']]) + '<p class="control-note">빈 부분이 늘어나도 같은 도형으로 보이는지 관찰합니다. 알아볼 수 있는 한계는 사람마다 다를 수 있습니다.</p>';
  let guide = false;
  const paths = [
    { d: 'M 258 200 A 68 68 0 1 1 122 200 A 68 68 0 1 1 258 200', pieces: 4 },
    { d: 'M 380 132 L 448 132 L 448 268 L 312 268 L 312 132 Z', pieces: 4 },
    { d: 'M 570 126 L 654 268 L 486 268 Z', pieces: 3 },
  ];
  function draw() {
    const gap = Number(value(controls, 'closure-gap').value);
    scene.art.innerHTML = paths.map(({ d, pieces }) => {
      const line = (100 - gap) / pieces, space = gap / pieces;
      return `${guide ? `<path d="${d}" fill="none" stroke="${COLORS.muted}" stroke-opacity=".35" stroke-width="2"/>` : ''}<path d="${d}" fill="none" stroke="${COLORS.stimulus}" stroke-width="7" stroke-linecap="butt" pathLength="100" stroke-dasharray="${line} ${space}" stroke-dashoffset="${line / 2}"/>`;
    }).join('');
    setOutput(controls, 'closure-gap', `${gap}%`);
    value(controls, 'closure-guide').setAttribute('aria-pressed', String(guide));
    value(controls, 'closure-guide').textContent = guide ? '완성 윤곽 숨기기' : '완성 윤곽 보기';
    caption(scene, gap === 0 ? '윤곽이 모두 이어져 있습니다.' : `윤곽의 ${gap}%가 없어도 전체 모양이 떠오르나요?`, `원, 사각형, 삼각형 윤곽의 ${gap}%가 반복 간격으로 비어 있습니다. ${guide ? '옅은 완성 윤곽을 함께 표시합니다.' : '완성 윤곽은 표시하지 않습니다.'}`);
  }
  listen(controls, 'closure-gap', draw, signal);
  listen(controls, 'closure-guide', () => { guide = !guide; draw(); }, signal, 'click');
  listen(controls, 'closure-reset', () => { guide = false; value(controls, 'closure-gap').value = 48; draw(); }, signal, 'click');
  draw();
  return emptyCleanup;
}

function mountContinuity({ stage, controls, signal }) {
  const scene = canvas(stage, 'continuity', '교차하는 두 선에서 시선이 이어지는 방향을 관찰하는 연속성 실험.');
  controls.innerHTML = range('continuity-angle', '각 선의 기울기', 12, 30, 22, '°') + actions([['continuity-color', '두 선 색 구분'], ['continuity-cover', '교차점 가리기']]) + '<p class="control-note">먼저 같은 색으로 관찰한 뒤 색을 구분해 보세요. 색을 바꿔도 선의 위치는 같습니다.</p>';
  let distinguish = false, cover = false;
  function draw() {
    const angle = Number(value(controls, 'continuity-angle').value);
    const dy = Math.tan(angle * Math.PI / 180) * 260;
    const top = 200 - dy, bottom = 200 + dy;
    scene.art.innerHTML = `<g fill="none" stroke-width="7" stroke-linecap="round"><path d="M120 ${top} L640 ${bottom}" stroke="${distinguish ? COLORS.mocha : COLORS.stimulus}"/><path d="M120 ${bottom} L640 ${top}" stroke="${distinguish ? COLORS.cloud : COLORS.stimulus}"/></g>${cover ? `<circle cx="380" cy="200" r="42" fill="${COLORS.ground}"/>` : ''}<g class="pc-endpoints" fill="${COLORS.ink}" text-anchor="middle"><text x="87" y="${top + 6}">A</text><text x="673" y="${top + 6}">B</text><text x="87" y="${bottom + 6}">C</text><text x="673" y="${bottom + 6}">D</text></g>`;
    setOutput(controls, 'continuity-angle', `${angle}°`);
    for (const [id, enabled, off, active] of [['continuity-color', distinguish, '두 선 색 구분', '같은 색으로 보기'], ['continuity-cover', cover, '교차점 가리기', '교차점 보이기']]) {
      value(controls, id).setAttribute('aria-pressed', String(enabled));
      value(controls, id).textContent = enabled ? active : off;
    }
    caption(scene, distinguish ? '모카 무스는 A–D, 클라우드 댄서는 C–B로 이어집니다.' : 'A에서 출발하면 B와 D 중 어디로 시선이 이어지나요?', `A와 D, C와 B를 잇는 두 직선이 ${angle * 2}도 각도로 교차합니다. ${cover ? '중앙은 원으로 가려져 있습니다.' : ''} ${distinguish ? `두 선을 ${colorDescription}으로 구분합니다.` : '두 선은 같은 색입니다.'}`);
  }
  listen(controls, 'continuity-angle', draw, signal);
  listen(controls, 'continuity-color', () => { distinguish = !distinguish; draw(); }, signal, 'click');
  listen(controls, 'continuity-cover', () => { cover = !cover; draw(); }, signal, 'click');
  draw();
  return emptyCleanup;
}

function mountCommonFate({ stage, controls, signal, announce = () => {} }) {
  const scene = canvas(stage, 'common-fate', '같은 모습의 점들이 움직이는 방향과 속도로 묶이는 공동운명 실험.');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const icons = {
    play: '<path d="M8 5l11 7-11 7Z" fill="currentColor"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3"/>',
    step: '<path d="m5 5 10 7-10 7Z" fill="currentColor"/><path d="M19 5v14" stroke="currentColor" stroke-width="2"/>',
    reset: '<path d="M3 10a9 9 0 1 1 2.5 8M3 4v6h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
  const motionActions = `<div class="control-actions pc-motion-actions" role="group" aria-label="움직임 조작">${[['play', '재생'], ['step', '한 단계 진행'], ['reset', '처음 위치']].map(([name, label]) => `<button type="button" class="lab-button${name === 'play' ? ' primary' : ''}" data-control="fate-${name}" aria-label="${label}" title="${label}">${icon(name)}</button>`).join('')}</div>`;
  controls.innerHTML = select('fate-relation', '두 묶음의 움직임', [['opposite', '서로 반대 방향 · 같은 속도'], ['same', '같은 방향 · 같은 속도'], ['cross', '가로와 세로 · 같은 속도'], ['speed', '가로 왕복 · 다른 주기']]) + range('fate-speed', '재생 속도', .25, 1.5, .75, '×', .25) + motionActions + `<p class="control-note" data-motion-note>${reduced.matches ? '기기의 동작 줄이기 설정이 켜져 있습니다. 한 단계씩 관찰하거나 직접 재생할 수 있습니다.' : '정지 상태에서 먼저 묶음을 찾아본 뒤 재생해 보세요.'}</p>`;
  const origins = Array.from({ length: 24 }, (_, i) => ({ x: 180 + i % 6 * 80, y: 95 + Math.floor(i / 6) * 70, group: (i % 6 + Math.floor(i / 6)) % 2 }));
  scene.art.innerHTML = origins.map(({ x, y }) => `<circle cx="${x}" cy="${y}" r="9" fill="${COLORS.stimulus}"/>`).join('');
  const dots = [...scene.art.children];
  let phase = 0, running = false, raf = 0, previous = null, disposed = false;
  function draw() {
    const relation = value(controls, 'fate-relation').value;
    origins.forEach(({ x, y, group }, i) => {
      let dx = Math.sin(phase) * 26, dy = 0;
      if (group && relation === 'opposite') dx *= -1;
      if (group && relation === 'cross') { dy = dx; dx = 0; }
      if (group && relation === 'speed') dx = Math.sin(phase * 1.75) * 26;
      dots[i].setAttribute('cx', (x + dx).toFixed(2));
      dots[i].setAttribute('cy', (y + dy).toFixed(2));
    });
  }
  function updateState() {
    const play = value(controls, 'fate-play');
    const label = running ? '일시 정지' : '재생';
    play.innerHTML = icon(running ? 'pause' : 'play');
    play.setAttribute('aria-label', label);
    play.title = label;
    play.setAttribute('aria-pressed', String(running));
    const text = running
      ? value(controls, 'fate-relation').value === 'speed'
        ? '서로 다른 주기로 가로 왕복합니다. 같은 리듬으로 움직이는 점들을 찾아보세요.'
        : '색과 크기는 같습니다. 함께 움직이는 점들을 따라가 보세요.'
      : '움직임이 멈췄습니다. 같은 묶음이 여전히 보이나요?';
    caption(scene, phase === 0 && !running ? '모든 점이 같은 모습입니다. 재생하면 무엇이 달라질까요?' : text, `같은 모습의 점 24개. ${value(controls, 'fate-relation').selectedOptions[0].textContent}. ${running ? '재생 중입니다.' : '정지 상태입니다.'}`);
  }
  function pause() { running = false; cancelAnimationFrame(raf); raf = 0; previous = null; if (!disposed) updateState(); }
  function tick(now) {
    if (disposed || !running) return;
    if (previous !== null) phase += Math.min(now - previous, 40) / 1000 * 1.8 * Number(value(controls, 'fate-speed').value);
    previous = now;
    draw();
    raf = requestAnimationFrame(tick);
  }
  listen(controls, 'fate-play', () => {
    if (running) { pause(); announce('움직임을 일시 정지했습니다.'); }
    else { running = true; previous = null; updateState(); raf = requestAnimationFrame(tick); announce('움직임을 재생합니다.'); }
  }, signal, 'click');
  listen(controls, 'fate-step', () => { pause(); phase += .38; draw(); updateState(); announce('한 단계 진행했습니다.'); }, signal, 'click');
  listen(controls, 'fate-reset', () => { pause(); phase = 0; draw(); updateState(); announce('점들을 처음 위치로 되돌렸습니다.'); }, signal, 'click');
  listen(controls, 'fate-speed', () => setOutput(controls, 'fate-speed', `${Number(value(controls, 'fate-speed').value).toFixed(2).replace(/0$/, '')}×`), signal);
  listen(controls, 'fate-relation', () => { phase = 0; previous = null; draw(); updateState(); }, signal);
  on(document, 'visibilitychange', () => { if (document.hidden) pause(); }, signal);
  on(reduced, 'change', () => {
    if (reduced.matches) pause();
    query(controls, '[data-motion-note]').textContent = reduced.matches ? '동작 줄이기 설정이 켜져 있습니다. 한 단계씩 관찰하거나 직접 재생할 수 있습니다.' : '정지 상태에서 먼저 묶음을 찾아본 뒤 재생해 보세요.';
  }, signal);
  function cleanup() { disposed = true; running = false; cancelAnimationFrame(raf); }
  if (signal) signal.addEventListener('abort', cleanup, { once: true });
  draw(); updateState();
  return cleanup;
}

function mountHierarchy({ stage, controls, signal, announce = () => {} }) {
  stage.innerHTML = `<div class="pc-experiment pc-hierarchy"><div class="pc-booking" data-booking><div class="pc-booking-kicker">EQUIPMENT RENTAL</div><div class="pc-booking-heading"><p class="pc-booking-title">Sony FX3</p><p class="pc-booking-description">시네마 카메라 · 대여 가능</p></div><div class="pc-booking-details"><div><span>이용 일시</span><strong>내일 10:00–17:00</strong></div><div><span>구성품</span><strong>본체 · 배터리 2개 · 충전기</strong></div></div><div class="pc-booking-bottom"><p>신분증을 지참해 대여 데스크에서 수령하세요.</p><button type="button" class="pc-booking-action" data-reserve>예약 내용 확인</button></div></div><p class="experiment-caption pc-caption" data-caption>장비명, 대여 시간, 확인 버튼 중 무엇이 먼저 보이나요?</p></div>`;
  controls.innerHTML = range('hierarchy-size', '크기 차이', 0, 100, 80, '%') + range('hierarchy-contrast', '대비 차이', 0, 100, 75, '%') + range('hierarchy-spacing', '묶음 사이 여백', 0, 100, 65, '%') + '<label class="pc-check"><input type="checkbox" data-control="hierarchy-align" checked>왼쪽 기준선 정렬</label>' + actions([['hierarchy-flat', '위계 낮추기'], ['hierarchy-clear', '위계 높이기', true]]) + '<p class="control-note">내용은 같습니다. 한 번에 하나씩 바꾸며 읽는 순서를 비교해 보세요.</p>';
  const booking = query(stage, '[data-booking]');
  function update() {
    const size = Number(value(controls, 'hierarchy-size').value);
    const contrast = Number(value(controls, 'hierarchy-contrast').value);
    const spacing = Number(value(controls, 'hierarchy-spacing').value);
    for (const [id, n] of [['hierarchy-size', size], ['hierarchy-contrast', contrast], ['hierarchy-spacing', spacing]]) setOutput(controls, id, `${n}%`);
    booking.style.setProperty('--pc-title-size', `${16 + size * .22}px`);
    booking.style.setProperty('--pc-title-weight', String(Math.round(400 + size * 3)));
    booking.style.setProperty('--pc-section-gap', `${9 + spacing * .22}px`);
    booking.style.setProperty('--pc-action-bg', mix('#303030', COLORS.stimulus, contrast / 100));
    booking.style.setProperty('--pc-action-color', contrast > 45 ? '#111111' : '#e8e8e8');
    booking.style.setProperty('--pc-support', mix('#e8e8e8', '#a8a8a8', contrast / 100));
    booking.classList.toggle('pc-unaligned', !value(controls, 'hierarchy-align').checked);
    query(stage, '[data-caption]').textContent = '장비명, 대여 시간, 확인 버튼 중 무엇이 먼저 보이나요?';
  }
  ['hierarchy-size', 'hierarchy-contrast', 'hierarchy-spacing', 'hierarchy-align'].forEach(id => listen(controls, id, update, signal));
  for (const [id, levels] of [['hierarchy-flat', [0, 0, 0, false]], ['hierarchy-clear', [80, 75, 65, true]]]) listen(controls, id, () => {
    ['hierarchy-size', 'hierarchy-contrast', 'hierarchy-spacing'].forEach((key, i) => { value(controls, key).value = levels[i]; });
    value(controls, 'hierarchy-align').checked = levels[3]; update();
  }, signal, 'click');
  on(query(stage, '[data-reserve]'), 'click', () => {
    query(stage, '[data-caption]').textContent = '이 버튼을 얼마나 빨리 찾았나요? 대비와 크기를 낮춰 다시 비교해 보세요.';
    announce('예약 확인 버튼을 선택했습니다. 이 화면은 시각적 위계를 비교하는 실험용 예시입니다.');
  }, signal);
  update();
  return emptyCleanup;
}

function mix(a, b, t) {
  const rgb = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16));
  const aa = rgb(a), bb = rgb(b);
  return `#${aa.map((v, i) => Math.round(v + (bb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

export const perceptionModules = [
  {
    id: 'proximity', title: '근접성', en: 'Proximity', week: 2, category: '시지각',
    summary: '가까이 놓인 요소를 서로 관련된 묶음으로 인식합니다.',
    prompt: '간격만 바꾸면 몇 개의 묶음으로 보이나요?',
    applications: { service: '입력칸과 해당 라벨을 가깝게 놓고, 서로 다른 질문 사이에는 여백을 둡니다.', game: '아이콘과 수량을 붙여 놓고, 서로 다른 장비 묶음 사이에는 더 큰 여백을 둡니다.' },
    sources: [SOURCES.proximity], mount: mountProximity,
  },
  {
    id: 'similarity', title: '유사성', en: 'Similarity', week: 2, category: '시지각',
    summary: '색이나 형태가 비슷한 요소를 같은 성격의 묶음으로 인식합니다.',
    prompt: '같은 간격에서도 색과 형태가 읽는 방향을 바꾸나요?',
    applications: { service: '같은 역할의 버튼에 같은 형태와 색을 써서 동작을 예상하도록 돕습니다.', game: '같은 종류의 아이템에 일관된 모양과 색을 쓰고, 색 외의 단서도 함께 제공합니다.' },
    sources: [SOURCES.similarity], mount: mountSimilarity,
  },
  {
    id: 'closure', title: '폐쇄성', en: 'Closure', week: 2, category: '시지각',
    summary: '윤곽 일부가 없어도 빈 부분을 보완해 전체 형태를 인식합니다.',
    prompt: '윤곽이 얼마나 없어져도 같은 도형으로 보이나요?',
    applications: { service: '일부가 생략된 아이콘도 익숙한 윤곽을 유지하면 알아볼 수 있습니다. 생략해도 의미가 통하는지 확인합니다.', game: '단순화한 표식에도 대상의 특징적인 윤곽을 남겨 빠르게 구분하도록 돕습니다.' },
    sources: [SOURCES.closure], mount: mountClosure,
  },
  {
    id: 'continuity', title: '연속성', en: 'Good continuation', week: 2, category: '시지각',
    summary: '선을 따라 이어지는 방향을 자연스러운 하나의 경로로 읽습니다.',
    prompt: '교차점에서 시선은 어느 방향으로 이어지나요?',
    applications: { service: '진행 단계와 연결선을 같은 흐름으로 배치해 다음에 볼 위치를 안내합니다.', game: '스킬 트리의 가지나 이동 경로가 교차할 때 이어지는 방향이 명확하도록 정리합니다.' },
    sources: [SOURCES.continuation], mount: mountContinuity,
  },
  {
    id: 'common-fate', title: '공동운명', en: 'Common fate', week: 2, category: '시지각',
    summary: '함께 움직이는 요소를 같은 묶음으로 인식합니다.',
    prompt: '정지할 때 안 보이던 묶음이 움직이면 드러나나요?',
    applications: { service: '목록을 접을 때 관련 항목을 함께 움직여 어떤 정보가 같은 묶음인지 보여줍니다.', game: '함께 이동하는 유닛이나 연동되는 상태 표시를 일관되게 움직여 관계를 드러냅니다.' },
    sources: [SOURCES.commonGlossary, SOURCES.common], mount: mountCommonFate,
  },
  {
    id: 'hierarchy', title: '시각적 위계', en: 'Visual hierarchy', week: 2, category: '시지각',
    summary: '크기, 대비, 간격, 정렬로 정보가 읽히는 순서를 만듭니다.',
    prompt: '같은 예약 화면에서 무엇이 가장 먼저 보이나요?',
    applications: { service: '예약 화면에서 장비명, 이용 시간, 다음 행동의 순서를 사용자의 목표에 맞춰 정합니다.', game: '전투 중 필요한 체력과 현재 목표를 우선 보이게 하고 보조 정보와 차이를 둡니다.' },
    sources: [SOURCES.hierarchy], mount: mountHierarchy,
  },
];
