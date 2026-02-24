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

// ==================== Cursor Watercolor Line Trail ====================
const cursorCanvas = document.getElementById('cursorTrailCanvas');

if (cursorCanvas) {
    const ctx = cursorCanvas.getContext('2d');
    let mouseX = 0;
    let mouseY = 0;
    let isMouseInWindow = true;

    // Store trail points with timestamps
    const trail = [];
    const MAX_TRAIL = 40;
    const TRAIL_LIFETIME = 350; // ms before fully faded

    // Particles that spawn from the tail
    const particles = [];
    const MAX_PARTICLES = 60;

    // Check if dark mode
    function isDarkMode() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    // Resize canvas to window size
    function resizeCanvas() {
        cursorCanvas.width = window.innerWidth;
        cursorCanvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Track mouse movement - add points to trail
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        if (!isMouseInWindow) return;

        // Only add point if moved enough distance from last point
        const last = trail[trail.length - 1];
        if (last) {
            const dx = mouseX - last.x;
            const dy = mouseY - last.y;
            if (dx * dx + dy * dy < 9) return; // min 3px distance
        }

        trail.push({
            x: mouseX,
            y: mouseY,
            time: performance.now()
        });

        // Limit trail length
        if (trail.length > MAX_TRAIL) {
            trail.shift();
        }
    });

    // Hide when mouse leaves window
    document.addEventListener('mouseleave', () => {
        isMouseInWindow = false;
    });

    // Show when mouse enters window
    document.addEventListener('mouseenter', (e) => {
        isMouseInWindow = true;
        mouseX = e.clientX;
        mouseY = e.clientY;
        // Clear trail on re-enter to avoid jump lines
        trail.length = 0;
    });

    // Draw smooth watercolor line
    function animate() {
        ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

        const now = performance.now();
        const dark = isDarkMode();

        // Remove expired points — spawn particles at the dying tail
        while (trail.length > 0 && now - trail[0].time > TRAIL_LIFETIME) {
            const dead = trail.shift();
            if (particles.length < MAX_PARTICLES) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 0.6 + 0.2;
                particles.push({
                    x: dead.x,
                    y: dead.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: Math.random() * 2 + 1,
                    alpha: 0.2 + Math.random() * 0.1,
                    decay: 0.006 + Math.random() * 0.006
                });
            }
        }

        if (trail.length < 2) {
            requestAnimationFrame(animate);
            return;
        }

        // 3 watercolor layers: [alpha, lineWidth]
        const layers = [
            [0.18, 1.5],
            [0.07, 3.5],
            [0.025, 6]
        ];

        for (const [alpha, width] of layers) {
            ctx.beginPath();
            ctx.moveTo(trail[0].x, trail[0].y);

            // Smooth curve through all points using quadratic bezier
            for (let i = 1; i < trail.length - 1; i++) {
                const xc = (trail[i].x + trail[i + 1].x) / 2;
                const yc = (trail[i].y + trail[i + 1].y) / 2;
                ctx.quadraticCurveTo(trail[i].x, trail[i].y, xc, yc);
            }
            ctx.lineTo(trail[trail.length - 1].x, trail[trail.length - 1].y);

            ctx.strokeStyle = dark
                ? `rgba(255, 255, 255, ${alpha})`
                : `rgba(0, 0, 0, ${alpha})`;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        }

        // Draw and update tail particles
        const rgb = dark ? '255,255,255' : '0,0,0';
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb},${p.alpha})`;
            ctx.fill();
        }

        requestAnimationFrame(animate);
    }

    animate();
}

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
