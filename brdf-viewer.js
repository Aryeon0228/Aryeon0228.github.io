import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// Metal presets with complete data (RGB 0-1 format)
const METAL_PRESETS = {
    // Pure metals
    iron: {
        name: '⚙️ Iron',
        color: [0.776, 0.776, 0.776],
        metallic: 1.0,
        roughness: 0.45,
        clearcoat: 0.0,
        clearcoatRoughness: 0.0,
        states: {
            normal: { color: '#C6C6C6', metallic: 1.0, roughness: 0.45, label: '일반' },
            weathered: { color: '#8C5A3C', metallic: 0.1, roughness: 0.85, label: '녹슬음' }
        }
    },
    aluminum: {
        name: '✈️ Aluminum',
        color: [0.961, 0.965, 0.965],
        metallic: 1.0,
        roughness: 0.2,
        clearcoat: 0.0,
        clearcoatRoughness: 0.0,
        states: {
            normal: { color: '#F5F6F6', metallic: 1.0, roughness: 0.2, label: '일반' },
            weathered: { color: '#C8CDCD', metallic: 0.4, roughness: 0.75, label: '산화' }
        }
    },
    copper: {
        name: '🔔 Copper',
        color: [0.980, 0.816, 0.753],
        metallic: 1.0,
        roughness: 0.15,
        clearcoat: 0.0,
        clearcoatRoughness: 0.0,
        states: {
            normal: { color: '#FAD0C0', metallic: 1.0, roughness: 0.15, label: '일반' },
            weathered: { color: '#78B4A5', metallic: 0.05, roughness: 0.7, label: '녹청' }
        }
    },
    gold: {
        name: '👑 Gold',
        color: [1.0, 0.886, 0.608],
        metallic: 1.0,
        roughness: 0.15,
        clearcoat: 0.0,
        clearcoatRoughness: 0.0,
        states: {
            normal: { color: '#FFE29B', metallic: 1.0, roughness: 0.15, label: '일반' },
            weathered: { color: '#C8AA6E', metallic: 0.8, roughness: 0.45, label: '변색' }
        }
    },
    silver: {
        name: '💍 Silver',
        color: [0.988, 0.980, 0.961],
        metallic: 1.0,
        roughness: 0.075,
        clearcoat: 0.0,
        clearcoatRoughness: 0.0,
        states: {
            normal: { color: '#FCFAF5', metallic: 1.0, roughness: 0.075, label: '일반' },
            weathered: { color: '#504B46', metallic: 0.6, roughness: 0.6, label: '변색' }
        }
    },
    bronze: {
        name: '🏺 Bronze',
        color: [0.804, 0.498, 0.196],
        metallic: 1.0,
        roughness: 0.25,
        clearcoat: 0.0,
        clearcoatRoughness: 0.0,
        states: {
            normal: { color: '#CD7F32', metallic: 1.0, roughness: 0.25, label: '일반' },
            weathered: { color: '#6B8E7F', metallic: 0.05, roughness: 0.8, label: '녹청' }
        }
    },
    brass: {
        name: '🎺 Brass',
        color: [0.882, 0.757, 0.431],
        metallic: 1.0,
        roughness: 0.2,
        clearcoat: 0.0,
        clearcoatRoughness: 0.0,
        states: {
            normal: { color: '#E1C16E', metallic: 1.0, roughness: 0.2, label: '일반' },
            weathered: { color: '#8B7355', metallic: 0.5, roughness: 0.6, label: '변색' }
        }
    },
    titanium: {
        name: '🛡️ Titanium',
        color: [0.753, 0.753, 0.784],
        metallic: 1.0,
        roughness: 0.35,
        clearcoat: 0.0,
        clearcoatRoughness: 0.0,
        states: {
            normal: { color: '#C0C0C8', metallic: 1.0, roughness: 0.35, label: '일반' },
            weathered: { color: '#B8B8C0', metallic: 0.7, roughness: 0.7, label: '산화' }
        }
    },
    // Oxidized/Rusted metals
    iron_rust: { color: [0.549, 0.353, 0.235], metallic: 0.1, roughness: 0.85, clearcoat: 0.0, clearcoatRoughness: 0.0 },
    aluminum_oxidized: { color: [0.784, 0.804, 0.804], metallic: 0.4, roughness: 0.75, clearcoat: 0.0, clearcoatRoughness: 0.0 },
    copper_patina: { color: [0.471, 0.706, 0.647], metallic: 0.05, roughness: 0.7, clearcoat: 0.0, clearcoatRoughness: 0.0 },
    gold_tarnished: { color: [0.784, 0.667, 0.431], metallic: 0.8, roughness: 0.45, clearcoat: 0.0, clearcoatRoughness: 0.0 },
    silver_tarnished: { color: [0.314, 0.294, 0.275], metallic: 0.6, roughness: 0.6, clearcoat: 0.0, clearcoatRoughness: 0.0 },
    bronze_patina: { color: [0.420, 0.557, 0.498], metallic: 0.05, roughness: 0.8, clearcoat: 0.0, clearcoatRoughness: 0.0 },
    brass_tarnished: { color: [0.545, 0.451, 0.333], metallic: 0.5, roughness: 0.6, clearcoat: 0.0, clearcoatRoughness: 0.0 },
    titanium_oxidized: { color: [0.722, 0.722, 0.753], metallic: 0.7, roughness: 0.7, clearcoat: 0.0, clearcoatRoughness: 0.0 },
    // Other materials
    chrome: { color: [0.88, 0.88, 0.88], metallic: 1.0, roughness: 0.05, clearcoat: 0.0, clearcoatRoughness: 0.0 },
    plastic: { color: [0.8, 0.2, 0.2], metallic: 0.0, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.1 },
    rubber: { color: [0.15, 0.15, 0.15], metallic: 0.0, roughness: 0.9, clearcoat: 0.0, clearcoatRoughness: 0.0 },
    wood: { color: [0.42, 0.2, 0.06], metallic: 0.0, roughness: 0.7, clearcoat: 0.1, clearcoatRoughness: 0.3 },
    carpaint: { color: [0.8, 0.0, 0.0], metallic: 0.0, roughness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.0 },
    brushedmetal: { color: [0.7, 0.7, 0.7], metallic: 1.0, roughness: 0.3, clearcoat: 0.0, clearcoatRoughness: 0.0 }
};

