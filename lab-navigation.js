// Keep the current lab visible, with a grouped picker on narrow screens.
for (const nav of document.querySelectorAll('.lab-navigation')) {
  const links = [...nav.querySelectorAll('a')];
  const current = links.find(link => link.getAttribute('aria-current') === 'page');
  if (!current) continue;

  const picker = document.createElement('label');
  picker.className = 'lab-picker';
  const label = document.createElement('span');
  label.textContent = '랩 이동';
  const select = document.createElement('select');
  select.setAttribute('aria-label', '랩 이동');
  const groups = new Map();
  for (const link of links) {
    const name = link.dataset.labGroup;
    if (!groups.has(name)) {
      const group = document.createElement('optgroup');
      group.label = name;
      groups.set(name, group);
      select.append(group);
    }
    const option = document.createElement('option');
    option.value = link.href;
    option.textContent = link.textContent.trim();
    option.selected = link === current;
    groups.get(name).append(option);
  }
  select.addEventListener('change', () => {
    const destination = links.find(link => link.href === select.value);
    if (destination && destination !== current) window.location.assign(destination.href);
  });
  picker.append(label, select);
  nav.after(picker);
  nav.parentElement.classList.add('has-lab-picker');

  const revealCurrent = () => {
    if (!nav.clientWidth) return;
    const bounds = nav.getBoundingClientRect();
    const link = current.getBoundingClientRect();
    const style = getComputedStyle(nav);
    const left = bounds.left + parseFloat(style.paddingLeft);
    const right = bounds.right - parseFloat(style.paddingRight);
    if (link.right > right) nav.scrollLeft += link.right - right;
    else if (link.left < left) nav.scrollLeft -= left - link.left;
  };
  revealCurrent();
  document.fonts.ready.then(revealCurrent);
  window.addEventListener('resize', revealCurrent);
  window.addEventListener('pageshow', () => {
    select.value = current.href;
    revealCurrent();
  });
}
