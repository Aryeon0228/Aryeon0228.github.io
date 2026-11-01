// Resolve motion before the page paints. An explicit site choice takes priority
// over the system preference, while a first visit still respects reduced motion.
(function () {
  'use strict';

  const key = 'penumbra-motion';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new Set();
  let storage = null, preference = null, button = null;
  const readPreference = value => value === 'on' || value === 'off' ? value : null;

  try {
    storage = window.localStorage;
    preference = readPreference(storage.getItem(key));
  } catch (_) { /* The current visit still works when storage is unavailable. */ }

  let enabled = preference === null ? !system.matches : preference === 'on';
  root.dataset.motion = enabled ? 'on' : 'off';

  function updateButton() {
    if (!button) return;
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-label', 'Animation');
    button.setAttribute('aria-checked', String(enabled));
    button.dataset.state = enabled ? 'on' : 'off';
    const label = button.querySelector('[data-motion-label]');
    if (label) label.textContent = enabled ? 'On' : 'Off';
  }

  function sync() {
    const next = preference === null ? !system.matches : preference === 'on';
    if (next === enabled) return;
    enabled = next;
    root.dataset.motion = enabled ? 'on' : 'off';
    updateButton();
    listeners.forEach(listener => listener(enabled));
    window.dispatchEvent(new CustomEvent('penumbra-motion-change', { detail: { enabled } }));
  }

  window.penumbraMotion = Object.freeze({
    get enabled() { return enabled; },
    setEnabled(value) {
      if (typeof value !== 'boolean') throw new TypeError('Motion preference must be a boolean.');
      preference = value ? 'on' : 'off';
      try { storage?.setItem(key, preference); } catch (_) {}
      sync();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });

  system.addEventListener('change', sync);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    if (event.storageArea && event.storageArea !== storage) return;
    preference = readPreference(event.newValue);
    sync();
  });

  function bindButton() {
    button = document.getElementById('motion-toggle');
    if (!button) return;
    updateButton();
    button.hidden = false;
    button.addEventListener('click', () => window.penumbraMotion.setEnabled(!enabled));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindButton, { once: true });
  else bindButton();
})();