// Generate reference panel HTML
function generateReferencePanel() {
    const refPanel = document.getElementById('refPanel');
    if (!refPanel) return;

    let html = '<h2>🔨 Metal Reference</h2>';

    // Only show metals with detailed states
    const detailedMetals = ['iron', 'aluminum', 'copper', 'gold', 'silver', 'bronze', 'brass', 'titanium'];

    detailedMetals.forEach(key => {
        const metal = METAL_PRESETS[key];
        if (!metal.states) return;

        html += `
        <div class="metal-ref-card">
            <div class="metal-ref-name">${metal.name}</div>
            <div class="metal-states-grid">`;

        // Normal state
        const normal = metal.states.normal;
        html += `
                <div class="metal-state">
                    <div class="metal-state-title">${normal.label}</div>
                    <div class="metal-ref-swatches">
                        <div class="metal-ref-swatch" style="background: ${normal.color};"></div>
                        <div class="metal-ref-swatch" style="background: ${normal.color};"></div>
                    </div>
                    <div class="metal-ref-swatch-label">Base / Spec</div>
                    <div class="metal-ref-info">M:${normal.metallic.toFixed(1)} • R:${normal.roughness}</div>
                </div>`;

        // Weathered state
        const weathered = metal.states.weathered;
        html += `
                <div class="metal-state">
                    <div class="metal-state-title">${weathered.label}</div>
                    <div class="metal-ref-swatches">
                        <div class="metal-ref-swatch" style="background: ${weathered.color};"></div>
                        <div class="metal-ref-swatch" style="background: #3C3C3C;"></div>
                    </div>
                    <div class="metal-ref-swatch-label">Base / Spec</div>
                    <div class="metal-ref-info">M:${weathered.metallic.toFixed(1)} • R:${weathered.roughness}</div>
                </div>
            </div>
        </div>`;
    });

    refPanel.innerHTML = html;
}

