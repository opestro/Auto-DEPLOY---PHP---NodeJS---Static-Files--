// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Parallax effect for hero section
const heroSection = document.querySelector('.hero');
window.addEventListener('scroll', () => {
    if (heroSection) {
        const scrolled = window.pageYOffset;
        heroSection.style.transform = `translateY(${scrolled * 0.5}px)`;
    }
});

// Intersection Observer for fade-in animations
const observerOptions = {
    root: null,
    threshold: 0.1,
    rootMargin: '0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-10');
        }
    });
}, observerOptions);

// Observe sections and cards for animations
document.querySelectorAll('section > div, .feature-card').forEach(element => {
    element.classList.add('transition-all', 'duration-1000', 'opacity-0', 'translate-y-10');
    observer.observe(element);
});

// Command hover effect
document.querySelectorAll('.command-text').forEach(command => {
    command.addEventListener('mouseover', () => {
        command.style.transform = 'scale(1.02)';
        command.style.transition = 'all 0.3s ease';
    });
    command.addEventListener('mouseout', () => {
        command.style.transform = 'scale(1)';
    });
});

// Header transparency on scroll
const header = document.querySelector('header');
window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        header.classList.add('bg-opacity-95');
    } else {
        header.classList.remove('bg-opacity-95');
    }
});

// Globe Animation
let scene, camera, renderer, globe;

function initGlobe() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    document.getElementById('globe-container').appendChild(renderer.domElement);

    // Load Earth textures
    const textureLoader = new THREE.TextureLoader();
    const earthMap = textureLoader.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/2_no_clouds_4k.jpg');
    const bumpMap = textureLoader.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/elev_bump_4k.jpg');
    const specularMap = textureLoader.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/water_4k.png');
    const cloudsMap = textureLoader.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/fair_clouds_4k.png');

    // Create Earth
    const earthGeometry = new THREE.SphereGeometry(8, 64, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
        map: earthMap,
        bumpMap: bumpMap,
        bumpScale: 0.2,
        specularMap: specularMap,
        specular: new THREE.Color('grey'),
        shininess: 25
    });
    globe = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(globe);

    // Add clouds layer
    const cloudsGeometry = new THREE.SphereGeometry(8.1, 64, 64);
    const cloudsMaterial = new THREE.MeshPhongMaterial({
        map: cloudsMap,
        transparent: true,
        opacity: 0.4
    });
    const clouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
    scene.add(clouds);

    // Add atmosphere glow
    const atmosphereGeometry = new THREE.SphereGeometry(8.3, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            void main() {
                float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                gl_FragColor = vec4(0.16, 0.59, 1.0, 1.0) * intensity;
            }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Add stars
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 10000;
    const starPositions = new Float32Array(starCount * 3);

    for(let i = 0; i < starCount * 3; i += 3) {
        const radius = 50;
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        
        starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
        starPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
        starPositions[i + 2] = radius * Math.cos(phi);
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.05,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    
    camera.position.z = 20;
    
    // Mouse interaction
    let mouseX = 0;
    let mouseY = 0;
    document.addEventListener('mousemove', (event) => {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    });
    
    // Animation
    function animate() {
        requestAnimationFrame(animate);
        
        // Rotate Earth and clouds
        globe.rotation.y += 0.001;
        clouds.rotation.y += 0.0012;
        
        // Mouse interaction for slight tilt
        globe.rotation.x += (mouseY * 0.01 - globe.rotation.x) * 0.1;
        globe.rotation.y += (mouseX * 0.01 - globe.rotation.y) * 0.1;
        
        clouds.rotation.x = globe.rotation.x;
        atmosphere.rotation.x = globe.rotation.x;
        atmosphere.rotation.y = globe.rotation.y;
        
        stars.rotation.y += 0.0001;
        
        renderer.render(scene, camera);
    }
    animate();
    
    // Handle resize
    window.addEventListener('resize', onWindowResize, false);

    // Add this after your globe container setup
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 200px;
        background: linear-gradient(to bottom, 
            rgba(0, 0, 0, 0.8) 0%,
            rgba(0, 0, 0, 0.4) 50%,
            transparent 100%);
        pointer-events: none;
        z-index: 1;
    `;
    document.getElementById('globe-container').appendChild(overlay);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Copy Command Function
function copyCommand(commandText) {
    navigator.clipboard.writeText(commandText).then(() => {
        const copyButton = event.currentTarget;
        const originalText = copyButton.innerHTML;
        
        // Show feedback
        copyButton.innerHTML = `
            <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
        `;
        
        // Reset after 2 seconds
        setTimeout(() => {
            copyButton.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Initialize globe when document is loaded
document.addEventListener('DOMContentLoaded', initGlobe);

// Browse mode command animations
document.querySelectorAll('.command-text').forEach(command => {
    command.addEventListener('click', function() {
        // Create copy feedback
        const feedback = document.createElement('div');
        feedback.className = 'fixed bottom-4 right-4 bg-primary/20 text-primary px-4 py-2 rounded-full text-sm';
        feedback.textContent = 'Command copied!';
        feedback.style.opacity = '0';
        feedback.style.transform = 'translateY(20px)';
        feedback.style.transition = 'all 0.3s ease';
        
        document.body.appendChild(feedback);
        
        // Copy command text
        navigator.clipboard.writeText(this.textContent.trim());
        
        // Show feedback
        setTimeout(() => {
            feedback.style.opacity = '1';
            feedback.style.transform = 'translateY(0)';
        }, 100);
        
        // Remove feedback
        setTimeout(() => {
            feedback.style.opacity = '0';
            feedback.style.transform = 'translateY(20px)';
            setTimeout(() => feedback.remove(), 300);
        }, 2000);
    });
});

// Version badge animation
const versionBadge = document.querySelector('.premium-badge');
if (versionBadge) {
    versionBadge.addEventListener('mouseover', () => {
        versionBadge.style.transform = 'scale(1.1) rotate(-2deg)';
    });
    versionBadge.addEventListener('mouseout', () => {
        versionBadge.style.transform = 'scale(1) rotate(0deg)';
    });
}

// Add pulsing animation to the update banner
document.addEventListener('DOMContentLoaded', () => {
    const updateBanner = document.querySelector('.animate-pulse');
    if (updateBanner) {
        updateBanner.style.animation = 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite';
    }
});
