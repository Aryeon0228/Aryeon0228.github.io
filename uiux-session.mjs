// Session storage keeps experiments in this tab; unavailable storage falls back to memory.
export function createExperimentSession(storage, key = 'penumbra-uiux-experiments-v1') {
  let saved = {};
  try {
    const parsed = JSON.parse(storage?.getItem(key) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed;
  } catch {}
  const persist = () => { try { storage?.setItem(key, JSON.stringify(saved)); } catch {} };
  return {
    get: id => Object.hasOwn(saved, id) ? saved[id] : undefined,
    set(id, state) { saved[id] = state; persist(); },
    clear(id) { delete saved[id]; persist(); },
  };
}

export function captureControls(root) {
  return Object.fromEntries([...root.querySelectorAll('input[id], select[id]')]
    .filter(input => input.type !== 'file')
    .map(input => [input.id, input.type === 'checkbox' ? input.checked : input.value]));
}

export function restoreControls(root, saved) {
  if (!saved || typeof saved !== 'object') return;
  for (const input of root.querySelectorAll('input[id], select[id]')) {
    const value = saved[input.id];
    if (input.type === 'checkbox') {
      if (typeof value === 'boolean') input.checked = value;
    } else if (typeof value === 'string' && input.type !== 'file') {
      if (input.tagName === 'SELECT' && ![...input.options].some(option => option.value === value)) continue;
      input.value = value;
    }
  }
}

export function savedRecords(state) {
  return Array.isArray(state?.records) ? state.records.filter(record => record && typeof record === 'object') : [];
}
