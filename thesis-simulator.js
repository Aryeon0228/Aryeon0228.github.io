import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ===== Global State =====
const state = {
    styleBlend: 0, // 0 = realistic, 100 = stylized
    currentViewMode: 'quad',
    currentMaterial: 'wood',
    iblEnabled: true,
    autoRotateEnabled: false,
    currentEnvironment: 'indoor',
    displacementScale: 0.5,
    geometryDetail: 64
};

// ===== Material Data Storage =====
const materials = {
    wood: {
        realistic: { albedo: null, normal: null, roughness: null, metallic: null, ao: null, height: null },
        stylized: { albedo: null, normal: null, roughness: null, metallic: null, ao: null, height: null },
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        mesh: null
    },
    stone: {
        realistic: { albedo: null, normal: null, roughness: null, metallic: null, ao: null, height: null },
        stylized: { albedo: null, normal: null, roughness: null, metallic: null, ao: null, height: null },
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        mesh: null
    },
    metal: {
        realistic: { albedo: null, normal: null, roughness: null, metallic: null, ao: null, height: null },
        stylized: { albedo: null, normal: null, roughness: null, metallic: null, ao: null, height: null },
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        mesh: null
    },
    cloth: {
        realistic: { albedo: null, normal: null, roughness: null, metallic: null, ao: null, height: null },
        stylized: { albedo: null, normal: null, roughness: null, metallic: null, ao: null, height: null },
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        mesh: null
    }
};

// Single view state
const singleView = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    mesh: null
};

// Compare view state
const compareView = {
    left: { scene: null, camera: null, renderer: null, controls: null, mesh: null },
    right: { scene: null, camera: null, renderer: null, controls: null, mesh: null }
};

// Environment map
let envMap = null;

// ===== HDR Environment Maps =====
const environmentMaps = {
    indoor: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/abandoned_hall_01_1k.hdr',
    sunset: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloppenheim_06_1k.hdr',
    studio: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr',
    outdoor: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/forest_slope_1k.hdr'
};

// ===== Initialize =====
function init() {
    console.log('Initializing Thesis Simulator...');

    // Load default environment
    loadEnvironment(state.currentEnvironment);

    // Initialize quad view
    initQuadView();

    // Setup event listeners
    setupEventListeners();

    // Start animation loop
    animate();
}

// ===== Load Environment Map =====
function loadEnvironment(envName) {
    const loader = new RGBELoader();
    const url = environmentMaps[envName] || environmentMaps.indoor;

    loader.load(url, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        envMap = texture;

        // Update all scenes
        updateAllEnvironments();
        console.log(`Loaded environment: ${envName}`);
    }, undefined, (error) => {
        console.error('Error loading HDR environment:', error);
    });
}

// ===== Update All Environments =====
function updateAllEnvironments() {
    if (!envMap) return;

    // Update quad view scenes
    Object.keys(materials).forEach(matName => {
        if (materials[matName].scene) {
            materials[matName].scene.environment = state.iblEnabled ? envMap : null;
        }
    });

    // Update single view
    if (singleView.scene) {
        singleView.scene.environment = state.iblEnabled ? envMap : null;
    }

    // Update compare view
    if (compareView.left.scene) {
        compareView.left.scene.environment = state.iblEnabled ? envMap : null;
    }
    if (compareView.right.scene) {
        compareView.right.scene.environment = state.iblEnabled ? envMap : null;
    }
}

