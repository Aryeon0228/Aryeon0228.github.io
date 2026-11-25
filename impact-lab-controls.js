(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const t = (key, values) => window.impactI18n.t(key, values);
  const ids = ['hitstop','shake','recoil','knockback','particles','flash','sound'];
  const units = {hitstop:' ms',shake:' px',recoil:' px',knockback:' px',flash:' ms',sound:'%'};
  let comparison = null;
  let messageTimer;
  const game = () => window.impactGame;
  const notify = (message) => {
    const element = $('#status-message');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => element.classList.remove('show'), 2200);
  };
  function paintRange(id, value) {
    const range = $('#range-' + id);
    range.value = value;
    range.style.setProperty('--range-fill', ((value - +range.min) / (+range.max - +range.min) * 100) + '%');
    range.nextElementSibling.value = value + (id === 'particles' ? t('particles.unit') : units[id]);
    range.setAttribute('aria-valuetext', id === 'particles' ? t('particles.value', {count:value}) : value + units[id]);
  }
  function sync(state) {
    if (!state) return;
    if (state.effects) {
      let active = 0;
      ids.forEach(id => {
        const effect = state.effects[id];
        if (!effect) return;
        $('#toggle-' + id).checked = !!effect.on;
        $('[data-effect="' + id + '"]').classList.toggle('is-off', !effect.on);
        paintRange(id, effect.value);
        if (effect.on && effect.value > 0) active++;
      });
      $('#active-count').textContent = active === 0 ? t('effects.none') : t('effects.active', {count:active});
    }
    if (typeof state.auto === 'boolean') $('#auto-toggle').checked = state.auto;
    if (typeof state.reduced === 'boolean') $('#reduced-toggle').checked = state.reduced;
    if (typeof state.paused === 'boolean') {
      $('#pause-button').setAttribute('aria-pressed', String(state.paused));
      $('#pause-button span').textContent = t(state.paused ? 'resume' : 'pause');
      $('#pause-button').setAttribute('aria-label', t(state.paused ? 'resume' : 'pause'));
      $('#pause-button svg').innerHTML = state.paused ? '<path d="m6 3 10 7-10 7z"/>' : '<path d="M6 4v12M14 4v12"/>';
    }
  }
  function resetCompare() {
    comparison = null;
    paintCompare();
  }
  function paintCompare() {
    $('#compare-button').setAttribute('aria-pressed', String(!!comparison));
    $('#compare-title').textContent = t(comparison ? 'compare.restore' : 'compare');
    $('#compare-hint').textContent = t(comparison ? 'compare.off' : 'compare.hint');
  }
  function compare() {
    if (!game()) return;
    if (!comparison) {
      const effects = game().getState().effects;
      if (!effects) return;
      comparison = JSON.parse(JSON.stringify(effects));
      game().setAll(false);
      paintCompare();
      notify(t('message.compare'));
    } else {
      const saved = comparison;
      resetCompare();
      ids.forEach(id => saved[id] && game().setEffect(id, saved[id].on, saved[id].value));
      notify(t('message.restore'));
    }
    sync(game().getState());
  }
  ids.forEach(id => {
    paintRange(id, +$('#range-' + id).value);
    $('#toggle-' + id).addEventListener('change', event => {
      if (!game()) return;
      resetCompare();
      game().setEffect(id, event.target.checked, +$('#range-' + id).value);
      sync(game().getState());
    });
    $('#range-' + id).addEventListener('input', event => {
      paintRange(id, +event.target.value);
      if (!game()) return;
      resetCompare();
      game().setEffect(id, $('#toggle-' + id).checked, +event.target.value);
      sync(game().getState());
    });
    $('[data-solo="' + id + '"]').addEventListener('click', () => {
      if (!game()) return;
      const value = +$('#range-' + id).value;
      resetCompare();
      game().setAll(false);
      game().setEffect(id, true, value);
      sync(game().getState());
      notify(t('message.solo', {name:t('effect.' + id)}));
    });
  });
  $('#all-on').addEventListener('click', () => { if (game()) { resetCompare(); game().setAll(true); sync(game().getState()); } });
  $('#all-off').addEventListener('click', () => { if (game()) { resetCompare(); game().setAll(false); sync(game().getState()); } });
  $('#compare-button').addEventListener('click', compare);
  $('#auto-toggle').addEventListener('change', event => game()?.setAuto(event.target.checked));
  $('#reduced-toggle').addEventListener('change', event => { resetCompare(); game()?.setReduced(event.target.checked); sync(game()?.getState()); });
  $('#pause-button').addEventListener('click', () => { if (game()) { game().setPaused(!game().getState().paused); sync(game().getState()); } });
  $('#reset-button').addEventListener('click', () => { game()?.reset(); sync(game()?.getState()); notify(t('message.reset')); });
  $('#panel-button').addEventListener('click', () => {
    const hidden = $('#app').classList.toggle('controls-hidden');
    $('#panel-button').setAttribute('aria-expanded', String(!hidden));
    paintPanel();
    window.dispatchEvent(new Event('resize'));
  });
  $('#fullscreen-button').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else notify(t('message.fullscreen.unsupported'));
    } catch { notify(t('message.fullscreen.failed')); }
  });
  function paintFullscreen() {
    const isFull = !!document.fullscreenElement;
    $('#fullscreen-button').setAttribute('aria-pressed', String(isFull));
    $('#fullscreen-button span').textContent = t(isFull ? 'fullscreen.exit' : 'fullscreen');
    $('#fullscreen-button').setAttribute('aria-label', t(isFull ? 'fullscreen.exit' : 'fullscreen'));
  }
  document.addEventListener('fullscreenchange', paintFullscreen);
  function paintPanel() {
    const hidden = $('#app').classList.contains('controls-hidden');
    $('#panel-button span').textContent = t(hidden ? 'panel.show' : 'panel.hide');
    $('#panel-button').setAttribute('aria-label', t(hidden ? 'panel.show.aria' : 'panel.hide.aria'));
  }
  // Language changes only repaint labels; comparison and game state stay intact.
  function paintLanguage() {
    clearTimeout(messageTimer);
    $('#status-message').classList.remove('show');
    $('#status-message').textContent = '';
    $('#reset-button span').textContent = t('reset');
    $('#reset-button').setAttribute('aria-label', t('reset'));
    $('#pause-button').title = t('pause.hint');
    $('#reset-button').title = t('reset.hint');
    $('#compare-button').title = t('compare.shortcut');
    ids.forEach(id => $('[data-solo="' + id + '"]').setAttribute('aria-label', t('solo.aria', {name:t('effect.' + id)})));
    paintCompare();
    paintPanel();
    paintFullscreen();
    sync(game()?.getState());
  }
  window.addEventListener('impact:language', paintLanguage);
  document.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'b' && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey && !event.target.closest('input,textarea,select,[contenteditable="true"]')) {
      event.preventDefault(); compare();
    }
  });
  document.addEventListener('impact:ready', () => sync(game()?.getState()));
  window.addEventListener('impact:ready', () => sync(game()?.getState()));
  window.addEventListener('impact:settings', event => sync(event.detail));
  window.addEventListener('impact:stats', event => sync({paused:event.detail.paused, auto:event.detail.auto}));
  document.addEventListener('impact:settings', event => sync(event.detail));
  document.addEventListener('impact:stats', event => sync({paused:event.detail.paused, auto:event.detail.auto}));
  paintLanguage();
})();
