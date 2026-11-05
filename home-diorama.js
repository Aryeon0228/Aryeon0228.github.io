// Diorama: the live scene loads only when asked (it is a full WebGL app), runs in place, and
// is unloaded again when it scrolls well out of view so it stops using the GPU.
for (const stage of document.querySelectorAll('[data-diorama]')) {
  const play = stage.querySelector('.diorama-play');
  const src = stage.dataset.diorama;
  const title = stage.dataset.dioramaTitle || 'Live demo';
  const standalone = new URL(src, document.baseURI);
  standalone.searchParams.delete('embed');
  let frame = null;
  let controls = null;
  let status = null;
  let slowTimer = null;
  let frameDocument = null;

  const stop = (restoreFocus = false) => {
    if (!frame) return;
    const hadFocus = stage.contains(document.activeElement);
    clearTimeout(slowTimer);
    if (frameDocument) frameDocument.removeEventListener('keydown', onEscape);
    frameDocument = null;
    frame.remove();
    controls.remove();
    status.remove();
    frame = controls = status = null;
    stage.classList.remove('is-live');
    if (restoreFocus || hadFocus) play.focus({preventScroll: !restoreFocus});
  };
  const onEscape = (event) => {
    if (event.key !== 'Escape' || !frame) return;
    event.preventDefault();
    stop(true);
  };
  const start = () => {
    if (frame) return;
    frame = document.createElement('iframe');
    const currentFrame = frame;
    frame.src = src;
    frame.title = title;
    frame.allow = 'fullscreen';
    frame.setAttribute('aria-busy', 'true');
    controls = document.createElement('div');
    controls.className = 'diorama-controls';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'diorama-close';
    close.textContent = '닫기';
    close.setAttribute('aria-label', `${title} 닫기`);
    close.setAttribute('aria-keyshortcuts', 'Escape');
    close.addEventListener('click', () => stop(true));
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = '다시 불러오기';
    retry.addEventListener('click', () => {
      stop();
      start();
    });
    const open = document.createElement('a');
    open.href = standalone.href;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = '새 창에서 보기 ↗';
    controls.append(close, retry, open);
    status = document.createElement('p');
    status.className = 'diorama-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.textContent = '화면을 불러오는 중입니다. Esc로 닫을 수 있습니다.';
    let slow = false;
    slowTimer = setTimeout(() => {
      if (frame !== currentFrame) return;
      slow = true;
      status.textContent = '화면이 비어 있거나 느리면 다시 불러오거나 새 창에서 열어 주세요.';
    }, 12000);
    frame.addEventListener('load', () => {
      if (frame !== currentFrame) return;
      frame.setAttribute('aria-busy', 'false');
      // A document load does not confirm that WebGL or the scene assets are ready.
      if (!slow) status.textContent = '장면이 보이면 직접 조작해 보세요. Esc로 닫을 수 있습니다.';
      if (frameDocument) frameDocument.removeEventListener('keydown', onEscape);
      frameDocument = null;
      try {
        frameDocument = currentFrame.contentDocument;
        if (frameDocument) frameDocument.addEventListener('keydown', onEscape);
      } catch {
        // Cross-origin demos still have the keyboard-accessible close button.
        frameDocument = null;
      }
    });
    frame.addEventListener('error', () => {
      if (frame !== currentFrame) return;
      clearTimeout(slowTimer);
      frame.setAttribute('aria-busy', 'false');
      status.textContent = '화면을 불러오지 못했습니다. 다시 불러오거나 새 창에서 열어 주세요.';
    });
    stage.append(controls, frame, status);
    stage.classList.add('is-live');
    close.focus();
  };
  play.addEventListener('click', start);
  stage.addEventListener('keydown', onEscape);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) stop();
    }, {rootMargin: '300px 0px'}).observe(stage);
  }
}