// ===== Initialize Quad View =====
function initQuadView() {
    const materialNames = ['wood', 'stone', 'metal', 'cloth'];

    materialNames.forEach(matName => {
        const container = document.getElementById(`canvas-${matName}`);
        if (!container) return;

        // Create scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a1e);

        // Create camera
        const camera = new THREE.PerspectiveCamera(
            45,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        camera.position.set(0, 0, 3);

        // Create renderer
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(renderer.domElement);

        // Create controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = state.autoRotateEnabled;
        controls.autoRotateSpeed = 2.0;

        // Create geometry and material
        const detail = state.geometryDetail;
        const geometry = new THREE.SphereGeometry(1, detail, detail);
        const material = createPBRMaterial(matName);
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        // Store references
        materials[matName].scene = scene;
        materials[matName].camera = camera;
        materials[matName].renderer = renderer;
        materials[matName].controls = controls;
        materials[matName].mesh = mesh;
    });
}

// ===== Create PBR Material =====
function createPBRMaterial(matName) {
    const defaultColors = {
        wood: 0x8b4513,
        stone: 0x808080,
        metal: 0xc0c0c0,
        cloth: 0x4682b4
    };

    const material = new THREE.MeshStandardMaterial({
        color: defaultColors[matName] || 0x808080,
        roughness: 0.7,
        metalness: matName === 'metal' ? 0.9 : 0.0
    });

    return material;
}

// ===== Update Material Textures =====
function updateMaterialTextures(matName) {
    const mat = materials[matName];
    if (!mat || !mat.mesh) return;

    const blend = state.styleBlend / 100; // 0 to 1
    const pbr = mat.mesh.material;

    // If we have both realistic and stylized textures, blend them
    // For now, we'll switch between them based on threshold
    // In a real implementation, you might want to use a custom shader for smooth blending

    const useStylized = blend > 0.5;
    const textureSet = useStylized ? mat.stylized : mat.realistic;

    // Update textures
    if (textureSet.albedo) {
        pbr.map = textureSet.albedo;
        pbr.needsUpdate = true;
    }

    if (textureSet.normal) {
        pbr.normalMap = textureSet.normal;
        pbr.needsUpdate = true;
    }

    if (textureSet.roughness) {
        pbr.roughnessMap = textureSet.roughness;
        pbr.needsUpdate = true;
    }

    if (textureSet.metallic && matName === 'metal') {
        pbr.metalnessMap = textureSet.metallic;
        pbr.needsUpdate = true;
    }

    if (textureSet.ao) {
        pbr.aoMap = textureSet.ao;
        pbr.aoMapIntensity = 1.0;
        pbr.needsUpdate = true;
    }

    if (textureSet.height) {
        pbr.displacementMap = textureSet.height;
        pbr.displacementScale = state.displacementScale;
        pbr.needsUpdate = true;
    }

    // Update blend indicator
    updateBlendIndicator(matName, blend);
}

// ===== Update Blend Indicator =====
function updateBlendIndicator(matName, blend) {
    const viewport = document.querySelector(`.viewport-item[data-material="${matName}"]`);
    if (!viewport) return;

    const blendFill = viewport.querySelector('.blend-fill');
    if (blendFill) {
        blendFill.style.width = `${blend * 100}%`;
    }
}

// ===== Handle Texture Upload =====
function handleTextureUpload(event) {
    const input = event.target;
    const file = input.files[0];
    if (!file) return;

    const matName = input.dataset.material;
    const style = input.dataset.style; // 'realistic' or 'stylized'
    const mapType = input.dataset.map; // 'albedo', 'normal', etc.

    const reader = new FileReader();
    reader.onload = (e) => {
        const loader = new THREE.TextureLoader();
        loader.load(e.target.result, (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.colorSpace = mapType === 'albedo' ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;

            // Store texture
            materials[matName][style][mapType] = texture;

            // Update material
            updateMaterialTextures(matName);

            console.log(`Loaded ${style} ${mapType} texture for ${matName}`);
        });
    };
    reader.readAsDataURL(file);
}

// ===== Rebuild All Geometries =====
function rebuildAllGeometries() {
    const detail = state.geometryDetail;

    // Rebuild quad view geometries
    Object.keys(materials).forEach(matName => {
        const mat = materials[matName];
        if (!mat.mesh || !mat.scene) return;

        // Store old material
        const oldMaterial = mat.mesh.material;

        // Remove old mesh
        mat.scene.remove(mat.mesh);
        mat.mesh.geometry.dispose();

        // Create new geometry
        const newGeometry = new THREE.SphereGeometry(1, detail, detail);
        const newMesh = new THREE.Mesh(newGeometry, oldMaterial);

        // Add new mesh
        mat.scene.add(newMesh);
        mat.mesh = newMesh;

        // Reapply textures
        updateMaterialTextures(matName);
    });

    // Rebuild single view geometry
    if (singleView.mesh && singleView.scene) {
        const oldMaterial = singleView.mesh.material;
        singleView.scene.remove(singleView.mesh);
        singleView.mesh.geometry.dispose();

        const newGeometry = new THREE.SphereGeometry(1, detail, detail);
        const newMesh = new THREE.Mesh(newGeometry, oldMaterial);

        singleView.scene.add(newMesh);
        singleView.mesh = newMesh;
    }

    // Rebuild compare view geometries
    ['left', 'right'].forEach(side => {
        const view = compareView[side];
        if (!view.mesh || !view.scene) return;

        const oldMaterial = view.mesh.material;
        view.scene.remove(view.mesh);
        view.mesh.geometry.dispose();

        const newGeometry = new THREE.SphereGeometry(1, detail, detail);
        const newMesh = new THREE.Mesh(newGeometry, oldMaterial);

        view.scene.add(newMesh);
        view.mesh = newMesh;
    });

    console.log(`Rebuilt all geometries with detail: ${detail}`);
}

// ===== Setup Event Listeners =====
function setupEventListeners() {
    // Style slider
    const styleSlider = document.getElementById('globalStyleSlider');
    const styleValue = document.getElementById('styleValue');

    styleSlider.addEventListener('input', (e) => {
        state.styleBlend = parseFloat(e.target.value);
        styleValue.textContent = Math.round(state.styleBlend);

        // Update all materials
        Object.keys(materials).forEach(matName => {
            updateMaterialTextures(matName);
        });
    });

    // View mode buttons
    const viewBtns = document.querySelectorAll('.view-btn');
    viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const mode = btn.dataset.mode;
            state.currentViewMode = mode;
            switchViewMode(mode);
        });
    });

    // Material selection buttons
    const materialBtns = document.querySelectorAll('.material-btn');
    materialBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            materialBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            state.currentMaterial = btn.dataset.material;
            updateSingleView();
            updateCompareView();
        });
    });

    // IBL toggle
    const iblToggle = document.getElementById('iblToggle');
    iblToggle.addEventListener('click', () => {
        state.iblEnabled = !state.iblEnabled;
        iblToggle.classList.toggle('active');
        iblToggle.textContent = `🌍 IBL Environment: ${state.iblEnabled ? 'ON' : 'OFF'}`;
        updateAllEnvironments();
    });

    // Environment selector
    const envSelect = document.getElementById('envSelect');
    envSelect.addEventListener('change', (e) => {
        state.currentEnvironment = e.target.value;
        loadEnvironment(state.currentEnvironment);
    });

    // Reset camera
    const resetCameraBtn = document.getElementById('resetCamera');
    resetCameraBtn.addEventListener('click', () => {
        Object.keys(materials).forEach(matName => {
            if (materials[matName].controls) {
                materials[matName].controls.reset();
            }
        });
        if (singleView.controls) singleView.controls.reset();
        if (compareView.left.controls) compareView.left.controls.reset();
        if (compareView.right.controls) compareView.right.controls.reset();
    });

    // Auto rotate
    const autoRotateBtn = document.getElementById('autoRotate');
    autoRotateBtn.addEventListener('click', () => {
        state.autoRotateEnabled = !state.autoRotateEnabled;
        autoRotateBtn.classList.toggle('active');

        Object.keys(materials).forEach(matName => {
            if (materials[matName].controls) {
                materials[matName].controls.autoRotate = state.autoRotateEnabled;
            }
        });
        if (singleView.controls) singleView.controls.autoRotate = state.autoRotateEnabled;
        if (compareView.left.controls) compareView.left.controls.autoRotate = state.autoRotateEnabled;
        if (compareView.right.controls) compareView.right.controls.autoRotate = state.autoRotateEnabled;
    });

    // Displacement scale
    const displacementScale = document.getElementById('displacementScale');
    const displacementValue = document.getElementById('displacementValue');

    displacementScale.addEventListener('input', (e) => {
        state.displacementScale = parseFloat(e.target.value);
        displacementValue.textContent = state.displacementScale.toFixed(2);

        // Update all materials
        Object.keys(materials).forEach(matName => {
            if (materials[matName].mesh && materials[matName].mesh.material) {
                materials[matName].mesh.material.displacementScale = state.displacementScale;
            }
        });

        if (singleView.mesh && singleView.mesh.material) {
            singleView.mesh.material.displacementScale = state.displacementScale;
        }

        if (compareView.left.mesh && compareView.left.mesh.material) {
            compareView.left.mesh.material.displacementScale = state.displacementScale;
        }

        if (compareView.right.mesh && compareView.right.mesh.material) {
            compareView.right.mesh.material.displacementScale = state.displacementScale;
        }
    });

    // Geometry detail
    const geometryDetail = document.getElementById('geometryDetail');

    geometryDetail.addEventListener('change', (e) => {
        state.geometryDetail = parseInt(e.target.value);

        // Rebuild all geometries
        rebuildAllGeometries();
    });

    // Upload tabs
    const uploadTabs = document.querySelectorAll('.upload-tab');
    uploadTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            uploadTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const matName = tab.dataset.material;
            document.querySelectorAll('.upload-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            document.querySelector(`.upload-panel[data-material="${matName}"]`).classList.add('active');
        });
    });

    // Texture uploads
    const textureInputs = document.querySelectorAll('.texture-input');
    textureInputs.forEach(input => {
        input.addEventListener('change', handleTextureUpload);
    });

    // Window resize
    window.addEventListener('resize', onWindowResize);
}

