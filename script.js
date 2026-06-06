// ==================== Theme Toggle ====================
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

// Check for saved theme preference or default to 'light'
const currentTheme = localStorage.getItem('theme') || 'light';
html.setAttribute('data-theme', currentTheme);

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const theme = html.getAttribute('data-theme');
        const newTheme = theme === 'light' ? 'dark' : 'light';

        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

// ==================== Cursor Following Cat ====================
(function () {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let catX = mouseX;
    let catY = mouseY;
    let facingLeft = false;
    let isMoving = false;
    let idleTimer = 0;
    let frame = 0;
    let pawPhase = 0; // for walk animation
    let isMouseInWindow = true;
    let meowTimer = 0; // frames remaining for meow mouth

    // Create cat element
    const cat = document.createElement('div');
    cat.id = 'cursor-cat';
    cat.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 9999;
        font-size: 24px;
        transition: none;
        will-change: transform;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
    `;
    document.body.appendChild(cat);

    // Create dangling grass toy at cursor
    const toy = document.createElement('div');
    toy.id = 'cursor-toy';
    toy.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 9998;
        will-change: transform;
    `;
    document.body.appendChild(toy);

    let toySwing = 0;
    let lastParticleTime = 0;

    function spawnGrassParticle() {
        const now = Date.now();
        if (now - lastParticleTime < 300) return;
        lastParticleTime = now;

        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        const p = document.createElement('div');
        const size = 3 + Math.random() * 3;
        const color = dark ? 'rgba(160,200,120,' : 'rgba(100,170,60,';
        p.style.cssText = `
            position: fixed;
            left: ${mouseX + (Math.random() - 0.5) * 12}px;
            top: ${mouseY + 10 + Math.random() * 10}px;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: ${color}${0.4 + Math.random() * 0.3});
            pointer-events: none;
            z-index: 9997;
            opacity: 1;
            transition: all 1.2s ease-out;
        `;
        document.body.appendChild(p);
        requestAnimationFrame(() => {
            p.style.top = (mouseY + 10 - 20 - Math.random() * 25) + 'px';
            p.style.left = (parseFloat(p.style.left) + (Math.random() - 0.5) * 30) + 'px';
            p.style.opacity = '0';
            p.style.transform = `scale(0.3)`;
        });
        setTimeout(() => p.remove(), 1200);
    }

    function drawToy() {
        toySwing += 0.05;
        const swing = Math.sin(toySwing) * 8;
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        const stalkColor = dark ? '#7a9e5a' : '#5a7e3a';
        const fluffColor = dark ? '#a0c878' : '#7aaa50';
        return `<svg width="40" height="40" viewBox="0 0 40 40" style="transform: scaleX(-1) rotate(-135deg)">
            <!-- stick/stalk from handle to tip -->
            <path d="M20,0 Q${20 + swing * 0.3},15 ${20 + swing * 0.5},32" stroke="${stalkColor}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <!-- fluffy grass tip -->
            <ellipse cx="${20 + swing * 0.5}" cy="32" rx="2.5" ry="5" fill="${fluffColor}" transform="rotate(${swing * 2}, ${20 + swing * 0.5}, 32)"/>
            <ellipse cx="${20 + swing * 0.5 - 1.5}" cy="31" rx="2" ry="4" fill="${fluffColor}" opacity="0.7" transform="rotate(${swing * 2 - 10}, ${20 + swing * 0.5}, 32)"/>
            <ellipse cx="${20 + swing * 0.5 + 1.5}" cy="31" rx="2" ry="4" fill="${fluffColor}" opacity="0.7" transform="rotate(${swing * 2 + 10}, ${20 + swing * 0.5}, 32)"/>
        </svg>`;
    }

    // Cat SVG sprites — chubby front-facing kawaii black cat
    function drawCat(moving, left, phase, idle) {
        // Tail wave (degrees of sway around its base)
        const tailAngle = moving ? Math.sin(phase * 0.3) * 22 : Math.sin(Date.now() * 0.002) * 10;
        // Body bob when running
        const bobY = moving ? Math.sin(phase * 0.6) * 1.8 : Math.sin(Date.now() * 0.002) * 0.6;
        // Paw shuffle when running
        const pawOffset = moving ? Math.sin(phase * 0.6) * 1.4 : 0;

        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        const bodyColor = dark ? '#a3a3a3' : '#1f1f1f';
        const eyeWhite = '#ffffff';
        const pinkColor = '#ff9fb6';
        const pupilColor = dark ? '#2a2a2a' : '#202020';

        // Flip to face the direction of travel (cat faces right by default)
        const flip = left ? 'scaleX(-1)' : '';
        // Subtle forward glance from the centered pupils (kept within the eye whites)
        const lookX = moving ? 0.8 : Math.sin(Date.now() * 0.0015) * 0.4;
        const lookY = moving ? 0.3 : 0.15;

        // Sleeping cat — plump rounded loaf, head raised to the right, sleepy closed eyes
        if (idle) {
            const zzFloat = Math.sin(Date.now() * 0.003) * 2;
            const breathe = Math.sin(Date.now() * 0.0025) * 0.5;
            return `<svg width="40" height="32" viewBox="0 0 40 32" style="transform: translateY(${3 + breathe}px)">
                <!-- tail curl at the rear -->
                <path d="M14.23,29.92 Q7.23,29.42 7.23,23.92 Q7.23,18.92 13.23,20.42" stroke="${bodyColor}" stroke-width="3.3" fill="none" stroke-linecap="round"/>
                <!-- body -->
                <ellipse cx="16.95" cy="20.63" rx="9.4" ry="8" fill="${bodyColor}"/>
                <!-- head -->
                <ellipse cx="24.83" cy="19.72" rx="9" ry="8.4" fill="${bodyColor}"/>
                <!-- front paws -->
                <ellipse cx="21.83" cy="28.09" rx="2.1" ry="1.9" fill="${bodyColor}"/>
                <ellipse cx="25.32" cy="27.95" rx="2" ry="1.9" fill="${bodyColor}"/>
                <!-- ears -->
                <polygon points="19.24,17.8 17.74,10.8 24.74,15.8" fill="${bodyColor}"/>
                <polygon points="33.24,19 34.74,12.5 28.24,17" fill="${bodyColor}"/>
                <polygon points="20.1,16.27 19.47,13.11 22.31,15.32" fill="${pinkColor}" opacity="0.5"/>
                <polygon points="32.9,16.6 33.26,14.94 31.56,16.1" fill="${pinkColor}" opacity="0.5"/>
                <!-- sleepy closed eyes -->
                <path d="M20.57,21.58 Q22.57,23.48 24.57,21.58" stroke="${dark ? '#3a3a3a' : '#111'}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
                <path d="M28.26,21.62 Q30.26,23.52 32.26,21.62" stroke="${dark ? '#3a3a3a' : '#111'}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
                <!-- pink diamond mouth -->
                <polygon points="26.54,24.09 27.26,24.82 26.54,25.55 25.81,24.82" fill="${pinkColor}"/>
                <!-- zzz drifting up -->
                <text x="27.46" y="${9.84 + zzFloat}" font-size="7" font-weight="bold" fill="${dark ? '#bbb' : '#999'}" font-family="sans-serif">z</text>
                <text x="32.08" y="${8.46 + zzFloat * 0.7}" font-size="10" font-weight="bold" fill="${dark ? '#999' : '#bbb'}" font-family="sans-serif">Z</text>
            </svg>`;
        }

        // Tail base at the left rear — rotated by tailAngle for the swish
        const tailBaseX = 10.25, tailBaseY = 22.81;

        return `<svg width="40" height="36" viewBox="0 -2 40 36" style="transform: ${flip} translateY(${bobY}px)">
            <!-- tail: fat curl rising at the left rear, sways while walking -->
            <g transform="rotate(${tailAngle}, ${tailBaseX}, ${tailBaseY})">
                <path d="M${tailBaseX},${tailBaseY} Q2.25,20.81 2.75,11.81 Q3.25,4.81 10.25,6.81" stroke="${bodyColor}" stroke-width="4.2" fill="none" stroke-linecap="round"/>
            </g>
            <!-- chubby body: two overlapping circles -->
            <circle cx="24.82" cy="20.57" r="10" fill="${bodyColor}"/>
            <circle cx="16.75" cy="20.59" r="9.4" fill="${bodyColor}"/>
            <!-- round paws: back pair + front pair (alternating gait) -->
            <circle cx="${11.89 - pawOffset}" cy="${28.37 - Math.abs(pawOffset) * 0.4}" r="2.8" fill="${bodyColor}"/>
            <circle cx="${19.6 + pawOffset}" cy="${30.24 - Math.abs(pawOffset) * 0.4}" r="2.8" fill="${bodyColor}"/>
            <circle cx="${24.83 - pawOffset}" cy="${30.17 - Math.abs(pawOffset) * 0.4}" r="2.8" fill="${bodyColor}"/>
            <circle cx="${31.69 + pawOffset}" cy="${27.91 - Math.abs(pawOffset) * 0.4}" r="2.8" fill="${bodyColor}"/>
            <!-- head -->
            <circle cx="27.92" cy="14.59" r="10.7" fill="${bodyColor}"/>
            <!-- chubby cheek (front) -->
            <circle cx="32.27" cy="17.41" r="6.4" fill="${bodyColor}"/>
            <!-- ears -->
            <polygon points="19.8,8.73 17.3,0.73 27.3,5.73" fill="${bodyColor}"/>
            <polygon points="37.3,10.08 39.8,2.58 31.8,7.08" fill="${bodyColor}"/>
            <polygon points="20.5,6.16 19.52,3.71 23.2,5.04" fill="${pinkColor}"/>
            <polygon points="37.32,7.49 38.67,4.69 34.82,6.15" fill="${pinkColor}"/>
            <!-- round eyes -->
            <circle cx="24.3" cy="15" r="3.8" fill="${eyeWhite}"/>
            <circle cx="34.28" cy="14.44" r="3.8" fill="${eyeWhite}"/>
            <!-- pupils (centered in the eyes, with subtle glance) -->
            <circle cx="${24.3 + lookX}" cy="${15 + lookY}" r="2.7" fill="${pupilColor}"/>
            <circle cx="${34.28 + lookX}" cy="${14.44 + lookY}" r="2.7" fill="${pupilColor}"/>
            <!-- eye sparkle (upper-left of pupil) -->
            <circle cx="${23.3 + lookX}" cy="${13.9 + lookY}" r="0.9" fill="#fff"/>
            <circle cx="${33.28 + lookX}" cy="${13.34 + lookY}" r="0.9" fill="#fff"/>
            <!-- pink diamond mouth -->
            ${meowTimer > 0 ? `
            <ellipse cx="29.81" cy="19.8" rx="2" ry="1.6" fill="${dark ? '#5a4146' : '#c46b7e'}"/>
            <ellipse cx="29.81" cy="20.3" rx="1.1" ry="0.7" fill="${pinkColor}"/>
            ` : `
            <polygon points="29.81,18.14 31.21,19.54 29.81,20.94 28.41,19.54" fill="${pinkColor}"/>
            `}
        </svg>`;
    }

    // Music notes that float up when moving
    const noteTypes = [
        // 8분음표 ♪
        `<svg width="14" height="18" viewBox="0 0 14 18"><path d="M4,16 L4,4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><ellipse cx="3" cy="16" rx="3" ry="2" fill="currentColor"/><path d="M4,4 Q8,2 8,6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`,
        // 16분음표 ♬
        `<svg width="18" height="18" viewBox="0 0 18 18"><path d="M4,16 L4,4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M14,14 L14,2" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><ellipse cx="3" cy="16" rx="3" ry="2" fill="currentColor"/><ellipse cx="13" cy="14" rx="3" ry="2" fill="currentColor"/><path d="M4,4 L14,2" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M4,7 L14,5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`
    ];
    let lastNoteTime = 0;
    let noteIndex = 0;
    let lastNoteX = 0;
    let lastNoteY = 0;

    function spawnNote(x, y) {
        const now = Date.now();
        if (now - lastNoteTime < 400) return; // throttle
        const dxN = x - lastNoteX;
        const dyN = y - lastNoteY;
        if (dxN * dxN + dyN * dyN < 900) return; // min 30px distance
        lastNoteTime = now;
        lastNoteX = x;
        lastNoteY = y;

        const note = document.createElement('div');
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        note.innerHTML = noteTypes[noteIndex % noteTypes.length];
        noteIndex++;
        const offsetX = (Math.random() - 0.5) * 20;
        note.style.cssText = `
            position: fixed;
            left: ${x + offsetX}px;
            top: ${y - 10}px;
            pointer-events: none;
            z-index: 9997;
            color: ${dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'};
            opacity: 1;
            transition: all 1s ease-out;
        `;
        document.body.appendChild(note);

        requestAnimationFrame(() => {
            note.style.top = (y - 50 - Math.random() * 20) + 'px';
            note.style.left = (x + offsetX + (Math.random() - 0.5) * 30) + 'px';
            note.style.opacity = '0';
            note.style.transform = `rotate(${(Math.random() - 0.5) * 30}deg) scale(0.7)`;
        });

        setTimeout(() => note.remove(), 1000);
    }

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (isMouseInWindow) spawnNote(catX, catY);
    });

    document.addEventListener('mouseleave', () => {
        isMouseInWindow = false;
    });

    document.addEventListener('mouseenter', (e) => {
        isMouseInWindow = true;
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // Click → meow + heart
    document.addEventListener('click', () => {
        meowTimer = 30; // ~0.5 seconds of open mouth

        // Spawn floating heart at cat position
        const heart = document.createElement('div');
        heart.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#e74c3c"/></svg>';
        heart.style.cssText = `
            position: fixed;
            left: ${catX - 8}px;
            top: ${catY - 20}px;
            pointer-events: none;
            z-index: 10000;
            opacity: 1;
            transition: all 0.8s ease-out;
        `;
        document.body.appendChild(heart);

        // Animate upward + fade
        requestAnimationFrame(() => {
            heart.style.top = (catY - 50) + 'px';
            heart.style.opacity = '0';
            heart.style.transform = 'scale(1.3)';
        });

        setTimeout(() => heart.remove(), 800);
    });

    function animate() {
        frame++;
        if (meowTimer > 0) meowTimer--;

        // Cat follows upper-left of cursor (chasing the grass toy tip)
        const targetX = mouseX - 25;
        const targetY = mouseY - 25;
        const dx = targetX - catX;
        const dy = targetY - catY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Smooth follow with easing
        const speed = dist > 100 ? 0.08 : dist > 30 ? 0.05 : 0.03;
        catX += dx * speed;
        catY += dy * speed;

        // Determine if moving
        isMoving = dist > 8;
        if (isMoving) {
            idleTimer = 0;
            pawPhase += dist * 0.15;
            // Face direction of movement
            if (Math.abs(dx) > 2) {
                facingLeft = dx < 0;
            }
        } else {
            idleTimer++;
        }

        // Idle = sleeping after ~3 seconds of no movement
        const isIdle = idleTimer > 180;

        if (isMouseInWindow) {
            cat.style.display = 'block';
            cat.style.left = (catX - 20) + 'px';
            cat.style.top = (catY - 19) + 'px';

            // Dangling grass toy at cursor
            toy.style.display = 'block';
            toy.style.left = (mouseX - 20) + 'px';
            toy.style.top = (mouseY - 20) + 'px';
            if (frame % 3 === 0) {
                toy.innerHTML = drawToy();
            }
            if (isMoving) spawnGrassParticle();

            // Update cat sprite every few frames
            if (frame % 3 === 0) {
                cat.innerHTML = drawCat(isMoving, facingLeft, pawPhase, isIdle);
            }
        } else {
            cat.style.display = 'none';
            toy.style.display = 'none';
        }

        requestAnimationFrame(animate);
    }

    // Initial render
    cat.innerHTML = drawCat(false, false, 0, false);
    animate();

    // Hide canvas if it exists (no longer needed)
    const cursorCanvas = document.getElementById('cursorTrailCanvas');
    if (cursorCanvas) {
        cursorCanvas.style.display = 'none';
    }
})();

