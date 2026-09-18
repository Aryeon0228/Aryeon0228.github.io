// Shooting stars live behind the hero copy, independently of its cursor trail.
const hero = document.querySelector('.hero');
const canvas = document.getElementById('meteor-sky');
const ctx = canvas?.getContext('2d');

if (hero && ctx) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const controls = '.rack,a,button,input,select,textarea,summary,.hero-name,.hero-role,.hero-mark,.tele';
  let width = 0, height = 0, ratio = 1;
  let visible = false, frame = 0, ambientTimer = 0;
  let stars = [], previous = null, press = null, travel = 0;
  let lastFlick = -2000, lastTap = -1000;
  let day = document.documentElement.dataset.theme === 'day';

  const canAnimate = () => visible && !document.hidden && !reducedMotion.matches && width > 0 && height > 0;
  const random = (min, max) => min + Math.random() * (max - min);

  function resetPointer() {
    previous = null;
    press = null;
    travel = 0;
  }

  function stop() {
    cancelAnimationFrame(frame);
    clearTimeout(ambientTimer);
    frame = 0;
    ambientTimer = 0;
    stars = [];
    resetPointer();
    ctx.clearRect(0, 0, width, height);
  }

  function scheduleAmbient(delay = random(3800, 7200)) {
    if (!canAnimate() || ambientTimer) return;
    ambientTimer = window.setTimeout(() => {
      ambientTimer = 0;
      if (!canAnimate()) return;
      // Keep the quiet, unprompted stars near the planetary side of the hero.
      const compact = width <= 640;
      spawn(width * random(compact ? .48 : .64, .97), height * random(compact ? .43 : .08, compact ? .62 : .38), false);
      scheduleAmbient();
    }, delay);
  }

  function sync() {
    if (!canAnimate()) stop();
    else scheduleAmbient(1400);
  }

  function resize() {
    const w = hero.clientWidth, h = hero.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (w === width && h === height && dpr === ratio) return;
    stop();
    width = w; height = h; ratio = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sync();
  }

  function spawn(x, y, interactive, direction = -1) {
    if (!canAnimate() || stars.length >= 3) return;
    const angle = random(.53, .82);
    const speed = Math.min(width, 1100) * random(.36, .54);
    stars.push({
      x, y, born: performance.now(), life: random(850, 1250),
      vx: Math.cos(angle) * speed * direction, vy: Math.sin(angle) * speed,
      tail: Math.min(width * .2, random(90, 155)),
      strength: interactive ? .88 : .58,
      size: interactive ? 1.2 : .85,
    });
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function draw(now) {
    frame = 0;
    if (!canAnimate()) { stop(); return; }
    ctx.clearRect(0, 0, width, height);
    stars = stars.filter(star => now - star.born < star.life);
    const ink = day ? '68,74,84' : '237,240,247';
    for (const star of stars) {
      const elapsed = now - star.born, age = elapsed / star.life;
      const fade = Math.min(1, age / .09) * Math.pow(1 - age, 1.3) * star.strength;
      const x = star.x + star.vx * elapsed / 1000;
      const y = star.y + star.vy * elapsed / 1000;
      const speed = Math.hypot(star.vx, star.vy);
      const ux = star.vx / speed, uy = star.vy / speed;
      const tail = Math.min(star.tail, speed * elapsed / 1000);
      if (tail < 1) continue;
      const tx = x - ux * tail, ty = y - uy * tail;
      const trail = ctx.createLinearGradient(tx, ty, x, y);
      trail.addColorStop(0, `rgba(${ink},0)`);
      trail.addColorStop(.65, `rgba(${ink},${fade * .22})`);
      trail.addColorStop(1, `rgba(${ink},${fade})`);
      ctx.strokeStyle = trail;
      ctx.lineCap = 'round';
      ctx.lineWidth = star.size;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();

      const glow = ctx.createRadialGradient(x, y, 0, x, y, 5);
      glow.addColorStop(0, `rgba(${ink},${fade})`);
      glow.addColorStop(.22, `rgba(${ink},${fade * .4})`);
      glow.addColorStop(1, `rgba(${ink},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      // A few tiny remnants share the existing cursor's silver dust treatment.
      for (let n = 1; n <= 3; n++) {
        const lag = tail * (.3 + n * .17);
        const spread = (n % 2 ? 1 : -1) * age * n * 2;
        ctx.fillStyle = `rgba(${ink},${fade * .32 * (1 - n * .18)})`;
        ctx.fillRect(x - ux * lag - uy * spread, y - uy * lag + ux * spread, .8, .8);
      }
    }
    if (stars.length) frame = requestAnimationFrame(draw);
  }

  function point(event) {
    const bounds = hero.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top, t: performance.now() };
  }

  hero.addEventListener('pointermove', event => {
    if (press && press.id === event.pointerId) {
      const current = point(event);
      if (Math.hypot(current.x - press.x, current.y - press.y) > 8) press = null;
    }
    if (!canAnimate() || event.pointerType !== 'mouse' || !finePointer.matches || event.buttons || event.target.closest(controls)) {
      previous = null; travel = 0;
      return;
    }
    const current = point(event);
    if (previous) {
      const dt = current.t - previous.t;
      const dx = current.x - previous.x, dy = current.y - previous.y;
      const distance = Math.hypot(dx, dy);
      if (dt < 120 && distance < 220 && distance / Math.max(dt, 8) > .65) travel += distance;
      else travel = 0;
      if (travel > 85 && current.t - lastFlick > 1500) {
        spawn(current.x, current.y, true, dx > 0 ? 1 : -1);
        lastFlick = current.t;
        travel = 0;
      }
    }
    previous = current;
  }, { passive: true });

  // A short tap on empty sky also works on touchscreens; scrolling and planet
  // dragging keep their native behavior and never launch a star.
  hero.addEventListener('pointerdown', event => {
    press = canAnimate() && event.isPrimary && event.button === 0 && !event.target.closest(controls)
      ? { ...point(event), id: event.pointerId } : null;
  }, { passive: true });
  hero.addEventListener('pointerup', event => {
    const start = press;
    press = null;
    if (!start || start.id !== event.pointerId || event.target.closest(controls) || event.defaultPrevented) return;
    const end = point(event);
    if (end.t - start.t < 450 && Math.hypot(end.x - start.x, end.y - start.y) < 8 && end.t - lastTap > 450) {
      spawn(end.x, end.y, true);
      lastTap = end.t;
    }
  }, { passive: true });
  hero.addEventListener('pointerleave', resetPointer, { passive: true });
  hero.addEventListener('pointercancel', resetPointer, { passive: true });
  window.addEventListener('scroll', resetPointer, { passive: true });
  window.addEventListener('blur', stop);
  window.addEventListener('focus', sync);
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', sync);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
  finePointer.addEventListener('change', resetPointer);
  window.addEventListener('penumbra-theme-change', () => {
    day = document.documentElement.dataset.theme === 'day';
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      sync();
    }, { threshold: .05 }).observe(hero);
  } else visible = true;
  window.addEventListener('resize', resize, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero);
  resize();
}