// ===== Switch View Mode =====
function switchViewMode(mode) {
    // Hide all views
    document.getElementById('quadView').classList.remove('active');
    document.getElementById('singleView').classList.remove('active');
    document.getElementById('compareView').classList.remove('active');

    // Show selected view
    if (mode === 'quad') {
        document.getElementById('quadView').classList.add('active');
        document.getElementById('materialSelection').classList.remove('show');
    } else if (mode === 'single') {
        document.getElementById('singleView').classList.add('active');
        document.getElementById('materialSelection').classList.add('show');
        initSingleView();
    } else if (mode === 'compare') {
        document.getElementById('compareView').classList.add('active');
        document.getElementById('materialSelection').classList.add('show');
        initCompareView();
    }

    // Trigger resize
    setTimeout(onWindowResize, 100);
}

// ===== Initialize Single View =====
function initSingleView() {
    if (singleView.scene) return; // Already initialized

    const container = document.getElementById('canvas-single');
    if (!container) return;

    // Clear container
    container.innerHTML = '';

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1e);
    scene.environment = state.iblEnabled ? envMap : null;

    // Create camera
    const camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0, 3);

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Create controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = state.autoRotateEnabled;

    // Create mesh
    const detail = state.geometryDetail;
    const geometry = new THREE.SphereGeometry(1, detail, detail);
    const material = createPBRMaterial(state.currentMaterial);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Store references
    singleView.scene = scene;
    singleView.camera = camera;
    singleView.renderer = renderer;
    singleView.controls = controls;
    singleView.mesh = mesh;

    updateSingleView();
}

