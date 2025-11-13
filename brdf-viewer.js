import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// HSV to RGB conversion function
function hsvToRgb(h, s, v) {
    // h: 0-360, s: 0-100, v: 0-100
    // returns: {r, g, b} in 0-1 range
    s = s / 100;
    v = v / 100;

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r, g, b;
    if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
    } else {
        r = c; g = 0; b = x;
    }

    return {
        r: r + m,
        g: g + m,
        b: b + m
    };
}

// RGB to HSV conversion function
function rgbToHsv(r, g, b) {
    // r, g, b: 0-1 range
    // returns: {h: 0-360, s: 0-100, v: 0-100}
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
        if (max === r) {
            h = 60 * (((g - b) / delta) % 6);
        } else if (max === g) {
            h = 60 * (((b - r) / delta) + 2);
        } else {
            h = 60 * (((r - g) / delta) + 4);
        }
    }
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : (delta / max) * 100;
    const v = max * 100;

    return { h, s, v };
}

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
    // Special effects - Sheen examples
    velvet: { color: [0.6, 0.1, 0.2], metallic: 0.0, roughness: 0.8, clearcoat: 0.0, clearcoatRoughness: 0.0, sheen: 1.0 },
    peach: { color: [1.0, 0.8, 0.6], metallic: 0.0, roughness: 0.4, clearcoat: 0.0, clearcoatRoughness: 0.0, sheen: 0.7 },
    satin: { color: [0.02, 0.27, 0.4], metallic: 0.0, roughness: 0.3, clearcoat: 0.0, clearcoatRoughness: 0.0, sheen: 0.6 },
    dusty_metal: { color: [0.5, 0.5, 0.5], metallic: 1.0, roughness: 0.6, clearcoat: 0.0, clearcoatRoughness: 0.0, sheen: 0.5 },
    // Special effects - Iridescence examples
    soap_bubble: { color: [0.95, 0.95, 0.95], metallic: 0.0, roughness: 0.0, clearcoat: 0.0, clearcoatRoughness: 0.0, iridescence: 1.0, iridescenceIOR: 1.3, transmission: 0.9 },
    titanium_anodized: { color: [0.75, 0.75, 0.78], metallic: 1.0, roughness: 0.2, clearcoat: 0.0, clearcoatRoughness: 0.0, iridescence: 0.8, iridescenceIOR: 1.5 },
    oil_slick: { color: [0.1, 0.1, 0.1], metallic: 0.3, roughness: 0.1, clearcoat: 0.0, clearcoatRoughness: 0.0, iridescence: 0.9, iridescenceIOR: 1.4 },
    cd_surface: { color: [0.9, 0.9, 0.9], metallic: 0.5, roughness: 0.05, clearcoat: 0.0, clearcoatRoughness: 0.0, iridescence: 1.0, iridescenceIOR: 1.6 },
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

    // HDR Environment maps
    const hdriMaps = {
        outdoor: {
            name: '☀️ Day',
            url: 'https://threejs.org/examples/textures/equirectangular/royal_esplanade_1k.hdr'
        },
        sunset: {
            name: '🌅 Sunset',
            url: 'https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr'
        },
        forest: {
            name: '🌲 Forest',
            url: 'https://threejs.org/examples/textures/equirectangular/forest_slope_1k.hdr'
        },
        night: {
            name: '🌙 Night',
            url: 'https://threejs.org/examples/textures/equirectangular/moonless_golf_1k.hdr'
        },
        overpass: {
            name: '🌉 Overpass',
            url: 'https://threejs.org/examples/textures/equirectangular/pedestrian_overpass_1k.hdr'
        },
        quarry: {
            name: '⛰️ Quarry',
            url: 'https://threejs.org/examples/textures/equirectangular/quarry_01_1k.hdr'
        },
        warehouse: {
            name: '🏢 Warehouse',
            url: 'https://threejs.org/examples/textures/equirectangular/empty_warehouse_01_1k.hdr'
        },
        beach: {
            name: '🏖️ Beach',
            url: 'https://threejs.org/examples/textures/equirectangular/kloppenheim_06_1k.hdr'
        }
    };

    let envMap = null;
    let iblEnabled = true;
    const rgbeLoader = new RGBELoader();

    // Function to load environment map
    function loadEnvironment(key) {
        const hdri = hdriMaps[key];
        if (!hdri) return;

        rgbeLoader.load(
            hdri.url,
            function (texture) {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                envMap = texture;
                if (iblEnabled) {
                    scene.environment = texture;
                }
            },
            undefined,
            function (error) {
                console.error('Error loading HDR:', error);
            }
        );
    }

    // Load default environment
    loadEnvironment('outdoor');

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
        reflectivity: 0.5,
        sheen: 0.0,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color(1, 1, 1),
        iridescence: 0.0,
        iridescenceIOR: 1.3,
        iridescenceThicknessRange: [100, 400],
        transmission: 0.0,
        thickness: 0.5,
        ior: 1.5
    });

    // Geometries - Create all geometries but only show selected one
    const geometries = {
        sphere: new THREE.SphereGeometry(1.5, 64, 64),
        torus: new THREE.TorusKnotGeometry(1, 0.3, 128, 16, 2, 3),
        cube: new THREE.BoxGeometry(2, 2, 2, 32, 32, 32),
        cylinder: new THREE.CylinderGeometry(1, 1, 2, 64, 32)
    };

    let currentMesh = new THREE.Mesh(geometries.sphere, material);
    scene.add(currentMesh);

    // UI Controls
    const controls_ui = {
        colorH: document.getElementById('colorH'),
        colorS: document.getElementById('colorS'),
        colorV: document.getElementById('colorV'),
        metallic: document.getElementById('metallic'),
        roughness: document.getElementById('roughness'),
        specular: document.getElementById('specular'),
        clearcoat: document.getElementById('clearcoat'),
        clearcoatRoughness: document.getElementById('clearcoatRoughness'),
        sheen: document.getElementById('sheen'),
        iridescence: document.getElementById('iridescence'),
        iridescenceIOR: document.getElementById('iridescenceIOR'),
        transmission: document.getElementById('transmission')
    };

    const valueDisplays = {
        metallic: document.getElementById('metallicValue'),
        roughness: document.getElementById('roughnessValue'),
        specular: document.getElementById('specularValue'),
        clearcoat: document.getElementById('clearcoatValue'),
        clearcoatRoughness: document.getElementById('clearcoatRoughnessValue'),
        sheen: document.getElementById('sheenValue'),
        iridescence: document.getElementById('iridescenceValue'),
        iridescenceIOR: document.getElementById('iridescenceIORValue'),
        transmission: document.getElementById('transmissionValue')
    };

    function updateMaterial() {
        const h = parseFloat(controls_ui.colorH.value);
        const s = parseFloat(controls_ui.colorS.value);
        const v = parseFloat(controls_ui.colorV.value);

        // Convert HSV to RGB
        const rgb = hsvToRgb(h, s, v);
        material.color.setRGB(rgb.r, rgb.g, rgb.b);

        material.metalness = parseFloat(controls_ui.metallic.value);
        material.roughness = parseFloat(controls_ui.roughness.value);
        material.reflectivity = parseFloat(controls_ui.specular.value);
        material.clearcoat = parseFloat(controls_ui.clearcoat.value);
        material.clearcoatRoughness = parseFloat(controls_ui.clearcoatRoughness.value);
        material.sheen = parseFloat(controls_ui.sheen.value);
        material.iridescence = parseFloat(controls_ui.iridescence.value);
        material.iridescenceIOR = parseFloat(controls_ui.iridescenceIOR.value);
        material.transmission = parseFloat(controls_ui.transmission.value);

        // Update displays
        if (valueDisplays.metallic) valueDisplays.metallic.textContent = material.metalness.toFixed(2);
        if (valueDisplays.roughness) valueDisplays.roughness.textContent = material.roughness.toFixed(2);
        if (valueDisplays.specular) valueDisplays.specular.textContent = material.reflectivity.toFixed(2);
        if (valueDisplays.clearcoat) valueDisplays.clearcoat.textContent = material.clearcoat.toFixed(2);
        if (valueDisplays.clearcoatRoughness) valueDisplays.clearcoatRoughness.textContent = material.clearcoatRoughness.toFixed(2);
        if (valueDisplays.sheen) valueDisplays.sheen.textContent = material.sheen.toFixed(2);
        if (valueDisplays.iridescence) valueDisplays.iridescence.textContent = material.iridescence.toFixed(2);
        if (valueDisplays.iridescenceIOR) valueDisplays.iridescenceIOR.textContent = material.iridescenceIOR.toFixed(2);
        if (valueDisplays.transmission) valueDisplays.transmission.textContent = material.transmission.toFixed(2);

        // Update color display
        const r255 = Math.round(rgb.r * 255);
        const g255 = Math.round(rgb.g * 255);
        const b255 = Math.round(rgb.b * 255);
        const rgbHex = `rgb(${r255}, ${g255}, ${b255})`;

        const colorPreview = document.getElementById('colorPreview');
        const colorRGBText = document.getElementById('colorRGBText');
        if (colorPreview) colorPreview.style.backgroundColor = rgbHex;
        if (colorRGBText) colorRGBText.textContent = `HSV(${Math.round(h)}°, ${Math.round(s)}%, ${Math.round(v)}%)`;

        // Update saturation slider gradient based on current hue
        const hueColor = hsvToRgb(h, 100, 100);
        const hueHex = `rgb(${Math.round(hueColor.r * 255)}, ${Math.round(hueColor.g * 255)}, ${Math.round(hueColor.b * 255)})`;
        if (controls_ui.colorS) {
            controls_ui.colorS.style.background = `linear-gradient(to right, #808080, ${hueHex})`;
        }

        // Update value slider gradient based on current hue and saturation
        const valueColorMax = hsvToRgb(h, s, 100);
        const valueHex = `rgb(${Math.round(valueColorMax.r * 255)}, ${Math.round(valueColorMax.g * 255)}, ${Math.round(valueColorMax.b * 255)})`;
        if (controls_ui.colorV) {
            controls_ui.colorV.style.background = `linear-gradient(to right, #000000, ${valueHex})`;
        }
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

            if (preset && controls_ui.colorH) {
                // Convert RGB preset to HSV
                const hsv = rgbToHsv(preset.color[0], preset.color[1], preset.color[2]);
                controls_ui.colorH.value = hsv.h;
                controls_ui.colorS.value = hsv.s;
                controls_ui.colorV.value = hsv.v;

                controls_ui.metallic.value = preset.metallic;
                controls_ui.roughness.value = preset.roughness;
                controls_ui.clearcoat.value = preset.clearcoat;
                controls_ui.clearcoatRoughness.value = preset.clearcoatRoughness;
                controls_ui.sheen.value = preset.sheen || 0;
                controls_ui.iridescence.value = preset.iridescence || 0;
                controls_ui.iridescenceIOR.value = preset.iridescenceIOR || 1.3;
                controls_ui.transmission.value = preset.transmission || 0;

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

    // Geometry switching
    document.querySelectorAll('.geometry-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const geometryType = btn.dataset.geometry;

            // Remove current mesh
            scene.remove(currentMesh);

            // Create new mesh with selected geometry
            currentMesh = new THREE.Mesh(geometries[geometryType], material);
            scene.add(currentMesh);

            // Update active button
            document.querySelectorAll('.geometry-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Environment switching
    document.querySelectorAll('.environment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const envType = btn.dataset.environment;
            loadEnvironment(envType);

            // Update active button
            document.querySelectorAll('.environment-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Normal map upload
    const normalMapUpload = document.getElementById('normalMapUpload');
    const clearNormalMap = document.getElementById('clearNormalMap');
    const normalMapInfo = document.getElementById('normalMapInfo');
    const textureLoader = new THREE.TextureLoader();

    if (normalMapUpload) {
        normalMapUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    textureLoader.load(event.target.result, (texture) => {
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        material.normalMap = texture;
                        material.normalScale = new THREE.Vector2(1, 1);
                        material.needsUpdate = true;

                        if (normalMapInfo) {
                            normalMapInfo.textContent = `✅ Loaded: ${file.name}`;
                            normalMapInfo.style.color = '#5cdfe6';
                        }
                    });
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (clearNormalMap) {
        clearNormalMap.addEventListener('click', () => {
            material.normalMap = null;
            material.needsUpdate = true;
            if (normalMapUpload) normalMapUpload.value = '';
            if (normalMapInfo) {
                normalMapInfo.textContent = 'No normal map loaded';
                normalMapInfo.style.color = '#aaa';
            }
        });
    }

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        // Slow rotation
        currentMesh.rotation.y += 0.003;
        currentMesh.rotation.x += 0.002;

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
