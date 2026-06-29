// ==================== Guestbook (Oekaki + 방명록) ====================
// 방문자가 작은 그림을 그리거나 한마디를 남기는 보드.
//
// 저장은 지금 localStorage 데모예요. 나중에 Supabase 같은 백엔드로 바꾸려면
// 아래 `store` 객체의 getEntries() / addEntry() 두 함수만 교체하면 됩니다.
// 화면/그리기 코드는 store 인터페이스에만 의존하도록 짜여 있어요.
(function () {
    'use strict';

    var section = document.getElementById('guestbook');
    if (!section) return;

    // ---------- 저장소 (여기만 갈아끼우면 백엔드 연동 가능) ----------
    var STORAGE_KEY = 'penumbra_guestbook_v1';
    var MAX_ENTRIES = 60; // 데모: localStorage 용량 보호용 상한

    var store = {
        getEntries: function () {
            try {
                var raw = localStorage.getItem(STORAGE_KEY);
                var list = raw ? JSON.parse(raw) : [];
                return Array.isArray(list) ? list : [];
            } catch (e) {
                return [];
            }
        },
        addEntry: function (entry) {
            var list = store.getEntries();
            list.unshift(entry); // 최신이 앞으로
            if (list.length > MAX_ENTRIES) list = list.slice(0, MAX_ENTRIES);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            return list;
        }
    };

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
        // 점 찍기 (탭만 해도 점이 남도록)
        drawLine(last, last);
    }

    function moveDraw(e) {
        if (!drawing) return;
        e.preventDefault();
        var p = pointerPos(e);
        drawLine(last, p);
        last = p;
    }

    function endDraw() {
        drawing = false;
    }

    function drawLine(a, b) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = current.size;
        if (current.erasing) {
            ctx.strokeStyle = '#ffffff';
        } else {
            ctx.strokeStyle = current.color;
        }
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
        hasDrawn = true;
    }

    // 마우스
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', endDraw);
    // 터치
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', moveDraw, { passive: false });
    window.addEventListener('touchend', endDraw);

    // 색상 팔레트 생성
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

    // 캔버스가 비어있는지(흰색만 있는지) 검사
    function canvasIsBlank() {
        if (!hasDrawn) return true;
        return false;
    }

    // ---------- 방명록 폼 & 벽 ----------
    var form = document.getElementById('guestbookForm');
    var nameInput = document.getElementById('gbName');
    var msgInput = document.getElementById('gbMessage');
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
        if (!list.length) {
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

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        var name = nameInput.value.trim().slice(0, 20);
        var message = msgInput.value.trim().slice(0, 200);
        var blank = canvasIsBlank();

        if (blank && !message) {
            // 그림도 글도 없으면 막기
            msgInput.focus();
            form.classList.remove('shake');
            // reflow로 애니메이션 재시작
            void form.offsetWidth;
            form.classList.add('shake');
            return;
        }

        var entry = {
            id: 'gb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
            name: name || '익명',
            message: message,
            image: blank ? null : canvas.toDataURL('image/png'),
            date: Date.now()
        };

        var list = store.addEntry(entry);
        render(list);

        // 폼 리셋
        nameInput.value = '';
        msgInput.value = '';
        fillWhite();
        hasDrawn = false;
        undoStack = [];

        // 방금 남긴 첫 카드로 부드럽게 스크롤
        var first = wall.querySelector('.gb-entry');
        if (first && first.scrollIntoView) {
            first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    // 첫 렌더
    render(store.getEntries());
})();