// ===== Update Single View =====
function updateSingleView() {
    if (!singleView.mesh) return;

    // Update material based on current selection
    const mat = materials[state.currentMaterial];
    if (!mat) return;

    // Copy material properties
    const blend = state.styleBlend / 100;
    const useStylized = blend > 0.5;
    const textureSet = useStylized ? mat.stylized : mat.realistic;

    const pbr = singleView.mesh.material;

    if (textureSet.albedo) pbr.map = textureSet.albedo;
    if (textureSet.normal) pbr.normalMap = textureSet.normal;
    if (textureSet.roughness) pbr.roughnessMap = textureSet.roughness;
    if (textureSet.metallic) pbr.metalnessMap = textureSet.metallic;
    if (textureSet.ao) {
        pbr.aoMap = textureSet.ao;
        pbr.aoMapIntensity = 1.0;
    }

    pbr.needsUpdate = true;
}

// ===== Initialize Compare View =====
function initCompareView() {
    if (compareView.left.scene) return; // Already initialized

    // Initialize left (realistic) viewport
    initCompareViewport('left', 'canvas-compare-left', 'realistic');

    // Initialize right (stylized) viewport
    initCompareViewport('right', 'canvas-compare-right', 'stylized');

    updateCompareView();
}

// ===== Initialize Compare Viewport =====
function initCompareViewport(side, containerId, style) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear container
    container.innerHTML = '';

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1e);
    scene.environment = state.iblEnabled ? envMap : null;

    // Create camera
    const camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0, 3);

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Create controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = state.autoRotateEnabled;

    // Create mesh
    const detail = state.geometryDetail;
    const geometry = new THREE.SphereGeometry(1, detail, detail);
    const material = createPBRMaterial(state.currentMaterial);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Store references
    compareView[side].scene = scene;
    compareView[side].camera = camera;
    compareView[side].renderer = renderer;
    compareView[side].controls = controls;
    compareView[side].mesh = mesh;
}

