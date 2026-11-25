(() => {
  'use strict';
  const copy = {
    "effects.description": ["효과 설명", "Effect description"],
    "page.title": ["Game Feel Lab | Studio Penumbra", "Game Feel Lab | Studio Penumbra"],
    "page.description": ["동작·카메라·빛·소리, 16가지 효과를 켜고 끄며 타격감을 실험하는 게임 데모.", "Toggle 16 effects across motion, camera, target feedback, visuals, and sound to explore game feel."],
    "app.name": ["Game Feel Lab", "Game Feel Lab"],
    "home": ["Studio Penumbra의 Lab 목록으로", "Back to Studio Penumbra Labs"],
    "toolbar": ["화면 설정", "Display controls"],
    "language": ["언어 선택", "Choose language"],
    "pause": ["일시정지", "Pause"],
    "resume": ["계속하기", "Resume"],
    "pause.hint": ["일시정지 / 계속하기 (P)", "Pause / resume (P)"],
    "reset": ["처음부터", "Reset"],
    "reset.hint": ["처음부터 (R)", "Reset (R)"],
    "fullscreen": ["전체 화면", "Fullscreen"],
    "fullscreen.exit": ["전체 화면 종료", "Exit fullscreen"],
    "panel.show": ["효과 설정", "Effects"],
    "panel.hide": ["설정 숨기기", "Hide controls"],
    "panel.show.aria": ["효과 설정 열기", "Show effect controls"],
    "panel.hide.aria": ["효과 설정 숨기기", "Hide effect controls"],
    "game": ["타격감 게임", "Game feel playground"],
    "game.aria": ["타격감 연습장. 방향키나 WASD로 이동하고 마우스로 조준합니다. 클릭하면 발사하고 스페이스 키로 근접 공격합니다.", "Game feel playground. Move with WASD or arrow keys, aim with the mouse, hold the mouse button to fire, and press Space for a melee attack."],
    "touch": ["터치 조작", "Touch controls"],
    "move": ["이동", "Move"],
    "move.up": ["위로 이동", "Move up"],
    "move.down": ["아래로 이동", "Move down"],
    "move.left": ["왼쪽으로 이동", "Move left"],
    "move.right": ["오른쪽으로 이동", "Move right"],
    "melee": ["근접", "Melee"],
    "fire": ["발사", "Fire"],
    "arrows": ["방향키", "Arrows"],
    "mouse": ["마우스", "Mouse"],
    "aim": ["조준 · 클릭 연사", "Aim · hold to fire"],
    "melee.instruction": ["근접 공격", "Melee attack"],
    "touch.instruction": ["화면을 눌러 조준 · 방향 버튼으로 이동", "Tap to aim · use the arrows to move"],
    "auto": ["자동 시연", "Auto demo"],
    "effects.aria": ["타격 효과 설정", "Impact effect controls"],
    "effects.eyebrow": ["같은 공격, 다른 느낌", "Same attack, different feel"],
    "effects.heading": ["효과 스위치", "Effect switches"],
    "effects.none": ["0 / {total} 켜짐", "0 / {total} on"],
    "effects.active": ["{count} / {total} 켜짐", "{count} / {total} on"],
    "effects.all": ["전체 효과 설정", "Control all effects"],
    "effects.on": ["모두 켜기", "All on"],
    "effects.off": ["모두 끄기", "All off"],
    "reduced": ["움직임 줄이기", "Reduce motion"],
    "note.damage": ["공격력·탄속은 동일", "Same damage & bullet speed"],
    "note.hitstop": ["히트 스톱은 동작을 잠시 멈춰요.", "Hit stop briefly pauses the action."],
    "message.reset": ["표적과 기록을 처음 상태로 돌렸어요.", "Targets and scores have been reset."],
    "message.fullscreen.unsupported": ["이 브라우저에서는 전체 화면 버튼을 지원하지 않아요.", "This browser does not support the fullscreen button."],
    "message.fullscreen.failed": ["전체 화면을 열지 못했어요. 브라우저의 전체 화면 기능을 이용해 주세요.", "Could not enter fullscreen. Try your browser’s fullscreen option."],
    "canvas.practice": ["자유 연습장", "Free practice"],
    "canvas.start": ["시작 위치", "START"],
    "canvas.zone": ["표적 구역", "TARGET ZONE"],
    "canvas.damage": ["발사당 피해량 10", "10 DAMAGE / SHOT"],
    "canvas.respawning": ["재생성 중", "Respawning"],
    "canvas.target": ["표적 {name}", "Target {name}"],
    "canvas.you": ["플레이어", "YOU"],
    "canvas.hits": ["명중", "HITS"],
    "canvas.destroyed": ["{count}개 표적 격파", "Targets destroyed: {count}"],
    "canvas.combo": ["{count} 연속 명중", "{count} COMBO"],
    "canvas.hint": ["화면을 클릭해 연사 · 가까이 가서 Space 공격", "Hold click to fire · move closer and press Space to melee"],
    "canvas.auto": ["자동 사격 중", "Auto firing"],
    "canvas.paused": ["잠깐 멈춤", "Paused"],
    "canvas.resume": ["P 키 또는 계속하기 버튼", "Press P or choose Resume"],
    "group.motion": ["동작·카메라", "Action & camera"],
    "group.target": ["피격 반응", "Target response"],
    "group.visual": ["빛·입자", "Light & particles"],
    "group.audio": ["소리", "Sound"],
    "effects.help": ["효과 이름을 눌러 켜고 끄기", "Click an effect to toggle it"],
    "effect.hitstop": ["히트 스톱", "Hit stop"],
    "effect.hitstop.description": ["맞는 순간 동작을 잠깐 멈추기", "Briefly freeze the action on impact"],
    "effect.hitstop.term": ["Hit stop", "Hit stop"],
    "effect.shake": ["화면 흔들림", "Screen shake"],
    "effect.shake.description": ["충돌할 때 카메라를 짧게 흔들기", "Shake the camera briefly on impact"],
    "effect.shake.term": ["Screen shake", "Screen shake"],
    "effect.zoom": ["타격 줌", "Impact zoom"],
    "effect.zoom.description": ["맞는 순간 화면을 살짝 확대했다가 되돌리기", "Punch the camera in briefly on impact"],
    "effect.zoom.term": ["Impact zoom", "Impact zoom"],
    "effect.recoil": ["무기 반동", "Weapon recoil"],
    "effect.recoil.description": ["공격할 때 무기가 뒤로 움직이기", "Kick the weapon back when attacking"],
    "effect.recoil.term": ["Weapon recoil", "Weapon recoil"],
    "effect.knockback": ["넉백", "Knockback"],
    "effect.knockback.description": ["맞은 표적이 밀렸다가 돌아오기", "Push the target back, then let it return"],
    "effect.knockback.term": ["Knockback", "Knockback"],
    "effect.squash": ["눌림·복원", "Squash & stretch"],
    "effect.squash.description": ["맞은 표적이 찌그러졌다가 원래 모양으로 돌아오기", "Squash the target on impact, then restore its shape"],
    "effect.squash.term": ["Squash & stretch", "Squash & stretch"],
    "effect.flash": ["피격 점멸", "Hit flash"],
    "effect.flash.description": ["맞은 표적을 잠깐 밝게 보여주기", "Briefly brighten the target when hit"],
    "effect.flash.term": ["Hit flash", "Hit flash"],
    "effect.damage": ["피해 숫자", "Damage numbers"],
    "effect.damage.description": ["맞힌 위치 위로 피해량을 띄우기", "Float the damage amount above the target"],
    "effect.damage.term": ["Damage numbers", "Damage numbers"],
    "effect.muzzle": ["총구 섬광", "Muzzle flash"],
    "effect.muzzle.description": ["총을 쏘는 순간 총구에서 빛이 번쩍이기", "Flash a burst of light at the muzzle when firing"],
    "effect.muzzle.term": ["Muzzle flash", "Muzzle flash"],
    "effect.trail": ["탄환 궤적", "Bullet trail"],
    "effect.trail.description": ["날아가는 탄환 뒤에 빛의 꼬리를 남기기", "Leave a light trail behind each bullet"],
    "effect.trail.term": ["Bullet trail", "Bullet trail"],
    "effect.particles": ["타격 입자", "Impact particles"],
    "effect.particles.description": ["맞은 위치에서 작은 빛 조각을 흩뿌리기", "Scatter small sparks from the point of impact"],
    "effect.particles.term": ["Impact particles", "Impact particles"],
    "effect.shockwave": ["충격파", "Shockwave"],
    "effect.shockwave.description": ["맞은 위치에서 원형 파동이 퍼지기", "Expand a ring from the point of impact"],
    "effect.shockwave.term": ["Shockwave", "Shockwave"],
    "effect.defeatburst": ["격파 파편", "Break fragments"],
    "effect.defeatburst.description": ["표적의 체력이 0이 되면 큰 파편을 흩뿌리기", "Scatter larger fragments when a target reaches zero HP"],
    "effect.defeatburst.term": ["Break fragments", "Break fragments"],
    "effect.shotsound": ["공격 소리", "Attack sound"],
    "effect.shotsound.description": ["발사하거나 근접 공격을 시작할 때 소리 내기", "Play a sound when firing or starting a melee attack"],
    "effect.shotsound.term": ["Attack sound", "Attack sound"],
    "effect.hitsound": ["타격 소리", "Hit sound"],
    "effect.hitsound.description": ["공격이 표적에 맞는 순간 소리 내기", "Play a sound when an attack hits the target"],
    "effect.hitsound.term": ["Hit sound", "Hit sound"],
    "effect.breaksound": ["격파 소리", "Break sound"],
    "effect.breaksound.description": ["표적의 체력이 0이 되는 순간 소리 내기", "Play a sound when a target reaches zero HP"],
    "effect.breaksound.term": ["Break sound", "Break sound"]
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
