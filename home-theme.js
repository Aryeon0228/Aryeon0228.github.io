// Start in dark mode; an explicit choice is remembered across visits and tabs.
const root = document.documentElement;
const key = 'penumbra-theme';
const toggle = document.getElementById('theme-toggle');
let preference = null;
try { const saved = localStorage.getItem(key); if (saved === 'day' || saved === 'night') preference = saved; } catch {}

function applyTheme(theme) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme === 'day' ? 'light' : 'dark';
  toggle?.setAttribute('aria-checked', String(theme === 'night'));
  if (toggle) toggle.title = theme === 'night' ? '라이트 모드로 전환' : '다크 모드로 전환';
  document.getElementById('gl')?.setAttribute('aria-label', theme === 'day'
    ? '옅은 청회색 하늘에 세레니티빛 행성과 연보랏빛 고리가 떠 있습니다. 작은 위성과 파스텔빛 별이 주변을 채웁니다.'
    : '어둠 속 행성의 가장자리에 은빛 초승달이 떠 있습니다. 희미한 구름결과 실 같은 고리 사이로 작은 위성이 공전하고, 먼 별들이 은은하게 반짝입니다.');
  window.dispatchEvent(new CustomEvent('penumbra-theme-change', { detail: { theme } }));
}
function currentTheme() { return preference || 'night'; }
toggle?.addEventListener('click', () => {
  preference = currentTheme() === 'night' ? 'day' : 'night';
  try { localStorage.setItem(key, preference); } catch {}
  applyTheme(preference);
});
window.addEventListener('storage', event => {
  if (event.key !== key && event.key !== null) return;
  preference = event.key === key && (event.newValue === 'day' || event.newValue === 'night') ? event.newValue : null;
  applyTheme(currentTheme());
});
applyTheme(currentTheme());
