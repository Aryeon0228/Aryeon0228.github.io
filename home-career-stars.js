// A single glint as each timeline star crosses the middle of the viewport.
// Scroll work is batched; CSS finishes the short animation without an idle loop.
(function () {
  'use strict';
  const stars = [...document.querySelectorAll('.career-star')].map(element => ({
    element, previous: null, armed: true, active: false, lastFlash: -Infinity
  }));
  if (!stars.length) return;
  const motion = window.penumbraMotion;
  let enabled = motion ? motion.enabled : !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pending = 0, previousScroll = window.scrollY;

  function stop(star) {
    star.element.classList.remove('is-twinkling');
    star.active = false;
  }
  for (const star of stars) {
    star.element.addEventListener('animationend', () => stop(star));
    star.element.addEventListener('animationcancel', () => stop(star));
  }
  function measure(animate = false) {
    const height = window.innerHeight;
    const band = Math.min(64, height * .08);
    const now = performance.now();
    for (const star of stars) {
      const rect = star.element.getBoundingClientRect();
      const distance = rect.top + rect.height / 2 - height / 2;
      const crossed = star.previous !== null && star.previous * distance < 0;
      const visible = rect.bottom > 0 && rect.top < height;
      if (animate && enabled && !document.hidden && visible && star.armed && !star.active &&
          now - star.lastFlash >= 1000 && (Math.abs(distance) <= band || crossed)) {
        star.armed = false;
        star.active = true;
        star.lastFlash = now;
        star.element.classList.add('is-twinkling');
      } else if (!star.active && Math.abs(distance) > band + 100) {
        star.armed = true;
      }
      star.previous = distance;
    }
  }
  function reset() {
    if (pending) cancelAnimationFrame(pending);
    pending = 0;
    previousScroll = window.scrollY;
    for (const star of stars) { stop(star); star.previous = null; star.armed = true; }
    measure();
  }
  window.addEventListener('scroll', () => {
    const moved = window.scrollY !== previousScroll;
    previousScroll = window.scrollY;
    if (!moved || !enabled || document.hidden || pending) return;
    pending = requestAnimationFrame(() => { pending = 0; measure(true); });
  }, { passive: true });
  window.addEventListener('resize', reset, { passive: true });
  document.addEventListener('visibilitychange', reset);
  motion?.subscribe(value => { enabled = value; reset(); });
  reset();
})();
