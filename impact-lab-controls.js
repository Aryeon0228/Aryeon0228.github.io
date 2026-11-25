(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const t = (key, values) => window.impactI18n.t(key, values);
  const tiles = [...document.querySelectorAll('[data-effect]')];
  const game = () => window.impactGame;
  let detail = 'hitstop', messageTimer;

  function notify(message) {
    $('#status-message').textContent = message;
    $('#status-message').classList.add('show');
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => $('#status-message').classList.remove('show'), 2200);
  }
  function paintDetail(id = detail) {
    detail = id;
    $('#effect-detail-title').textContent = t('effect.' + id);
    $('#effect-detail-term').textContent = window.impactI18n.language === 'ko' ? t('effect.' + id + '.term') : '';
    $('#effect-detail-copy').textContent = t('effect.' + id + '.description');
  }
  function sync(state) {
    if (!state) return;
    if (state.effects) {
      let count = 0;
      tiles.forEach(tile => {
        const effect = state.effects[tile.dataset.effect];
        if (!effect) return;
        tile.querySelector('input').checked = !!effect.on;
        tile.classList.toggle('is-off', !effect.on);
        if (effect.on) count++;
      });
      $('#active-count').textContent = t(count ? 'effects.active' : 'effects.none', {count, total:tiles.length});
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
  tiles.forEach(tile => {
    const id = tile.dataset.effect;
    tile.querySelector('input').addEventListener('change', event => {
      game().unlockAudio();
      game().setEffect(id, event.target.checked);
      paintDetail(id);
      sync(game().getState());
    });
    tile.addEventListener('mouseenter', () => paintDetail(id));
    tile.addEventListener('focusin', () => paintDetail(id));
  });
  $('#all-on').addEventListener('click', () => { game().unlockAudio(); game().setAll(true); });
  $('#all-off').addEventListener('click', () => game().setAll(false));
  $('#auto-toggle').addEventListener('change', event => game().setAuto(event.target.checked));
  $('#reduced-toggle').addEventListener('change', event => game().setReduced(event.target.checked));
  $('#pause-button').addEventListener('click', () => { game().unlockAudio(); game().setPaused(!game().getState().paused); });
  $('#reset-button').addEventListener('click', () => { game().reset(); notify(t('message.reset')); });
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
    const full = !!document.fullscreenElement;
    $('#fullscreen-button').setAttribute('aria-pressed', String(full));
    $('#fullscreen-button span').textContent = t(full ? 'fullscreen.exit' : 'fullscreen');
    $('#fullscreen-button').setAttribute('aria-label', t(full ? 'fullscreen.exit' : 'fullscreen'));
  }
  function paintPanel() {
    const hidden = $('#app').classList.contains('controls-hidden');
    $('#panel-button span').textContent = t(hidden ? 'panel.show' : 'panel.hide');
    $('#panel-button').setAttribute('aria-label', t(hidden ? 'panel.show.aria' : 'panel.hide.aria'));
  }
  function paintLanguage() {
    clearTimeout(messageTimer);
    $('#status-message').classList.remove('show');
    $('#reset-button span').textContent = t('reset');
    $('#reset-button').setAttribute('aria-label', t('reset'));
    $('#pause-button').title = t('pause.hint');
    $('#reset-button').title = t('reset.hint');
    paintDetail(); paintPanel(); paintFullscreen(); sync(game().getState());
  }
  document.addEventListener('fullscreenchange', paintFullscreen);
  window.addEventListener('impact:language', paintLanguage);
  window.addEventListener('impact:settings', event => sync(event.detail));
  window.addEventListener('impact:stats', event => sync({paused:event.detail.paused, auto:event.detail.auto}));
  paintLanguage();
})();
