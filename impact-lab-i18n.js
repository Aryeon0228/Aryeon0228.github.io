(() => {
  'use strict';
  // One shared vocabulary for the controls, live messages, and canvas.
  const copy = {
    'page.title': ['타격감 랩 | Studio Penumbra', 'Impact Lab | Studio Penumbra'],
    'page.description': ['같은 공격에 효과를 하나씩 더하며 타격감을 비교하는 수업용 게임 데모.', 'Explore game feel by adding hit stop, recoil, screen shake, particles, and sound to the same attack.'],
    'app.name': ['타격감 랩', 'Impact Lab'],
    'home': ['Studio Penumbra의 Lab 목록으로', 'Back to Studio Penumbra Labs'],
    'toolbar': ['화면 설정', 'Display controls'],
    'language': ['언어 선택', 'Choose language'],
    'pause': ['일시정지', 'Pause'],
    'resume': ['계속하기', 'Resume'],
    'pause.hint': ['일시정지 / 계속하기 (P)', 'Pause / resume (P)'],
    'reset': ['처음부터', 'Reset'],
    'reset.hint': ['처음부터 (R)', 'Reset (R)'],
    'fullscreen': ['전체 화면', 'Fullscreen'],
    'fullscreen.exit': ['전체 화면 종료', 'Exit fullscreen'],
    'panel.show': ['효과 설정', 'Effects'],
    'panel.hide': ['설정 숨기기', 'Hide controls'],
    'panel.show.aria': ['효과 설정 열기', 'Show effect controls'],
    'panel.hide.aria': ['효과 설정 숨기기', 'Hide effect controls'],
    'game': ['타격감 게임', 'Game feel playground'],
    'game.aria': ['타격감 연습장. 방향키나 WASD로 이동하고 마우스로 조준합니다. 클릭하면 발사하고 스페이스 키로 근접 공격합니다.', 'Game feel playground. Move with WASD or arrow keys, aim with the mouse, hold the mouse button to fire, and press Space for a melee attack.'],
    'touch': ['터치 조작', 'Touch controls'],
    'move': ['이동', 'Move'],
    'move.up': ['위로 이동', 'Move up'],
    'move.down': ['아래로 이동', 'Move down'],
    'move.left': ['왼쪽으로 이동', 'Move left'],
    'move.right': ['오른쪽으로 이동', 'Move right'],
    'melee': ['근접', 'Melee'],
    'fire': ['발사', 'Fire'],
    'arrows': ['방향키', 'Arrows'],
    'mouse': ['마우스', 'Mouse'],
    'aim': ['조준 · 클릭 연사', 'Aim · hold to fire'],
    'melee.instruction': ['근접 공격', 'Melee attack'],
    'touch.instruction': ['화면을 눌러 조준 · 방향 버튼으로 이동', 'Tap to aim · use the arrows to move'],
    'auto': ['자동 시연', 'Auto demo'],
    'effects.aria': ['타격 효과 설정', 'Impact effect controls'],
    'effects.eyebrow': ['같은 공격, 다른 느낌', 'Same attack, different feel'],
    'effects.heading': ['효과 조절', 'Effects'],
    'effects.none': ['효과 없음', 'All off'],
    'effects.active': ['{count}개 켜짐', '{count} on'],
    'effects.all': ['전체 효과 설정', 'Control all effects'],
    'effects.on': ['모두 켜기', 'All on'],
    'effects.off': ['모두 끄기', 'All off'],
    'compare': ['기본과 비교', 'Compare effects'],
    'compare.hint': ['현재 설정 잠깐 끄기', 'Temporarily turn off'],
    'compare.restore': ['내 설정으로 돌아가기', 'Restore my setup'],
    'compare.off': ['지금은 효과 없음', 'Effects are off'],
    'compare.shortcut': ['기본과 비교 / 내 설정으로 돌아가기 (B)', 'Compare / restore effects (B)'],
    'solo': ['이것만', 'Solo'],
    'solo.aria': ['{name}만 켜기', 'Enable only {name}'],
    'effect.hitstop': ['히트 스톱', 'Hit stop'],
    'effect.hitstop.description': ['맞는 순간, 동작을 잠깐 멈추기', 'Briefly freeze the action on impact'],
    'effect.hitstop.range': ['히트 스톱 시간', 'Hit stop duration'],
    'effect.shake': ['화면 흔들림', 'Screen shake'],
    'effect.shake.description': ['충돌할 때 카메라를 짧게 흔들기', 'Shake the camera briefly on impact'],
    'effect.shake.range': ['화면 흔들림 강도', 'Screen shake strength'],
    'effect.recoil': ['발사 반동', 'Recoil'],
    'effect.recoil.description': ['쏘는 순간 무기가 뒤로 움직이기', 'Kick the weapon back when firing'],
    'effect.recoil.range': ['발사 반동 크기', 'Recoil distance'],
    'effect.knockback': ['피격 반응', 'Knockback'],
    'effect.knockback.description': ['맞은 표적이 밀렸다가 돌아오기', 'Push the target back, then let it return'],
    'effect.knockback.range': ['피격 반응 크기', 'Knockback distance'],
    'effect.particles': ['타격 입자', 'Impact particles'],
    'effect.particles.description': ['맞은 위치에서 빛 조각이 퍼지기', 'Scatter sparks from the point of impact'],
    'effect.particles.range': ['타격 입자 수', 'Particle count'],
    'effect.flash': ['피격 점멸', 'Hit flash'],
    'effect.flash.description': ['맞은 표적을 잠깐 밝게 보여주기', 'Briefly brighten the target when hit'],
    'effect.flash.range': ['피격 점멸 시간', 'Hit flash duration'],
    'effect.sound': ['타격 소리', 'Sound effects'],
    'effect.sound.description': ['발사와 충돌 순간에 소리 맞추기', 'Play sounds in sync with shots and hits'],
    'effect.sound.range': ['타격 소리 음량', 'Sound volume'],
    'particles.unit': ['개', ''],
    'particles.value': ['{count}개', '{count} particles'],
    'reduced': ['움직임 줄이기', 'Reduce motion'],
    'note.damage': ['공격력과 탄속은 그대로.', 'Damage and bullet speed stay the same.'],
    'note.hitstop': ['히트 스톱은 동작을 잠시 멈춰요.', 'Hit stop briefly pauses the action.'],
    'message.compare': ['효과를 끈 기본 상태예요. 다시 누르면 내 설정으로 돌아가요.', 'Effects are off. Press again to restore your setup.'],
    'message.restore': ['비교하기 전 설정으로 돌아왔어요.', 'Your effect settings have been restored.'],
    'message.solo': ['{name}만 켰어요.', 'Only {name} is on.'],
    'message.reset': ['표적과 기록을 처음 상태로 돌렸어요.', 'Targets and scores have been reset.'],
    'message.fullscreen.unsupported': ['이 브라우저에서는 전체 화면 버튼을 지원하지 않아요.', 'This browser does not support the fullscreen button.'],
    'message.fullscreen.failed': ['전체 화면을 열지 못했어요. 브라우저의 전체 화면 기능을 이용해 주세요.', 'Could not enter fullscreen. Try your browser’s fullscreen option.'],
    'canvas.practice': ['자유 연습장', 'Free practice'],
    'canvas.start': ['시작 위치', 'START'],
    'canvas.zone': ['표적 구역', 'TARGET ZONE'],
    'canvas.damage': ['발사당 피해량 10', '10 DAMAGE / SHOT'],
    'canvas.respawning': ['재생성 중', 'Respawning'],
    'canvas.target': ['표적 {name}', 'Target {name}'],
    'canvas.you': ['플레이어', 'YOU'],
    'canvas.hits': ['명중', 'HITS'],
    'canvas.destroyed': ['{count}개 표적 격파', 'Targets destroyed: {count}'],
    'canvas.combo': ['{count} 연속 명중', '{count} COMBO'],
    'canvas.hint': ['화면을 클릭해 연사 · 가까이 가서 Space 공격', 'Hold click to fire · move closer and press Space to melee'],
    'canvas.auto': ['자동 사격 중', 'Auto firing'],
    'canvas.paused': ['잠깐 멈춤', 'Paused'],
    'canvas.resume': ['P 키 또는 재개 버튼', 'Press P or choose Resume']
  };
  const storageKey = 'impact-lab-language';
  let language = 'ko';
  try { if (localStorage.getItem(storageKey) === 'en') language = 'en'; } catch { /* Storage is optional, including in offline files. */ }
  function t(key, values = {}) {
    const text = copy[key]?.[language === 'en' ? 1 : 0] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
  }
  function setLanguage(next) {
    if (!['ko', 'en'].includes(next) || next === language) return;
    language = next;
    try { localStorage.setItem(storageKey, language); } catch { /* Continue without persistence. */ }
    apply();
    window.dispatchEvent(new CustomEvent('impact:language', {detail: {language}}));
  }
  function apply() {
    document.documentElement.lang = language;
    document.title = t('page.title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('page.description'));
    document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    ['aria-label', 'title'].forEach(attribute => {
      document.querySelectorAll('[data-i18n-' + attribute + ']').forEach(element => {
        element.setAttribute(attribute, t(element.getAttribute('data-i18n-' + attribute)));
      });
    });
    document.querySelectorAll('[data-language]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    });
  }
  window.impactI18n = {t, setLanguage, get language() { return language; }};
  apply();
  document.querySelectorAll('[data-language]').forEach(button => {
    button.addEventListener('click', () => setLanguage(button.dataset.language));
  });
})();