// ==================== Home Link ====================
const homeLink = document.getElementById('homeLink');

if (homeLink) {
    homeLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// ==================== Mobile Menu Toggle ====================
const mobileToggle = document.getElementById('mobileToggle');
const navMenu = document.querySelector('.nav-menu');

if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        mobileToggle.classList.toggle('active');
    });

    // Close mobile menu when clicking on a link
    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            mobileToggle.classList.remove('active');
        });
    });
}

// ==================== Smooth Scroll for Navigation ====================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ==================== Scroll Effects ====================
const header = document.querySelector('header');

if (header) {
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        // Add scrolled class for glow effect
        if (currentScroll > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// ==================== Intersection Observer for Animations ====================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all cards and sections for animation
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll('.card, .section-title, .portfolio-card, .experience-item, .award-item');

    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// ==================== Active Navigation Highlight ====================
const sections = document.querySelectorAll('section[id]');

function highlightNavigation() {
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 100;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`.nav-menu a[href="#${sectionId}"]`);

        if (navLink && scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
            navLink.classList.add('active');
        } else if (navLink) {
            navLink.classList.remove('active');
        }
    });
}

window.addEventListener('scroll', highlightNavigation);

// ==================== Close Mobile Menu on Outside Click ====================
if (navMenu && mobileToggle) {
    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
            navMenu.classList.remove('active');
            mobileToggle.classList.remove('active');
        }
    });
}

