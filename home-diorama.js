// Diorama: the live scene loads only when asked (it is a full WebGL app), runs in place, and
// is unloaded again when it scrolls well out of view so it stops using the GPU.
for (const stage of document.querySelectorAll('[data-diorama]')) {
  const play = stage.querySelector('.diorama-play');
  const src = stage.dataset.diorama;
  const title = stage.dataset.dioramaTitle || 'Live demo';
  let frame = null;
  let close = null;

  const stop = () => {
    if (!frame) return;
    frame.remove();
    close.remove();
    frame = close = null;
    stage.classList.remove('is-live');
  };
  const start = () => {
    if (frame) return;
    frame = document.createElement('iframe');
    frame.src = src;
    frame.title = title;
    frame.allow = 'fullscreen';
    close = document.createElement('button');
    close.type = 'button';
    close.className = 'diorama-close';
    close.textContent = '닫기';
    close.addEventListener('click', () => {
      stop();
      play.focus();
    });
    stage.append(frame, close);
    stage.classList.add('is-live');
    frame.focus();
  };
  play.addEventListener('click', start);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) stop();
    }, {rootMargin: '300px 0px'}).observe(stage);
  }
}
