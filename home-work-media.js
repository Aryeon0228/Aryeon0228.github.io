// Each figure accepts data-image (poster), data-video (optional MP4), and data-alt.
// Empty sources keep the shared placeholder; videos are fetched only on demand.
(() => {
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  for (const media of document.querySelectorAll('[data-work-media]')) {
    const card = media.closest('.work-card');
    const placeholder = media.querySelector('.work-media-placeholder');
    let image = media.querySelector('img');
    if (media.dataset.image && !image) {
      image = document.createElement('img');
      image.alt = media.dataset.alt || '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('load', () => { if (placeholder) placeholder.hidden = true; });
      image.addEventListener('error', () => { image.hidden = true; if (placeholder) placeholder.hidden = false; });
      image.src = media.dataset.image;
      media.append(image);
    }
    const gallery = [...media.querySelectorAll('img')];
    if (gallery.length > 1) {
      const navigation = document.createElement('div');
      navigation.className = 'work-media-pages';
      navigation.setAttribute('role', 'group');
      navigation.setAttribute('aria-label', `${card.querySelector('h4')?.textContent || '작업'} 이미지 선택`);
      const buttons = gallery.map((item, index) => {
        const page = document.createElement('button');
        page.type = 'button';
        page.textContent = String(index + 1);
        page.setAttribute('aria-label', `${index + 1} / ${gallery.length}: ${item.alt}`);
        page.setAttribute('aria-pressed', String(index === 0));
        item.hidden = index !== 0;
        page.addEventListener('click', () => {
          gallery.forEach((image, i) => { image.hidden = i !== index; });
          buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
        });
        navigation.append(page);
        return page;
      });
      media.append(navigation);
    }
    if (!media.dataset.video) continue;
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.setAttribute('aria-hidden', 'true');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'work-media-toggle';
    const title = card.querySelector('h4')?.textContent || '작업';
    let active = false;
    let request = 0;
    const label = () => {
      button.textContent = active ? 'Ⅱ 정지' : '▷ 재생';
      button.setAttribute('aria-label', `${title} 미리보기 ${active ? '정지' : '재생'}`);
      button.setAttribute('aria-pressed', String(active));
    };
    const stop = () => {
      request++;
      active = false;
      video.pause();
      media.classList.remove('is-playing');
      label();
    };
    const play = async () => {
      const token = ++request;
      active = true;
      label();
      if (!video.getAttribute('src')) video.src = media.dataset.video;
      try {
        await video.play();
        if (token !== request) { if (!active) video.pause(); return; }
        media.classList.add('is-playing');
      } catch (_) { if (token === request) stop(); }
    };
    label();
    button.addEventListener('click', () => active ? stop() : play());
    video.addEventListener('error', stop);
    card.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && hover.matches && window.penumbraMotion?.enabled !== false) play();
    });
    card.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') stop(); });
    window.penumbraMotion?.subscribe(enabled => { if (!enabled) stop(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    new IntersectionObserver(entries => { if (!entries[0].isIntersecting) stop(); }).observe(card);
    media.append(video, button);
  }
})();