// ==================== Prevent Page Jump on Load ====================
if (window.location.hash) {
    setTimeout(() => {
        window.scrollTo(0, 0);
    }, 1);
}

// ==================== Skill Bar Animation ====================
const skillCard = document.getElementById('skillCard');

if (skillCard) {
    // Animate skill bars on scroll into view
    const skillObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const bars = skillCard.querySelectorAll('.skill-bar-fill');
                bars.forEach((bar, index) => {
                    const width = bar.getAttribute('data-width');
                    setTimeout(() => {
                        bar.style.width = width + '%';
                    }, index * 100);
                });
                skillObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    skillObserver.observe(skillCard);
}

// ==================== 3D Portfolio Cards ====================
const portfolioImageWrappers = document.querySelectorAll('.portfolio-image-wrapper.portfolio-3d');

portfolioImageWrappers.forEach(wrapper => {
    const layerBack = wrapper.querySelector('.portfolio-layer-back');
    const layerMid = wrapper.querySelector('.portfolio-layer-mid');
    const layerFront = wrapper.querySelector('.portfolio-layer-front');
    const card = wrapper.closest('.portfolio-card');

    // Skip if required layers are missing
    if (!layerBack || !layerMid || !layerFront) {
        return;
    }

    let isHovering = false;
    let animationFrameId = null;

    wrapper.addEventListener('mouseenter', () => {
        isHovering = true;
        // Add scale and glow effect on hover
        if (card) {
            card.style.transform = 'scale(1.03)';
            card.style.boxShadow = '0 25px 50px rgba(0, 0, 0, 0.15)';
        }
    });

    wrapper.addEventListener('mouseleave', () => {
        isHovering = false;
        // Reset layers to original position
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        layerBack.style.transform = 'translateZ(-30px) rotateX(0deg) rotateY(0deg)';
        layerMid.style.transform = 'translateZ(-15px) rotateX(0deg) rotateY(0deg)';
        layerFront.style.transform = 'translateZ(0) rotateX(0deg) rotateY(0deg)';
        wrapper.style.transform = 'rotateX(0deg) rotateY(0deg)';
        // Reset card effects
        if (card) {
            card.style.transform = '';
            card.style.boxShadow = '';
        }
    });

    wrapper.addEventListener('mousemove', (e) => {
        if (!isHovering) return;

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        animationFrameId = requestAnimationFrame(() => {
            const rect = wrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -20; // Max 20 degrees (increased from 8)
            const rotateY = ((x - centerX) / centerX) * 20;  // Max 20 degrees (increased from 8)

            // Apply transforms with different intensities for parallax effect
            wrapper.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

            // Back layer moves more (stronger parallax)
            layerBack.style.transform = `translateZ(-40px) rotateX(${rotateX * 1.8}deg) rotateY(${rotateY * 1.8}deg) translateX(${rotateY * 2}px) translateY(${-rotateX * 2}px)`;
            layerBack.style.opacity = '0.6';

            // Mid layer moves moderately
            layerMid.style.transform = `translateZ(-20px) rotateX(${rotateX * 1.4}deg) rotateY(${rotateY * 1.4}deg) translateX(${rotateY}px) translateY(${-rotateX}px)`;
            layerMid.style.opacity = '0.7';

            // Front layer moves least (subtle effect)
            layerFront.style.transform = `translateZ(10px) rotateX(${rotateX * 0.6}deg) rotateY(${rotateY * 0.6}deg)`;

            // Dynamic shadow based on tilt
            if (card) {
                const shadowX = rotateY * 1.5;
                const shadowY = -rotateX * 1.5;
                card.style.boxShadow = `${shadowX}px ${shadowY + 20}px 50px rgba(0, 0, 0, 0.15)`;
            }
        });
    });
});
