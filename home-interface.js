/* Interaction patterns inspired by Lucian UX/UI; see licenses/lucian-uxui.txt. */
(() => {
  'use strict';
  const timeline = document.querySelector('.career-timeline');
  if (timeline) {
    const entries = [...timeline.querySelectorAll('.career-entry')];
    let scheduled = false;
    function update() {
      scheduled = false;
      const rect = timeline.getBoundingClientRect();
      const readingLine = window.innerHeight * 0.55;
      const enabled = window.penumbraMotion?.enabled !== false;
      const progress = Math.max(0, Math.min(1, (readingLine - rect.top) / rect.height));
      timeline.style.setProperty('--reading-progress', enabled ? progress : 0);
      entries.forEach(entry => entry.classList.toggle('is-reached', enabled && entry.getBoundingClientRect().top + 16 <= readingLine));
    }
    function schedule() {
      if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('load', schedule, { once: true });
    window.penumbraMotion?.subscribe(schedule);
    document.fonts?.ready.then(schedule);
    update();
  }

  const copy = document.querySelector('.email-copy');
  if (copy) {
    const status = document.querySelector('.email-copy-status');
    const email = document.querySelector('.contact-email a').getAttribute('href').slice(7);
    let timer;
    copy.hidden = false;
    copy.addEventListener('click', async () => {
      clearTimeout(timer);
      copy.disabled = true;
      status.textContent = '';
      try {
        await navigator.clipboard.writeText(email);
        copy.dataset.state = 'copied';
        status.textContent = '이메일 주소를 복사했어요.';
      } catch (_) {
        copy.dataset.state = 'error';
        status.textContent = '복사 실패 · 주소를 직접 선택해 주세요.';
      } finally {
        copy.disabled = false;
        timer = setTimeout(() => {
          delete copy.dataset.state;
          status.textContent = '';
        }, 5000);
      }
    });
  }

  // Space is already reserved by each preview's CSS. Never hide a cached image.
  document.querySelectorAll('#lab .lab-mini-preview img, #lab .diorama-stage > img').forEach(img => {
    const finish = () => { img.dataset.previewState = img.naturalWidth ? 'ready' : 'error'; };
    img.addEventListener('load', finish, { once: true });
    img.addEventListener('error', finish, { once: true });
    if (img.complete) finish();
    else img.dataset.previewState = 'loading';
  });
})();
