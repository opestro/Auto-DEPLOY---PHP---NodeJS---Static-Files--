// Add these animation utilities
const animations = {
    fadeIn: (element) => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        setTimeout(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, 100);
    },
    
    slideIn: (element, direction = 'left') => {
        const offset = direction === 'left' ? '-100px' : '100px';
        element.style.opacity = '0';
        element.style.transform = `translateX(${offset})`;
        element.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        setTimeout(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateX(0)';
        }, 100);
    },
    
    scaleIn: (element) => {
        element.style.opacity = '0';
        element.style.transform = 'scale(0.95)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        setTimeout(() => {
            element.style.opacity = '1';
            element.style.transform = 'scale(1)';
        }, 100);
    }
};

// Scroll animation observer
const createScrollAnimationObserver = () => {
    const options = {
        threshold: 0.1,
        rootMargin: '0px 0px -10% 0px'
    };

    return new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const animation = element.dataset.animate;
                
                if (animation === 'fade') animations.fadeIn(element);
                else if (animation === 'slideLeft') animations.slideIn(element, 'left');
                else if (animation === 'slideRight') animations.slideIn(element, 'right');
                else if (animation === 'scale') animations.scaleIn(element);
                
                // Remove observer after animation
                observer.unobserve(element);
            }
        });
    }, options);
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize scroll animations
    const observer = createScrollAnimationObserver();
    
    // Observe elements with data-animate attribute
    document.querySelectorAll('[data-animate]').forEach(element => {
        observer.observe(element);
    });

    // Enhanced smooth scroll with progress indicator
    const smoothScroll = (target) => {
        const element = document.querySelector(target);
        if (!element) return;

        // Create progress indicator
        const progress = document.createElement('div');
        progress.className = 'scroll-progress';
        progress.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--cyber-pink), var(--cyber-blue));
            z-index: 1000;
            transition: width 0.3s ease;
        `;
        document.body.appendChild(progress);

        // Calculate scroll progress
        const start = window.pageYOffset;
        const end = element.offsetTop - 80;
        const duration = 1000; // 1 second
        let startTime = null;

        const animation = (currentTime) => {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);

            const easeInOutCubic = t => t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
            const run = easeInOutCubic(progress);

            window.scrollTo(0, start + (end - start) * run);
            progress.style.width = `${progress * 100}%`;

            if (timeElapsed < duration) {
                requestAnimationFrame(animation);
            } else {
                // Clean up progress bar
                setTimeout(() => {
                    progress.style.opacity = '0';
                    setTimeout(() => progress.remove(), 300);
                }, 200);
            }
        };

        requestAnimationFrame(animation);
    };

    // Navigation link click handler with animations
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Add click ripple effect
            const ripple = document.createElement('div');
            ripple.className = 'nav-ripple';
            this.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 1000);
            
            // Smooth scroll to target
            const target = this.getAttribute('href');
            smoothScroll(target);
        });
    });
});