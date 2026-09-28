// Playback starts only from the visitor's Music button. Audio is fetched on demand.
export function setupMusic(audio, button, status, page = document) {
  if (!audio || !button) return;
  let wanted = false, ticket = 0, fade = 0, suspended = false;
  const level = 0.72;
  const label = button.querySelector('[data-music-label]');

  function show(state) {
    button.dataset.state = state;
    button.setAttribute('aria-pressed', String(state === 'on'));
    const text = state === 'on' ? 'Music On' : state === 'loading' ? 'Loading' : state === 'error' ? 'Retry Music' : 'Music Off';
    if (label) label.textContent = text;
    const action = state === 'on' ? '배경음악 끄기' : state === 'loading' ? '음악 불러오기 취소' : state === 'error' ? '배경음악 다시 시도' : '배경음악 켜기';
    button.setAttribute('aria-label', action);
    button.title = `Orbit · Horizon — ${action}`;
  }

  function stopFade() { cancelAnimationFrame(fade); fade = 0; }
  function ramp(target, seconds, done) {
    stopFade();
    const start = performance.now(), from = audio.volume;
    function step(now) {
      const t = Math.min(1, (now - start) / (seconds * 1000));
      const ease = t * t * (3 - 2 * t);
      audio.volume = from + (target - from) * ease;
      if (t < 1) fade = requestAnimationFrame(step);
      else { fade = 0; done?.(); }
    }
    fade = requestAnimationFrame(step);
  }

  async function start() {
    const current = ++ticket;
    stopFade();
    show('loading');
    status.textContent = '';
    audio.volume = 0;
    if (!audio.getAttribute('src')) audio.src = audio.dataset.src;
    try {
      // Call inside the click handler, before any await, for mobile playback permission.
      await audio.play();
      if (current !== ticket || !wanted || page.hidden) {
        if (!wanted || page.hidden) audio.pause();
        return;
      }
      show('on');
      ramp(level, 0.8);
    } catch (error) {
      if (current !== ticket) return;
      wanted = false;
      suspended = false;
      stopFade();
      audio.pause();
      show('error');
      status.textContent = '음악을 재생하지 못했어요. 음악 버튼을 다시 눌러 주세요.';
    }
  }

  button.addEventListener('click', () => {
    wanted = !wanted;
    suspended = false;
    if (wanted) start();
    else {
      ++ticket;
      show('off');
      status.textContent = '';
      if (audio.paused) stopFade();
      else ramp(0, 0.25, () => { if (!wanted) audio.pause(); });
    }
  });

  audio.addEventListener('error', () => {
    if (!wanted) return;
    ++ticket;
    wanted = false;
    suspended = false;
    stopFade();
    audio.pause();
    show('error');
    status.textContent = '음악을 불러오지 못했어요. 잠시 후 다시 눌러 주세요.';
    audio.removeAttribute('src');
  });

  // Silence a hidden portfolio while a visitor is reading a Lab or another tab.
  page.addEventListener('visibilitychange', () => {
    if (page.hidden) {
      suspended = wanted;
      ++ticket;
      stopFade();
      audio.pause();
      show('off');
    } else if (suspended && wanted) {
      suspended = false;
      start();
    }
  });
  window.addEventListener('pagehide', () => {
    ++ticket;
    suspended = wanted;
    stopFade();
    audio.pause();
    show('off');
  });
  window.addEventListener('pageshow', () => {
    if (!page.hidden && suspended && wanted) { suspended = false; start(); }
  });
  show('off');
  button.hidden = false;
}

setupMusic(document.getElementById('home-music'), document.getElementById('music-toggle'), document.getElementById('music-status'));