// Initialize the viewer
function initViewer() {
    // Reference panel toggle
    const refToggle = document.getElementById('refToggle');
    const refPanel = document.getElementById('refPanel');

    if (refToggle && refPanel) {
        refToggle.addEventListener('click', () => {
            refPanel.classList.toggle('open');
            refToggle.textContent = refPanel.classList.contains('open') ? '✖️' : '📚';
        });
    }

    // Generate reference panel content
    generateReferencePanel();

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f1e);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const container = document.getElementById('canvas-container');
    if (container) {
        container.appendChild(renderer.domElement);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Load HDR environment map
    let envMap = null;
    let iblEnabled = true;
    const rgbeLoader = new RGBELoader();

    rgbeLoader.load(
        'https://threejs.org/examples/textures/equirectangular/royal_esplanade_1k.hdr',
        function (texture) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            envMap = texture;
            scene.environment = texture;
        },
        undefined,
        function (error) {
            console.error('Error loading HDR:', error);
        }
    );

    // Lighting
    const light1 = new THREE.DirectionalLight(0xffffff, 1.0);
    light1.position.set(5, 5, 5);
    scene.add(light1);

    const light2 = new THREE.DirectionalLight(0x99b3ff, 0.6);
    light2.position.set(-5, -3, 3);
    scene.add(light2);

    const light3 = new THREE.DirectionalLight(0xffcc99, 0.4);
    light3.position.set(0, -5, -3);
    scene.add(light3);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);

    // Material
    const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0.5, 0.5, 0.5),
        metalness: 0.0,
        roughness: 0.5,
        clearcoat: 0.0,
        clearcoatRoughness: 0.0,
        reflectivity: 0.5
    });

    // Geometries
    const sphereGeometry = new THREE.SphereGeometry(1, 64, 64);
    const sphere = new THREE.Mesh(sphereGeometry, material);
    sphere.position.x = -2.5;
    scene.add(sphere);

    const torusKnotGeometry = new THREE.TorusKnotGeometry(0.8, 0.3, 128, 16, 2, 3);
    const torusKnot = new THREE.Mesh(torusKnotGeometry, material);
    torusKnot.position.x = 2.5;
    scene.add(torusKnot);

    // UI Controls
    const controls_ui = {
        colorR: document.getElementById('colorR'),
        colorG: document.getElementById('colorG'),
        colorB: document.getElementById('colorB'),
        metallic: document.getElementById('metallic'),
        roughness: document.getElementById('roughness'),
        specular: document.getElementById('specular'),
        clearcoat: document.getElementById('clearcoat'),
        clearcoatRoughness: document.getElementById('clearcoatRoughness')
    };

    const valueDisplays = {
        metallic: document.getElementById('metallicValue'),
        roughness: document.getElementById('roughnessValue'),
        specular: document.getElementById('specularValue'),
        clearcoat: document.getElementById('clearcoatValue'),
        clearcoatRoughness: document.getElementById('clearcoatRoughnessValue')
    };

    function updateMaterial() {
        const r = parseFloat(controls_ui.colorR.value);
        const g = parseFloat(controls_ui.colorG.value);
        const b = parseFloat(controls_ui.colorB.value);

        material.color.setRGB(r, g, b);
        material.metalness = parseFloat(controls_ui.metallic.value);
        material.roughness = parseFloat(controls_ui.roughness.value);
        material.reflectivity = parseFloat(controls_ui.specular.value);
        material.clearcoat = parseFloat(controls_ui.clearcoat.value);
        material.clearcoatRoughness = parseFloat(controls_ui.clearcoatRoughness.value);

        // Update displays
        if (valueDisplays.metallic) valueDisplays.metallic.textContent = material.metalness.toFixed(2);
        if (valueDisplays.roughness) valueDisplays.roughness.textContent = material.roughness.toFixed(2);
        if (valueDisplays.specular) valueDisplays.specular.textContent = material.reflectivity.toFixed(2);
        if (valueDisplays.clearcoat) valueDisplays.clearcoat.textContent = material.clearcoat.toFixed(2);
        if (valueDisplays.clearcoatRoughness) valueDisplays.clearcoatRoughness.textContent = material.clearcoatRoughness.toFixed(2);

        // Update color display
        const r255 = Math.round(r * 255);
        const g255 = Math.round(g * 255);
        const b255 = Math.round(b * 255);
        const rgbHex = `rgb(${r255}, ${g255}, ${b255})`;

        const colorPreview = document.getElementById('colorPreview');
        const colorRGBText = document.getElementById('colorRGBText');
        if (colorPreview) colorPreview.style.backgroundColor = rgbHex;
        if (colorRGBText) colorRGBText.textContent = `RGB(${r255}, ${g255}, ${b255})`;
    }

    // Add event listeners
    Object.values(controls_ui).forEach(control => {
        if (control) {
            control.addEventListener('input', updateMaterial);
        }
    });

    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const presetName = btn.dataset.preset;
            const preset = METAL_PRESETS[presetName];

            if (preset && controls_ui.colorR) {
                controls_ui.colorR.value = preset.color[0];
                controls_ui.colorG.value = preset.color[1];
                controls_ui.colorB.value = preset.color[2];
                controls_ui.metallic.value = preset.metallic;
                controls_ui.roughness.value = preset.roughness;
                controls_ui.clearcoat.value = preset.clearcoat;
                controls_ui.clearcoatRoughness.value = preset.clearcoatRoughness;

                updateMaterial();
            }
        });
    });

    // IBL Toggle
    const iblToggle = document.getElementById('iblToggle');
    if (iblToggle) {
        iblToggle.addEventListener('click', () => {
            iblEnabled = !iblEnabled;
            scene.environment = iblEnabled ? envMap : null;

            iblToggle.classList.toggle('active');
            iblToggle.textContent = iblEnabled ? '🌍 IBL Environment: ON' : '🌑 IBL Environment: OFF';
        });
    }

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        // Slow rotation
        sphere.rotation.y += 0.003;
        torusKnot.rotation.y += 0.003;
        torusKnot.rotation.x += 0.002;

        controls.update();
        renderer.render(scene, camera);
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Initialize color display
    updateMaterial();

    animate();
}

// Start when DOM is ready
initViewer();
