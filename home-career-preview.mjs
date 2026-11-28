// Keep a cursor preview inside the viewport, flipping left/up when space runs out.
export function previewPosition(x, y, width, height, viewportWidth, viewportHeight) {
  const edge = 12, gap = 20;
  const left = x + gap + width <= viewportWidth - edge ? x + gap : x - width - gap;
  const top = y + gap + height <= viewportHeight - edge ? y + gap : y - height - gap;
  return {
    left: Math.max(edge, Math.min(left, viewportWidth - width - edge)),
    top: Math.max(edge, Math.min(top, viewportHeight - height - edge)),
  };
}

if (typeof document !== 'undefined') {
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  document.querySelectorAll('[data-career-preview]').forEach(template => {
    const entry = template.closest('.career-entry');
    const floating = template.content.querySelector('figure').cloneNode(true);
    floating.classList.add('career-preview-floating');
    floating.setAttribute('aria-hidden', 'true');
    document.body.append(floating);
    const image = floating.querySelector('img');
    let blocked = false, active = false, frame = 0, point = null;
    function hide() {
      active = false;
      cancelAnimationFrame(frame); frame = 0;
      floating.classList.remove('is-visible');
    }
    function draw() {
      frame = 0;
      if (!active || !image.complete || !image.naturalWidth) return;
      const rect = floating.getBoundingClientRect();
      const position = previewPosition(point.x, point.y, rect.width, rect.height, innerWidth, innerHeight);
      floating.style.left = `${position.left}px`;
      floating.style.top = `${position.top}px`;
      floating.classList.add('is-visible');
    }
    image.addEventListener('load', () => { if (active && !frame) frame = requestAnimationFrame(draw); });
    entry.addEventListener('pointermove', event => {
      if (!finePointer.matches || event.pointerType !== 'mouse' || blocked) return;
      active = true;
      if (image.dataset.src) { image.src = image.dataset.src; delete image.dataset.src; }
      point = {x:event.clientX, y:event.clientY};
      if (!frame) frame = requestAnimationFrame(draw);
    });
    entry.addEventListener('pointerleave', () => { blocked = false; hide(); });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (active) { blocked = true; hide(); }
    });
    window.addEventListener('scroll', hide, {passive:true, capture:true});
    window.addEventListener('resize', hide);
    finePointer.addEventListener('change', hide);
  });
}
