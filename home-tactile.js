// These independent defaults make it easy to keep the light and remove the tilt.
const effects = { tilt: true, light: true };
const root = document.documentElement;
const pointerMedia = matchMedia('(min-width: 641px) and (hover: hover) and (pointer: fine)');
const reducedMedia = matchMedia('(prefers-reduced-motion: reduce)');
const canTrack = () => pointerMedia.matches && !reducedMedia.matches;
const clamp = (value) => Math.max(-1, Math.min(1, value));
const cards = [];
const links = [];
let pendingFrame = 0;

for (const card of document.querySelectorAll('#work .work-card')) {
  const face = document.createElement('div');
  face.className = 'work-card-face';
  face.append(...card.childNodes);
  card.append(face);
  card.dataset.tactileCard = '';
  enhanceLabCard(card);
  const state = { card, face, pointer: null };
  cards.push(state);

  const track = (event) => {
    if (!canTrack() || event.pointerType !== 'mouse' || (!effects.tilt && !effects.light)) return;
    state.pointer = { x: event.clientX, y: event.clientY };
    card.dataset.tactileActive = '';
    schedule();
  };
  card.addEventListener('pointerenter', track);
  card.addEventListener('pointermove', track);
  card.addEventListener('pointerleave', () => resetCard(state));
  card.addEventListener('pointercancel', () => resetCard(state));
  card.addEventListener('pointerdown', (event) => {
    if (canTrack() && effects.tilt && event.pointerType === 'mouse' && event.button === 0 &&
        (card.hasAttribute('data-lab-card') || event.target.closest('a'))) {
      card.dataset.tactilePressed = '';
    }
  });
}

for (const link of document.querySelectorAll('#main-content .content-actions a, #main-content .cv-link, .site-links .nav-cv')) {
  if (!link.querySelector(':scope > span[aria-hidden="true"]')) continue;
  link.dataset.tactileLink = '';
  const state = { link, pointer: null };
  links.push(state);
  const track = (event) => {
    if (!canTrack() || event.pointerType !== 'mouse') return;
    state.pointer = { x: event.clientX, y: event.clientY };
    schedule();
  };
  link.addEventListener('pointerenter', track);
  link.addEventListener('pointermove', track);
  link.addEventListener('pointerleave', () => resetLink(state));
  link.addEventListener('pointercancel', () => resetLink(state));
  link.addEventListener('blur', () => resetLink(state));
}

// Keep the real anchor as the only keyboard stop. The surrounding card is a
// pointer shortcut, so text can still be selected and secondary links stay native.
function enhanceLabCard(card) {
  const title = card.querySelector('h3')?.textContent.trim();
  if (!title || !/\bLab$/i.test(title)) return;
  const primary = card.querySelector('.content-actions a.lab-launch') ||
    [...card.querySelectorAll('.content-actions a[href]')].find((link) => {
      const url = new URL(link.href, document.baseURI);
      return /^(https?:)$/.test(url.protocol) && url.hostname !== 'apps.apple.com';
    });
  if (!primary) return;

  primary.classList.add('lab-launch');
  const arrow = document.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';
  primary.replaceChildren(document.createTextNode('Lab 열기 '), arrow);
  primary.setAttribute('aria-label', `${title} 열기${primary.target === '_blank' ? ' (새 탭)' : ''}`);
  card.dataset.labCard = '';

  const interactive = 'a, button, input, select, textarea, summary, label, [role="button"], [role="link"], [contenteditable]:not([contenteditable="false"])';
  let press = null;
  card.addEventListener('pointerdown', (event) => {
    press = event.target.closest(interactive) ? null : { x: event.clientX, y: event.clientY };
  });
  card.addEventListener('pointercancel', () => { press = null; });
  card.addEventListener('dragstart', () => { press = null; });

  const open = (event) => {
    const start = press;
    press = null;
    if (event.defaultPrevented || !start || event.target.closest(interactive)) return;
    if (event.button !== 0 && event.button !== 1) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;

    // Let anchor navigation handle the destination, target and modifier keys.
    // A middle click is represented as Ctrl/Cmd-click on the primary anchor.
    event.preventDefault();
    primary.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true, view: window,
      ctrlKey: event.ctrlKey || event.button === 1,
      metaKey: event.metaKey, shiftKey: event.shiftKey, altKey: event.altKey
    }));
  };
  card.addEventListener('click', open);
  card.addEventListener('auxclick', open);
}

function schedule() {
  if (!pendingFrame) pendingFrame = requestAnimationFrame(render);
}

function render() {
  pendingFrame = 0;
  if (!canTrack()) return;
  // Read layout together before updating CSS; the article is never transformed.
  const cardFrames = cards.filter((state) => state.pointer).map((state) => ({ state, rect: state.card.getBoundingClientRect() }));
  const linkFrames = links.filter((state) => state.pointer).map((state) => ({ state, rect: state.link.getBoundingClientRect() }));
  for (const { state, rect } of cardFrames) {
    const x = clamp((state.pointer.x - rect.left) / rect.width * 2 - 1);
    const y = clamp((state.pointer.y - rect.top) / rect.height * 2 - 1);
    state.face.style.setProperty('--card-rx', `${effects.tilt ? -y * 1.8 : 0}deg`);
    state.face.style.setProperty('--card-ry', `${effects.tilt ? x * 1.8 : 0}deg`);
    state.face.style.setProperty('--card-x', `${(x + 1) * 50}%`);
    state.face.style.setProperty('--card-y', `${(y + 1) * 50}%`);
  }
  for (const { state, rect } of linkFrames) {
    const x = clamp((state.pointer.x - rect.left) / rect.width * 2 - 1);
    const y = clamp((state.pointer.y - rect.top) / rect.height * 2 - 1);
    state.link.style.setProperty('--arrow-x', `${x * 2.5}px`);
    state.link.style.setProperty('--arrow-y', `${y * 2}px`);
  }
}

function resetCard(state) {
  state.pointer = null;
  delete state.card.dataset.tactileActive;
  delete state.card.dataset.tactilePressed;
  state.face.style.setProperty('--card-rx', '0deg');
  state.face.style.setProperty('--card-ry', '0deg');
}

function resetLink(state) {
  state.pointer = null;
  state.link.style.removeProperty('--arrow-x');
  state.link.style.removeProperty('--arrow-y');
}

function resetAll() {
  cancelAnimationFrame(pendingFrame);
  pendingFrame = 0;
  cards.forEach(resetCard);
  links.forEach(resetLink);
}

function syncEffects() {
  root.dataset.tactileTilt = effects.tilt ? 'on' : 'off';
  root.dataset.tactileLight = effects.light ? 'on' : 'off';
  resetAll();
}

window.addEventListener('pointerup', () => cards.forEach(({ card }) => delete card.dataset.tactilePressed), { passive: true });
window.addEventListener('blur', resetAll);
window.addEventListener('resize', resetAll, { passive: true });
window.addEventListener('scroll', resetAll, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) resetAll(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Tab') resetAll(); });
pointerMedia.addEventListener('change', syncEffects);
reducedMedia.addEventListener('change', syncEffects);

syncEffects();
