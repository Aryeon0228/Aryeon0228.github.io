(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const ids = ['hitstop','shake','recoil','knockback','particles','flash','sound'];
  const units = {hitstop:' ms',shake:' px',recoil:' px',knockback:' px',particles:'개',flash:' ms',sound:'%'};
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
    range.nextElementSibling.value = value + units[id];
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
      $('#active-count').textContent = active === 0 ? '효과 없음' : active + '개 켜짐';
    }
    if (typeof state.auto === 'boolean') $('#auto-toggle').checked = state.auto;
    if (typeof state.reduced === 'boolean') $('#reduced-toggle').checked = state.reduced;
    if (typeof state.paused === 'boolean') {
      $('#pause-button').setAttribute('aria-pressed', String(state.paused));
      $('#pause-button span').textContent = state.paused ? '계속하기' : '일시정지';
      $('#pause-button').setAttribute('aria-label', state.paused ? '계속하기' : '일시정지');
      $('#pause-button svg').innerHTML = state.paused ? '<path d="m6 3 10 7-10 7z"/>' : '<path d="M6 4v12M14 4v12"/>';
    }
  }
  function resetCompare() {
    comparison = null;
    $('#compare-button').setAttribute('aria-pressed', 'false');
    $('#compare-title').textContent = '기본과 비교';
    $('#compare-hint').textContent = '현재 설정 잠깐 끄기';
  }
  function compare() {
    if (!game()) return;
    if (!comparison) {
      const effects = game().getState().effects;
      if (!effects) return;
      comparison = JSON.parse(JSON.stringify(effects));
      game().setAll(false);
      $('#compare-button').setAttribute('aria-pressed', 'true');
      $('#compare-title').textContent = '내 설정으로 돌아가기';
      $('#compare-hint').textContent = '지금은 효과 없음';
      notify('효과를 끈 기본 상태예요. 다시 누르면 내 설정으로 돌아가요.');
    } else {
      const saved = comparison;
      resetCompare();
      ids.forEach(id => saved[id] && game().setEffect(id, saved[id].on, saved[id].value));
      notify('비교하기 전 설정으로 돌아왔어요.');
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
      notify($('[data-effect="' + id + '"] .effect-label').textContent + '만 켰어요.');
    });
  });
  $('#all-on').addEventListener('click', () => { if (game()) { resetCompare(); game().setAll(true); sync(game().getState()); } });
  $('#all-off').addEventListener('click', () => { if (game()) { resetCompare(); game().setAll(false); sync(game().getState()); } });
  $('#compare-button').addEventListener('click', compare);
  $('#auto-toggle').addEventListener('change', event => game()?.setAuto(event.target.checked));
  $('#reduced-toggle').addEventListener('change', event => { resetCompare(); game()?.setReduced(event.target.checked); sync(game()?.getState()); });
  $('#pause-button').addEventListener('click', () => { if (game()) { game().setPaused(!game().getState().paused); sync(game().getState()); } });
  $('#reset-button').addEventListener('click', () => { game()?.reset(); sync(game()?.getState()); notify('표적과 기록을 처음 상태로 돌렸어요.'); });
  $('#panel-button').addEventListener('click', () => {
    const hidden = $('#app').classList.toggle('controls-hidden');
    $('#panel-button').setAttribute('aria-expanded', String(!hidden));
    $('#panel-button span').textContent = hidden ? '효과 설정' : '설정 숨기기';
    $('#panel-button').setAttribute('aria-label', hidden ? '효과 설정 열기' : '효과 설정 숨기기');
    window.dispatchEvent(new Event('resize'));
  });
  $('#fullscreen-button').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else notify('이 브라우저에서는 전체 화면 버튼을 지원하지 않아요.');
    } catch { notify('전체 화면을 열지 못했어요. 브라우저의 전체 화면 기능을 이용해 주세요.'); }
  });
  document.addEventListener('fullscreenchange', () => {
    const isFull = !!document.fullscreenElement;
    $('#fullscreen-button').setAttribute('aria-pressed', String(isFull));
    $('#fullscreen-button span').textContent = isFull ? '전체 화면 종료' : '전체 화면';
    $('#fullscreen-button').setAttribute('aria-label', isFull ? '전체 화면 종료' : '전체 화면');
  });
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
  document.querySelectorAll('.toolbar button').forEach(button => button.setAttribute('aria-label', button.textContent.trim()));
  $('#pause-button').title = '일시정지 / 계속하기 (P)';
  $('#reset-button').title = '처음부터 (R)';
  $('#compare-button').title = '기본과 비교 / 내 설정으로 돌아가기 (B)';
  sync(game()?.getState());
})();
