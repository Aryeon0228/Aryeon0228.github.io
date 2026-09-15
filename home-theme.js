// The first visit follows the device; an explicit choice is remembered locally.
const root = document.documentElement;
const key = 'penumbra-theme';
const system = matchMedia('(prefers-color-scheme: dark)');
const choices = Array.from(document.querySelectorAll('[data-theme-choice]'));
let preference = null;
try { const saved = localStorage.getItem(key); if (saved === 'day' || saved === 'night') preference = saved; } catch {}

function applyTheme(theme) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme === 'day' ? 'light' : 'dark';
  choices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme)));
  document.getElementById('gl')?.setAttribute('aria-label', theme === 'day'
    ? '밝은 천문도 위에 흰 진주빛 행성과 섬세한 고리가 떠 있습니다. 행성의 그림자 사이로 작은 위성이 공전하고, 먼 별과 궤도 눈금이 은은하게 보입니다.'
    : '어둠 속 행성의 가장자리에 은빛 초승달이 떠 있습니다. 희미한 구름결과 실 같은 고리 사이로 작은 위성이 공전하고, 먼 별들이 은은하게 반짝입니다.');
  window.dispatchEvent(new CustomEvent('penumbra-theme-change', { detail: { theme } }));
}
function currentTheme() { return preference || (system.matches ? 'night' : 'day'); }
for (const button of choices) button.addEventListener('click', () => {
  preference = button.dataset.themeChoice;
  try { localStorage.setItem(key, preference); } catch {}
  applyTheme(preference);
});
system.addEventListener('change', () => { if (!preference) applyTheme(currentTheme()); });
window.addEventListener('storage', event => {
  if (event.key !== key && event.key !== null) return;
  preference = event.newValue === 'day' || event.newValue === 'night' ? event.newValue : null;
  applyTheme(currentTheme());
});
applyTheme(currentTheme());
