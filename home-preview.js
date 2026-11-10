/* Native buttons keep Tab/Enter/Space behavior; only the selected capture changes. */
for (const preview of document.querySelectorAll('[data-coach-preview]')) {
  const choices = [...preview.querySelectorAll('[data-preview-choice]')];
  const panels = [...preview.querySelectorAll('[data-preview-panel]')];
  for (const choice of choices) {
    choice.addEventListener('click', () => {
      for (const button of choices) {
        button.setAttribute('aria-pressed', String(button === choice));
      }
      for (const panel of panels) {
        panel.hidden = panel.dataset.previewPanel !== choice.dataset.previewChoice;
      }
    });
  }
}
