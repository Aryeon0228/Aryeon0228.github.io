// ==================== Guestbook (Oekaki + 방명록) ====================
// 방문자가 작은 그림을 그리거나 한마디를 남기는 보드.
//
// 저장은 두 가지 모드로 동작해요:
//   1) Supabase 키를 넣으면  → 모두에게 공유되는 진짜 방명록 (실시간 저장)
//   2) 키를 안 넣으면        → localStorage 데모 (자기 브라우저에만 저장)
// 아래 SUPABASE_URL / SUPABASE_ANON_KEY 두 줄만 채우면 자동으로 1번으로 업그레이드돼요.
(function () {
    'use strict';

    // ====================================================================
    // ▼▼▼ 여기 두 줄만 채우면 실시간 공유 방명록으로 바뀝니다 ▼▼▼
    //   Supabase 대시보드 → Project Settings → API 에서 복사
    //   (anon public 키는 클라이언트에 넣어도 안전해요. RLS로 보호됩니다.)
    var SUPABASE_URL = '';        // 예: 'https://abcdwxyz.supabase.co'
    var SUPABASE_ANON_KEY = '';   // 예: 'eyJhbGciOiJI...'
    // ▲▲▲ ------------------------------------------------------ ▲▲▲
    // ====================================================================

    var section = document.getElementById('guestbook');
    if (!section) return;

    var TABLE = 'guestbook';

    // ---------- 저장소 (localStorage ↔ Supabase 자동 선택) ----------
    var STORAGE_KEY = 'penumbra_guestbook_v1';
    var MAX_ENTRIES = 60; // localStorage 데모 용량 보호용 상한

    var localStore = {
        kind: 'local',
        getEntries: function () {
            return Promise.resolve((function () {
                try {
                    var raw = localStorage.getItem(STORAGE_KEY);
                    var list = raw ? JSON.parse(raw) : [];
                    return Array.isArray(list) ? list : [];
                } catch (e) { return []; }
            })());
        },
        addEntry: function (entry) {
            return localStore.getEntries().then(function (list) {
                list.unshift(entry);
                if (list.length > MAX_ENTRIES) list = list.slice(0, MAX_ENTRIES);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
                return list;
            });
        }
    };

    function makeSupabaseStore() {
        if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
        var client;
        try {
            client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } catch (e) {
            return null;
        }
        return {
            kind: 'supabase',
            getEntries: function () {
                return client.from(TABLE)
                    .select('id,name,message,image,created_at')
                    .order('created_at', { ascending: false })
                    .limit(100)
                    .then(function (res) {
                        if (res.error) throw res.error;
                        return (res.data || []).map(function (r) {
                            return { id: r.id, name: r.name, message: r.message, image: r.image, date: r.created_at };
                        });
                    });
            },
            addEntry: function (entry) {
                return client.from(TABLE)
                    .insert({ name: entry.name, message: entry.message, image: entry.image })
                    .then(function (res) {
                        if (res.error) throw res.error;
                        return store.getEntries();
                    });
            }
        };
    }

    var store = makeSupabaseStore() || localStore;

    // 백엔드에 맞춰 안내문 갱신
    var noteEl = document.getElementById('guestbookNote');
    if (noteEl && store.kind === 'supabase') {
        noteEl.innerHTML = '여기 남긴 글·그림은 <strong>모두에게 공유</strong>돼요. 🌐';
    }

    // ---------- 오에카키 캔버스 ----------
    var canvas = document.getElementById('oekakiCanvas');
    var ctx = canvas.getContext('2d');
    var sizeInput = document.getElementById('oekakiSize');
    var eraserBtn = document.getElementById('oekakiEraser');
    var undoBtn = document.getElementById('oekakiUndo');
    var clearBtn = document.getElementById('oekakiClear');
    var colorsWrap = document.getElementById('oekakiColors');

    var PALETTE = ['#0a0a0a', '#ffffff', '#e23b3b', '#f2a93b', '#f5d442',
        '#4caf6e', '#3b8ee2', '#7a5cff', '#e26fb3'];

    var current = { color: PALETTE[0], size: 4, erasing: false };
    var drawing = false;
    var last = { x: 0, y: 0 };
    var undoStack = [];
    var hasDrawn = false;

    // 캔버스를 흰 배경으로 초기화 (테마와 무관하게 그림은 항상 흰 종이 위에)
    function fillWhite() {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
    fillWhite();

    function pushUndo() {
        try {
            undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
            if (undoStack.length > 25) undoStack.shift();
        } catch (e) { /* getImageData 실패는 무시 */ }
    }

    function pointerPos(e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        var src = (e.touches && e.touches[0]) ? e.touches[0] : e;
        return {
            x: (src.clientX - rect.left) * scaleX,
            y: (src.clientY - rect.top) * scaleY
        };
    }

    function startDraw(e) {
        e.preventDefault();
        pushUndo();
        drawing = true;
        last = pointerPos(e);
        drawLine(last, last); // 탭만 해도 점이 남도록
    }

    function moveDraw(e) {
        if (!drawing) return;
        e.preventDefault();
        var p = pointerPos(e);
        drawLine(last, p);
        last = p;
    }

    function endDraw() { drawing = false; }

    function drawLine(a, b) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = current.size;
        ctx.strokeStyle = current.erasing ? '#ffffff' : current.color;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
        hasDrawn = true;
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', moveDraw, { passive: false });
    window.addEventListener('touchend', endDraw);

    PALETTE.forEach(function (c, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'oekaki-color' + (i === 0 ? ' is-active' : '');
        b.style.background = c;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
        b.setAttribute('aria-label', c);
        b.addEventListener('click', function () {
            current.color = c;
            current.erasing = false;
            eraserBtn.setAttribute('aria-pressed', 'false');
            eraserBtn.classList.remove('is-active');
            Array.prototype.forEach.call(colorsWrap.children, function (el) {
                el.classList.remove('is-active');
                el.setAttribute('aria-checked', 'false');
            });
            b.classList.add('is-active');
            b.setAttribute('aria-checked', 'true');
        });
        colorsWrap.appendChild(b);
    });

    sizeInput.addEventListener('input', function () {
        current.size = parseInt(sizeInput.value, 10) || 4;
    });

    eraserBtn.addEventListener('click', function () {
        current.erasing = !current.erasing;
        eraserBtn.setAttribute('aria-pressed', current.erasing ? 'true' : 'false');
        eraserBtn.classList.toggle('is-active', current.erasing);
    });

    undoBtn.addEventListener('click', function () {
        if (!undoStack.length) return;
        ctx.putImageData(undoStack.pop(), 0, 0);
    });

    clearBtn.addEventListener('click', function () {
        pushUndo();
        fillWhite();
        hasDrawn = false;
    });

    function canvasIsBlank() { return !hasDrawn; }

    // ---------- 방명록 폼 & 벽 ----------
    var form = document.getElementById('guestbookForm');
    var nameInput = document.getElementById('gbName');
    var msgInput = document.getElementById('gbMessage');
    var submitBtn = document.getElementById('gbSubmit');
    var wall = document.getElementById('guestbookWall');
    var emptyMsg = document.getElementById('guestbookEmpty');

    function escapeHTML(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatDate(ts) {
        var d = new Date(ts);
        if (isNaN(d.getTime())) return '';
        var p = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) +
            ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }

    function render(list) {
        wall.innerHTML = '';
        if (!list || !list.length) {
            emptyMsg.style.display = 'block';
            return;
        }
        emptyMsg.style.display = 'none';
        list.forEach(function (entry) {
            var card = document.createElement('div');
            card.className = 'gb-entry card';
            var html = '';
            if (entry.image) {
                html += '<div class="gb-entry-art"><img src="' + entry.image +
                    '" alt="' + escapeHTML(entry.name || '익명') + '님의 그림" loading="lazy"></div>';
            }
            html += '<div class="gb-entry-body">';
            if (entry.message) {
                html += '<p class="gb-entry-msg">' + escapeHTML(entry.message) + '</p>';
            }
            html += '<div class="gb-entry-meta"><span class="gb-entry-name">' +
                escapeHTML(entry.name || '익명') + '</span>' +
                '<span class="gb-entry-date">' + formatDate(entry.date) + '</span></div>';
            html += '</div>';
            card.innerHTML = html;
            wall.appendChild(card);
        });
    }

    function shakeForm() {
        form.classList.remove('shake');
        void form.offsetWidth; // reflow로 애니메이션 재시작
        form.classList.add('shake');
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        var name = nameInput.value.trim().slice(0, 20);
        var message = msgInput.value.trim().slice(0, 200);
        var blank = canvasIsBlank();

        if (blank && !message) {
            msgInput.focus();
            shakeForm();
            return;
        }

        var entry = {
            name: name || '익명',
            message: message,
            image: blank ? null : canvas.toDataURL('image/png'),
            date: Date.now()
        };

        submitBtn.disabled = true;
        submitBtn.textContent = '남기는 중…';

        store.addEntry(entry).then(function (list) {
            render(list);
            nameInput.value = '';
            msgInput.value = '';
            fillWhite();
            hasDrawn = false;
            undoStack = [];
            var first = wall.querySelector('.gb-entry');
            if (first && first.scrollIntoView) {
                first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }).catch(function (err) {
            console.error('[guestbook] 저장 실패:', err);
            alert('앗, 저장에 실패했어요. 잠시 후 다시 시도해 주세요. 🙏');
        }).then(function () {
            submitBtn.disabled = false;
            submitBtn.textContent = '남기기';
        });
    });

    // 첫 렌더
    store.getEntries().then(render).catch(function (err) {
        console.error('[guestbook] 불러오기 실패:', err);
        render([]);
    });
})();
