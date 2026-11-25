(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const t = (key, values) => window.impactI18n.t(key, values);
  const STEP = 1 / 120, SHOT_TICK = 72, LOOP_TICKS = 360;
  let active = false, paused = false, before, after, wasPaused = false;
  let frameId = 0, lastFrame = 0, accumulator = 0, tick = 0;
  let attack = 'shoot', speed = 1, effectsKey = '', pendingSettings = false;

  function paint() {
    if (!active) return;
    for (const [id, scene] of [['before', before], ['after', after]]) {
      const state = scene.getState();
      $('#scene-' + id + '-stats').textContent = t('scene.hit', {hits:state.hits, hp:state.targets[0]?.hp ?? 0});
    }
    const effects = window.impactGame.getState().effects;
    const none = !Object.values(effects).some(effect => effect.on && effect.value > 0);
    const status = t(paused ? 'scene.paused' : none ? 'scene.no.effects' : 'scene.running');
    if ($('#scene-state').textContent !== status) $('#scene-state').textContent = status;
    document.querySelectorAll('[data-scene-attack]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sceneAttack === attack)));
    window.impactControls.refresh();
  }

  function restart() {
    if (!active) return;
    const effects = window.impactGame.getState().effects;
    effectsKey = JSON.stringify(effects);
    for (const [id, effect] of Object.entries(effects)) {
      before.setEffect(id, false, effect.value);
      after.setEffect(id, effect.on, effect.value);
    }
    before.resetComparisonScene(attack);
    after.resetComparisonScene(attack);
    before.setPaused(paused);
    after.setPaused(paused);
    tick = 0; accumulator = 0; lastFrame = 0;
    before.draw(); after.draw(); paint();
  }

  function frame(time) {
    if (!active) return;
    const delta = lastFrame ? Math.min((time - lastFrame) / 1000, .1) : 0;
    lastFrame = time;
    if (!paused) {
      accumulator += delta * speed;
      // Both worlds receive the same fixed time step and attack command.
      // Each world's hit stop remains visible instead of being caught up.
      while (accumulator >= STEP) {
        accumulator -= STEP;
        tick++;
        if (tick === SHOT_TICK) { before.attack(attack); after.attack(attack); }
        before.step(STEP); after.step(STEP);
        if (tick >= LOOP_TICKS) { restart(); break; }
      }
    }
    before.draw(); after.draw();
    if (tick % 12 === 0) paint();
    frameId = requestAnimationFrame(frame);
  }

  function open() {
    if (active) { close(); return; }
    window.impactControls.prepareSceneComparison();
    wasPaused = window.impactGame.getState().paused;
    paused = false;
    active = true;
    $('#app').classList.add('is-comparing');
    $('#same-scene-pane').hidden = false;
    $('#scene-open').setAttribute('aria-pressed', 'true');
    $('#compare-button').disabled = true;
    $('#auto-toggle').disabled = true;
    window.impactGame.setInputEnabled(false);
    window.impactGame.setPaused(true);
    before = window.createImpactGame($('#scene-before'), {passive:true, manual:true, silent:true, seed:314159});
    after = window.createImpactGame($('#scene-after'), {passive:true, manual:true, silent:false, seed:314159});
    after.unlockAudio();
    restart();
    frameId = requestAnimationFrame(frame);
    $('#scene-close').focus({preventScroll:true});
    $('#same-scene-pane').scrollIntoView({block:'start', behavior:'instant'});
    window.dispatchEvent(new Event('resize'));
  }

  function close() {
    if (!active) return;
    active = false;
    pendingSettings = false;
    cancelAnimationFrame(frameId);
    before.destroy(); after.destroy();
    before = null; after = null;
    $('#app').classList.remove('is-comparing');
    $('#same-scene-pane').hidden = true;
    $('#scene-open').setAttribute('aria-pressed', 'false');
    $('#compare-button').disabled = false;
    $('#auto-toggle').disabled = false;
    window.impactGame.setInputEnabled(true);
    window.impactGame.setPaused(wasPaused || document.hidden);
    window.dispatchEvent(new Event('resize'));
    $('#stage').scrollIntoView({block:'start', behavior:'instant'});
    $('#arena').focus({preventScroll:true});
  }

  function togglePause() {
    if (!active) return;
    paused = !paused;
    before.setPaused(paused); after.setPaused(paused);
    if (!paused) after.unlockAudio();
    lastFrame = 0;
    paint();
  }
  function replay() {
    if (!active) return;
    paused = false;
    after.unlockAudio();
    restart();
  }
  window.impactComparison = {open, close, togglePause, replay, get active() { return active; }, get paused() { return paused; }};
  $('#scene-open').addEventListener('click', open);
  $('#scene-close').addEventListener('click', close);
  $('#scene-replay').addEventListener('click', replay);
  document.querySelectorAll('[data-scene-attack]').forEach(button => button.addEventListener('click', () => { attack = button.dataset.sceneAttack; replay(); }));
  $('#scene-speed').addEventListener('change', event => { speed = Number(event.target.value); replay(); });
  window.addEventListener('impact:settings', event => {
    if (!active || !before || pendingSettings || JSON.stringify(event.detail.effects) === effectsKey) return;
    pendingSettings = true;
    queueMicrotask(() => { pendingSettings = false; if (active) restart(); });
  });
  window.addEventListener('impact:language', () => { if (active) { before.draw(); after.draw(); paint(); } });
  document.addEventListener('keydown', event => {
    if (!active || event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    if (key === 'p') { event.preventDefault(); togglePause(); }
    if (key === 'r') { event.preventDefault(); replay(); }
    if (key === 'escape') { event.preventDefault(); close(); }
  });
  document.addEventListener('visibilitychange', () => { if (active && document.hidden && !paused) togglePause(); });
  window.addEventListener('pagehide', () => { if (active) close(); });
})();
