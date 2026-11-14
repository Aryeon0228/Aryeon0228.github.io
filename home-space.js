// Scroll-driven depth with occasional short glints; frames run only while a glint is active.
(function () {
  'use strict';
  const canvas = document.getElementById('page-stars');
  const context = canvas?.getContext('2d');
  if (!context) return;
  const motion = window.penumbraMotion;
  let enabled = motion ? motion.enabled : !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0, height = 0, offset = 0, previousY = window.scrollY;
  let pending = 0, twinkleTimer = 0, twinkle = null;
  let seed = 90210;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const stars = Array.from({ length: 110 }, () => ({
    x: random(), y: random(), radius: .4 + random() * .55,
    opacity: .18 + random() * .38, speed: [.035, .07, .12][Math.floor(random() * 3)]
  }));

  const starCount = () => Math.min(stars.length, Math.max(28, Math.round(width * height / 9000)));
  const canTwinkle = () => enabled && !document.hidden && document.documentElement.dataset.theme !== 'day';
  function queueTwinkle() {
    if (twinkleTimer || twinkle || !canTwinkle()) return;
    twinkleTimer = setTimeout(() => {
      twinkleTimer = 0;
      if (!canTwinkle()) return;
      twinkle = { index:Math.floor(random() * starCount()), start:performance.now(), duration:1400 + random() * 600 };
      schedule();
    }, 1400 + random() * 2000);
  }
  function resetTwinkle() {
    clearTimeout(twinkleTimer);
    twinkleTimer = 0;
    twinkle = null;
    if (pending) cancelAnimationFrame(pending);
    pending = 0;
    schedule();
  }
  function draw() {
    pending = 0;
    if (document.hidden) return;
    context.clearRect(0, 0, width, height);
    const day = document.documentElement.dataset.theme === 'day';
    context.fillStyle = day ? '#777777' : '#dedede';
    // Keep small screens as quiet as the desktop; density stays roughly constant.
    const count = starCount();
    const progress = twinkle ? (performance.now() - twinkle.start) / twinkle.duration : 0;
    if (twinkle && (progress >= 1 || !canTwinkle())) twinkle = null;
    for (let index = 0; index < count; index++) {
      const star = stars[index];
      const pulse = twinkle?.index === index ? Math.pow(Math.sin(Math.PI * Math.max(0, progress)), 3) : 0;
      const x = star.x * width;
      const y = ((star.y * height - offset * star.speed) % height + height) % height;
      context.globalAlpha = Math.min(1, star.opacity * (day ? .6 : 1) + pulse * .8);
      context.beginPath();
      context.arc(x, y, star.radius + pulse * .45, 0, Math.PI * 2);
      context.fill();
      if (pulse > .15) {
        const reach = 2 + pulse * 4, waist = .45;
        context.globalAlpha = pulse * .85;
        context.beginPath();
        context.moveTo(x, y - reach);
        context.lineTo(x + waist, y - waist);
        context.lineTo(x + reach * .75, y);
        context.lineTo(x + waist, y + waist);
        context.lineTo(x, y + reach);
        context.lineTo(x - waist, y + waist);
        context.lineTo(x - reach * .75, y);
        context.lineTo(x - waist, y - waist);
        context.closePath();
        context.fill();
      }
    }
    context.globalAlpha = 1;
    if (twinkle) schedule();
    else queueTwinkle();
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
  motion?.subscribe(value => { enabled = value; previousY = window.scrollY; resetTwinkle(); });
  document.addEventListener('visibilitychange', resetTwinkle);
  new MutationObserver(resetTwinkle).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  resize();
})();
