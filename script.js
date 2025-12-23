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

// ==================== Cursor Trail Effect (Canvas) ====================
const cursorCanvas = document.getElementById('cursorTrailCanvas');

if (cursorCanvas) {
    const ctx = cursorCanvas.getContext('2d');
    const trailLength = 8; // Very short trail
    const positions = [];
    let mouseX = 0;
    let mouseY = 0;
    let isMouseInWindow = true;

    // Initialize positions
    for (let i = 0; i < trailLength; i++) {
        positions.push({ x: 0, y: 0 });
    }

    // Resize canvas to window size
    function resizeCanvas() {
        cursorCanvas.width = window.innerWidth;
        cursorCanvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Track mouse movement
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // Hide trail when mouse leaves window
    document.addEventListener('mouseleave', () => {
        isMouseInWindow = false;
    });

    // Show trail when mouse enters window
    document.addEventListener('mouseenter', (e) => {
        isMouseInWindow = true;
        mouseX = e.clientX;
        mouseY = e.clientY;
        // Reset all positions to mouse position
        positions.forEach(pos => {
            pos.x = mouseX;
            pos.y = mouseY;
        });
    });

    // Draw smooth curve through points using quadratic bezier curves
    function drawSmoothCurve() {
        ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

        if (!isMouseInWindow || positions.length < 2) return;

        // Create gradient along the trail
        const gradient = ctx.createLinearGradient(
            positions[0].x, positions[0].y,
            positions[trailLength - 1].x, positions[trailLength - 1].y
        );
        gradient.addColorStop(0, 'rgba(138, 85, 254, 1)');     // Purple - start
        gradient.addColorStop(0.5, 'rgba(111, 154, 248, 0.7)'); // Blue - middle
        gradient.addColorStop(1, 'rgba(92, 223, 230, 0)');      // Cyan - end (fade out)

        // Draw glow effect (outer layer)
        ctx.beginPath();
        ctx.moveTo(positions[0].x, positions[0].y);

        for (let i = 1; i < positions.length - 2; i++) {
            const xc = (positions[i].x + positions[i + 1].x) / 2;
            const yc = (positions[i].y + positions[i + 1].y) / 2;
            ctx.quadraticCurveTo(positions[i].x, positions[i].y, xc, yc);
        }

        // Finish curve to last point
        if (positions.length >= 2) {
            ctx.quadraticCurveTo(
                positions[positions.length - 2].x,
                positions[positions.length - 2].y,
                positions[positions.length - 1].x,
                positions[positions.length - 1].y
            );
        }

        ctx.strokeStyle = 'rgba(138, 85, 254, 0.3)';
        ctx.lineWidth = 20;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(138, 85, 254, 0.5)';
        ctx.shadowBlur = 25;
        ctx.stroke();

        // Draw main trail with varying width
        ctx.shadowBlur = 0;

        // Draw segments with decreasing width
        for (let i = 0; i < positions.length - 1; i++) {
            const ratio = i / (positions.length - 1);
            const width = 12 - ratio * 9; // 12px to 3px
            const alpha = 1 - ratio * 0.9;

            // Calculate color along gradient
            const r = Math.round(138 + (92 - 138) * ratio);
            const g = Math.round(85 + (223 - 85) * ratio);
            const b = Math.round(254 + (230 - 254) * ratio);

            ctx.beginPath();
            ctx.moveTo(positions[i].x, positions[i].y);

            if (i < positions.length - 2) {
                const xc = (positions[i].x + positions[i + 1].x) / 2;
                const yc = (positions[i].y + positions[i + 1].y) / 2;
                ctx.quadraticCurveTo(positions[i].x, positions[i].y, xc, yc);
            } else {
                ctx.lineTo(positions[i + 1].x, positions[i + 1].y);
            }

            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        }

        // Draw bright core (inner glow)
        ctx.beginPath();
        ctx.moveTo(positions[0].x, positions[0].y);

        for (let i = 1; i < Math.min(15, positions.length - 2); i++) {
            const xc = (positions[i].x + positions[i + 1].x) / 2;
            const yc = (positions[i].y + positions[i + 1].y) / 2;
            ctx.quadraticCurveTo(positions[i].x, positions[i].y, xc, yc);
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = 10;
        ctx.stroke();

        // Draw cursor dot
        ctx.beginPath();
        ctx.arc(positions[0].x, positions[0].y, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = 'rgba(138, 85, 254, 1)';
        ctx.shadowBlur = 15;
        ctx.fill();
    }

    // Animation loop
    function animateTrail() {
        // Update first position to mouse
        positions[0].x = mouseX;
        positions[0].y = mouseY;

        // Each point follows the previous one with smooth easing
        for (let i = 1; i < trailLength; i++) {
            const ease = 0.6; // Fast, consistent follow
            positions[i].x += (positions[i - 1].x - positions[i].x) * ease;
            positions[i].y += (positions[i - 1].y - positions[i].y) * ease;
        }

        drawSmoothCurve();
        requestAnimationFrame(animateTrail);
    }

    animateTrail();
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

        // Add shadow to header on scroll
        if (currentScroll > 10) {
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        } else {
            header.style.boxShadow = 'none';
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
    const animatedElements = document.querySelectorAll('.card, .section-title');

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
            card.style.boxShadow = '0 25px 50px rgba(138, 85, 254, 0.3), 0 15px 30px rgba(92, 223, 230, 0.2)';
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
                card.style.boxShadow = `${shadowX}px ${shadowY + 20}px 50px rgba(138, 85, 254, 0.35), ${shadowX * 0.5}px ${shadowY * 0.5 + 10}px 25px rgba(92, 223, 230, 0.25)`;
            }
        });
    });
});