// ===== Update Compare View =====
function updateCompareView() {
    if (!compareView.left.mesh || !compareView.right.mesh) return;

    const mat = materials[state.currentMaterial];
    if (!mat) return;

    // Left side: realistic
    const pbrLeft = compareView.left.mesh.material;
    if (mat.realistic.albedo) pbrLeft.map = mat.realistic.albedo;
    if (mat.realistic.normal) pbrLeft.normalMap = mat.realistic.normal;
    if (mat.realistic.roughness) pbrLeft.roughnessMap = mat.realistic.roughness;
    if (mat.realistic.metallic) pbrLeft.metalnessMap = mat.realistic.metallic;
    if (mat.realistic.ao) {
        pbrLeft.aoMap = mat.realistic.ao;
        pbrLeft.aoMapIntensity = 1.0;
    }
    pbrLeft.needsUpdate = true;

    // Right side: stylized
    const pbrRight = compareView.right.mesh.material;
    if (mat.stylized.albedo) pbrRight.map = mat.stylized.albedo;
    if (mat.stylized.normal) pbrRight.normalMap = mat.stylized.normal;
    if (mat.stylized.roughness) pbrRight.roughnessMap = mat.stylized.roughness;
    if (mat.stylized.metallic) pbrRight.metalnessMap = mat.stylized.metallic;
    if (mat.stylized.ao) {
        pbrRight.aoMap = mat.stylized.ao;
        pbrRight.aoMapIntensity = 1.0;
    }
    pbrRight.needsUpdate = true;
}

// ===== Window Resize =====
function onWindowResize() {
    // Resize quad view
    Object.keys(materials).forEach(matName => {
        const mat = materials[matName];
        const container = document.getElementById(`canvas-${matName}`);
        if (!mat.camera || !mat.renderer || !container) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        mat.camera.aspect = width / height;
        mat.camera.updateProjectionMatrix();
        mat.renderer.setSize(width, height);
    });

    // Resize single view
    if (singleView.camera && singleView.renderer) {
        const container = document.getElementById('canvas-single');
        if (container) {
            const width = container.clientWidth;
            const height = container.clientHeight;

            singleView.camera.aspect = width / height;
            singleView.camera.updateProjectionMatrix();
            singleView.renderer.setSize(width, height);
        }
    }

    // Resize compare view
    ['left', 'right'].forEach(side => {
        const view = compareView[side];
        const containerId = side === 'left' ? 'canvas-compare-left' : 'canvas-compare-right';
        const container = document.getElementById(containerId);

        if (view.camera && view.renderer && container) {
            const width = container.clientWidth;
            const height = container.clientHeight;

            view.camera.aspect = width / height;
            view.camera.updateProjectionMatrix();
            view.renderer.setSize(width, height);
        }
    });
}

// ===== Animation Loop =====
function animate() {
    requestAnimationFrame(animate);

    // Render quad view
    if (state.currentViewMode === 'quad') {
        Object.keys(materials).forEach(matName => {
            const mat = materials[matName];
            if (mat.scene && mat.camera && mat.renderer && mat.controls) {
                mat.controls.update();
                mat.renderer.render(mat.scene, mat.camera);
            }
        });
    }

    // Render single view
    if (state.currentViewMode === 'single') {
        if (singleView.scene && singleView.camera && singleView.renderer && singleView.controls) {
            singleView.controls.update();
            singleView.renderer.render(singleView.scene, singleView.camera);
        }
    }

    // Render compare view
    if (state.currentViewMode === 'compare') {
        ['left', 'right'].forEach(side => {
            const view = compareView[side];
            if (view.scene && view.camera && view.renderer && view.controls) {
                view.controls.update();
                view.renderer.render(view.scene, view.camera);
            }
        });
    }
}

// ===== Start Application =====
init();
