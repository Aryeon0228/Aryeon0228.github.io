// Lightweight, scroll-driven depth. No animation loop runs while the page rests.
(function () {
  'use strict';
  const canvas = document.getElementById('page-stars');
  const context = canvas?.getContext('2d');
  if (!context) return;
  const motion = window.penumbraMotion;
  let enabled = motion ? motion.enabled : !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0, height = 0, offset = 0, previousY = window.scrollY;
  let pending = 0;
  let seed = 90210;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const stars = Array.from({ length: 110 }, () => ({
    x: random(), y: random(), radius: .4 + random() * .55,
    opacity: .18 + random() * .38, speed: [.035, .07, .12][Math.floor(random() * 3)]
  }));

  function draw() {
    pending = 0;
    if (document.hidden) return;
    context.clearRect(0, 0, width, height);
    const day = document.documentElement.dataset.theme === 'day';
    context.fillStyle = day ? '#70558c' : '#d9d5ef';
    // Keep small screens as quiet as the desktop; density stays roughly constant.
    const count = Math.min(stars.length, Math.max(28, Math.round(width * height / 9000)));
    for (const star of stars.slice(0, count)) {
      const y = ((star.y * height - offset * star.speed) % height + height) % height;
      context.globalAlpha = star.opacity * (day ? .6 : 1);
      context.beginPath();
      context.arc(star.x * width, y, star.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }
  function schedule() {
    if (!pending && !document.hidden) pending = requestAnimationFrame(draw);
  }
  function resize() {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    schedule();
  }
  window.addEventListener('scroll', () => {
    const nextY = window.scrollY;
    if (enabled) {
      offset += nextY - previousY;
      schedule();
    }
    previousY = nextY;
  }, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  motion?.subscribe(value => { enabled = value; previousY = window.scrollY; });
  document.addEventListener('visibilitychange', schedule);
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  resize();
})();
