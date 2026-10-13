'use strict';
// Copy only text the student can read on the page; manual selection remains available.
for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const source = document.getElementById(button.dataset.copy);
    const status = document.getElementById(button.dataset.status);
    if (!source || !status) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(source.value);
      status.textContent = '요청문을 복사했어요. 대괄호를 자기 작업에 맞게 바꿔 사용하세요.';
    } catch {
      source.focus();
      source.select();
      status.textContent = '자동 복사가 제한되어 문장을 선택했어요. Ctrl+C 또는 ⌘C로 직접 복사하세요.';
    }
  });
}
