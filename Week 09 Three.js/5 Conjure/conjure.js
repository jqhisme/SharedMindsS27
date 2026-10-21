import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// --- Global 3D Variables ---
let scene, camera3D, renderer;
let skyMesh, skyMaterial;
const conjuredObjects = [];
const activePlaceholders = [];

// --- Mouse / Camera Controls (Based on Week 09 > 1AwakeLookAround manualControls.js) ---
let mouseDownX = 0, mouseDownY = 0;
let lon = -90, mouseDownLon = 0;
let lat = 0, mouseDownLat = 0;
let isUserInteracting = false;

// --- Voice Recording Variables ---
let mediaStream = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let speechRecognizer = null;

// --- Replicate Proxy Configuration ---
const REPLICATE_PROXY_URL = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
const AUTH_TOKEN = ""; // Optional token if using custom replicate proxy account

// --- DOM Elements ---
let canvasContainer;
let statusText, statusSpinner;
let panoInput, panoModelSelect, btnGenPano;
let modelInput, modelSelect, btnConjure, btnVoice, btnClearModels;
let micIcon, micLabel;

// ==========================================
// Initialization
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    initDOM();
    init3D();
    initControls();
    initVoice();
    animate();
});

function initDOM() {
    canvasContainer = document.getElementById('canvas-container');
    statusText = document.getElementById('status-text');
    statusSpinner = document.getElementById('status-spinner');

    panoInput = document.getElementById('pano-input');
    panoModelSelect = document.getElementById('pano-model-select');
    btnGenPano = document.getElementById('btn-gen-pano');

    modelInput = document.getElementById('model-input');
    modelSelect = document.getElementById('model-select');
    btnConjure = document.getElementById('btn-conjure');
    btnVoice = document.getElementById('btn-voice');
    btnClearModels = document.getElementById('btn-clear-models');
    micIcon = document.getElementById('mic-icon');
    micLabel = document.getElementById('mic-label');

    // Button Click Listeners
    btnGenPano.addEventListener('click', () => {
        const prompt = panoInput.value.trim();
        if (prompt) generatePanorama(prompt, panoModelSelect.value);
    });

    panoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const prompt = panoInput.value.trim();
            if (prompt) generatePanorama(prompt, panoModelSelect.value);
        }
    });

    btnConjure.addEventListener('click', () => {
        const prompt = modelInput.value.trim();
        if (prompt) conjure3D(prompt, modelSelect.value);
    });

    modelInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const prompt = modelInput.value.trim();
            if (prompt) conjure3D(prompt, modelSelect.value);
        }
    });

    btnVoice.addEventListener('click', toggleVoiceRecording);

    btnClearModels.addEventListener('click', clearAllModels);

    // Preset Chips
    document.querySelectorAll('.preset-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const type = chip.getAttribute('data-type');
            const val = chip.getAttribute('data-val');

            if (type === 'pano') {
                panoInput.value = val;
                generatePanorama(val, panoModelSelect.value);
            } else if (type === 'pano-local') {
                loadLocalSkybox(val);
            } else if (type === 'model') {
                modelInput.value = val;
                conjure3D(val, modelSelect.value);
            } else if (type === 'model-local') {
                loadLocal3DModel(val, "Yellow Duck");
            }
        });
    });

    // Spacebar shortcut for Push-to-Talk (only if not focused in an input box)
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && !isRecording) {
            e.preventDefault();
            startVoiceRecording();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && isRecording && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            stopVoiceRecording();
        }
    });
}

// ==========================================
// Three.js Scene Setup (Style of 1AwakeLookAround)
// ==========================================
function init3D() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.001);

    camera3D = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera3D.position.set(0, 0, 0);
    camera3D.target = new THREE.Vector3(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    canvasContainer.appendChild(renderer.domElement);

    // Lighting (ambient + directional + hemisphere for 3D PBR meshes)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight1.position.set(20, 40, 20);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x7dd3fc, 1.2);
    dirLight2.position.set(-20, -10, -20);
    scene.add(dirLight2);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.8);
    scene.add(hemiLight);

    // Background Inverted Sphere for 360 Panorama (exact style of 1AwakeLookAround)
    const bgGeometry = new THREE.SphereGeometry(950, 64, 40);
    bgGeometry.scale(-1, 1, 1); // Invert normals so texture faces inwards

    const textureLoader = new THREE.TextureLoader();
    const defaultPanoTexture = textureLoader.load('itp.jpg', (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.mapping = THREE.EquirectangularReflectionMapping;
        showStatus('Default 360 skybox loaded (itp.jpg). Ready to Conjure!', false);
    }, undefined, () => {
        console.warn('itp.jpg not loaded, showing cosmic fallback.');
    });

    skyMaterial = new THREE.MeshBasicMaterial({ map: defaultPanoTexture });
    skyMesh = new THREE.Mesh(bgGeometry, skyMaterial);
    scene.add(skyMesh);

    // Add initial starter Showcase Crystal so the 3D world is instantly interactive
    createShowcaseCrystal();

    // Initial camera look-around orientation
    computeCameraOrientation();
}

function createShowcaseCrystal() {
    const group = new THREE.Group();
    group.position.set(0, 0, -8); // 8 units directly in front

    const geom = new THREE.OctahedronGeometry(1.6, 0);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x4c1d95,
        roughness: 0.15,
        metalness: 0.85,
        flatShading: true
    });
    const crystal = new THREE.Mesh(geom, mat);
    group.add(crystal);

    // Inner glowing core
    const coreGeom = new THREE.SphereGeometry(0.6, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });
    const core = new THREE.Mesh(coreGeom, coreMat);
    group.add(core);

    // Floating orbit ring
    const ringGeom = new THREE.TorusGeometry(2.3, 0.04, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 3;
    group.add(ring);

    group.userData = {
        name: "Welcome Orb",
        rotSpeedY: 0.012,
        rotSpeedX: 0.006,
        ringSpeed: 0.02,
        baseY: 0,
        ringMesh: ring
    };

    scene.add(group);
    conjuredObjects.push(group);
}

// ==========================================
// Mouse Look-Around Controls (from manualControls.js)
// ==========================================
function initControls() {
    window.addEventListener('resize', onWindowResize, false);

    document.addEventListener('mousedown', onDocumentMouseDown, false);
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('mouseup', onDocumentMouseUp, false);
    document.addEventListener('wheel', onDocumentMouseWheel, { passive: true });

    // Touch support for mobile / tablets
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            onDocumentMouseDown({
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY,
                target: e.target
            });
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isUserInteracting) {
            onDocumentMouseMove({
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY
            });
        }
    }, { passive: true });

    document.addEventListener('touchend', onDocumentMouseUp, false);
}

function onDocumentMouseDown(event) {
    // Prevent camera rotation when clicking inside HUD controls or buttons
    if (event.target.closest('#top-hud') ||
        event.target.closest('#status-hud') ||
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'BUTTON' ||
        event.target.tagName === 'SELECT' ||
        event.target.classList.contains('preset-chip')) {
        return;
    }

    mouseDownX = event.clientX;
    mouseDownY = event.clientY;
    mouseDownLon = lon;
    mouseDownLat = lat;
    isUserInteracting = true;
}

function onDocumentMouseMove(event) {
    if (isUserInteracting) {
        lon = (mouseDownX - event.clientX) * 0.12 + mouseDownLon;
        lat = (event.clientY - mouseDownY) * 0.12 + mouseDownLat;
        computeCameraOrientation();
    }
}

function onDocumentMouseUp() {
    isUserInteracting = false;
}

function onDocumentMouseWheel(event) {
    // Zoom control: adjust FOV between 20° (telephoto) and 95° (wide angle)
    camera3D.fov += event.deltaY * 0.04;
    camera3D.fov = Math.max(20, Math.min(95, camera3D.fov));
    camera3D.updateProjectionMatrix();
}

function computeCameraOrientation() {
    lat = Math.max(-85, Math.min(85, lat)); // Restrict vertical flip
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);

    camera3D.target.x = 100 * Math.sin(phi) * Math.cos(theta);
    camera3D.target.y = 100 * Math.cos(phi);
    camera3D.target.z = 100 * Math.sin(phi) * Math.sin(theta);
    camera3D.lookAt(camera3D.target);
}

function onWindowResize() {
    camera3D.aspect = window.innerWidth / window.innerHeight;
    camera3D.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==========================================
// Panorama Skybox Generation (Replicate API)
// ==========================================
async function generatePanorama(prompt, modelChoice) {
    showStatus(`Synthesizing 360 panorama ("${prompt}")...`, true);

    try {
        let requestPayload;
        if (modelChoice === 'lucataco/sdxl-panoramic') {
            // Community model requires explicit version hash on Replicate API
            requestPayload = {
                version: "360518d422b68a5d089b723cad740fc2dad98cb00d57799bc2c1c3aee444bf5a",
                input: {
                    prompt: prompt
                }
            };
        } else {
            // Default to fast flux-schnell formatted for 360 equirectangular spherical background (~3.5s)
            requestPayload = {
                model: "black-forest-labs/flux-schnell",
                input: {
                    prompt: `${prompt}, 360 degree equirectangular panorama, panoramic photo, seamless 360 spherical view, wide horizon, 8k resolution`,
                    aspect_ratio: "16:9"
                }
            };
        }

        console.log("Requesting Panorama from Replicate Proxy:", requestPayload);
        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...(AUTH_TOKEN ? { "Authorization": `Bearer ${AUTH_TOKEN}` } : {})
            },
            body: JSON.stringify(requestPayload)
        };

        const res = await fetch(REPLICATE_PROXY_URL, options);
        let data = null;
        try {
            data = await res.json();
        } catch (e) {
            // non-json response (e.g. 502/504 gateway timeout HTML)
        }

        if (!res.ok) {
            const errDetail = (data && (data.details || data.error)) || `Proxy status ${res.status}`;
            console.warn("Panorama request failed:", errDetail);

            // If heavy SDXL model timed out or errored on cold boot, fall back to fast Flux Schnell
            if (modelChoice === 'lucataco/sdxl-panoramic') {
                showStatus('SDXL Panoramic cold boot/timeout. Auto-generating with fast Flux Schnell 360...', true);
                if (panoModelSelect) panoModelSelect.value = 'black-forest-labs/flux-schnell';
                return await generatePanorama(prompt, 'black-forest-labs/flux-schnell');
            }
            throw new Error(errDetail);
        }

        console.log("Panorama API Response:", data);

        let imgUrl = extractMediaURL(data);
        if (!imgUrl) throw new Error("No image URL returned from panorama model");

        // Load into Three.js sphere texture using CORS-safe loader
        loadPanoramaTexture(imgUrl, prompt);

    } catch (err) {
        console.error("Error generating panorama:", err);
        showStatus(`Panorama note: ${err.message}. Retaining current skybox.`, false);
    }
}

function loadPanoramaTexture(imgUrl, prompt) {
    showStatus("Applying 360 texture map to skybox sphere...", true);
    const safeUrl = getCorsSafeImageUrl(imgUrl);
    console.log("Loading skybox texture via CORS-safe URL:", safeUrl);

    const loader = new THREE.TextureLoader();
    loader.load(
        safeUrl,
        (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.mapping = THREE.EquirectangularReflectionMapping;

            if (skyMaterial.map) skyMaterial.map.dispose();
            skyMaterial.map = texture;
            skyMaterial.needsUpdate = true;

            showStatus(`✨ Skybox updated: "${prompt}"!`, false);
        },
        undefined,
        (err) => {
            console.warn("CORS-safe proxy texture loading issue, attempting direct URL:", err);
            // Fallback attempt with direct URL
            loader.load(
                imgUrl,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.mapping = THREE.EquirectangularReflectionMapping;

                    if (skyMaterial.map) skyMaterial.map.dispose();
                    skyMaterial.map = texture;
                    skyMaterial.needsUpdate = true;

                    showStatus(`✨ Skybox updated: "${prompt}"!`, false);
                },
                undefined,
                (fallbackErr) => {
                    console.error("Texture mapping failed:", fallbackErr);
                    showStatus("Texture mapping blocked by CORS policy. Retaining current skybox.", false);
                }
            );
        }
    );
}

function getCorsSafeImageUrl(url) {
    if (!url) return url;
    // Local assets (e.g. itp.jpg) do not need proxying
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return url;
    }
    // Remote URLs (Replicate Cloudflare R2 bucket & replicate.delivery) lack Access-Control-Allow-Origin: *
    // Routing through images.weserv.nl provides CORS headers allowing WebGL gl.texImage2D to load it
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=jpg`;
}

function loadLocalSkybox(filename) {
    showStatus(`Loading local skybox (${filename})...`, true);
    const loader = new THREE.TextureLoader();
    loader.load(filename, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        if (skyMaterial.map) skyMaterial.map.dispose();
        skyMaterial.map = texture;
        skyMaterial.needsUpdate = true;
        showStatus(`Loaded ${filename} skybox successfully!`, false);
    }, undefined, (err) => {
        showStatus(`Failed to load ${filename}.`, false);
    });
}

// ==========================================
// 3D Model Conjuring (Replicate API & Three.js Loaders)
// ==========================================
async function conjure3D(prompt, modelChoice) {
    // 1. Calculate spawn point ~9 units directly in front of camera's current look direction
    const forward = new THREE.Vector3();
    camera3D.getWorldDirection(forward);
    const spawnPosition = new THREE.Vector3()
        .copy(camera3D.position)
        .addScaledVector(forward, 9);

    // 2. Handle Instant Procedural Crystal
    if (modelChoice === 'procedural-crystal') {
        createProceduralCrystal(spawnPosition, prompt, null);
        return;
    }

    // 3. Create an enchanting Conjuring Orb placeholder at spawnPosition
    const placeholder = createConjuringOrb(spawnPosition, prompt);
    activePlaceholders.push(placeholder);
    scene.add(placeholder);

    // 4. Handle Fast 3.5s AI Hologram Prism
    if (modelChoice === 'hologram-prism') {
        await createHologramPrism(spawnPosition, prompt, placeholder);
        return;
    }

    // 5. Handle Replicate 3D Mesh (Shap-E)
    showStatus(`Conjuring 3D "${prompt}" with Shap-E...`, true);

    // Abort controller to prevent hanging beyond 50 seconds (before Google Cloud 60s cutoff)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        try {
            controller.abort(new DOMException("Shap-E cold boot took longer than 50s", "TimeoutError"));
        } catch (e) {
            controller.abort();
        }
    }, 50000);

    try {
        const requestPayload = {
            version: "5957069d5c509126a73c7cb68abcddbb985aeefa4d318e7c63ec1352ce6da68c",
            input: {
                prompt: prompt,
                save_mesh: true
            }
        };

        console.log("Conjuring 3D via Replicate Proxy:", requestPayload);
        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...(AUTH_TOKEN ? { "Authorization": `Bearer ${AUTH_TOKEN}` } : {})
            },
            body: JSON.stringify(requestPayload),
            signal: controller.signal
        };

        const res = await fetch(REPLICATE_PROXY_URL, options);
        clearTimeout(timeoutId);

        let data = null;
        try {
            data = await res.json();
        } catch (e) {
            // non-json response
        }

        if (!res.ok) {
            const errDetail = (data && (data.details || data.error)) || `Proxy status ${res.status}`;
            throw new Error(errDetail);
        }

        console.log("3D Conjure Response:", data);

        const meshUrl = extract3DModelURL(data);
        console.log("Found 3D Mesh URL:", meshUrl);

        if (meshUrl) {
            showStatus(`Loading 3D asset into scene...`, true);
            await loadAndPlace3DModel(meshUrl, spawnPosition, prompt, placeholder);
            showStatus(`✨ Successfully conjured "${prompt}"!`, false);
        } else {
            crystallizePlaceholder(placeholder, prompt);
            showStatus(`✨ Conjured magical artifact for "${prompt}"!`, false);
        }

    } catch (err) {
        clearTimeout(timeoutId);
        crystallizePlaceholder(placeholder, prompt);

        const isTimeout = err.name === 'AbortError' || 
                          err.name === 'TimeoutError' || 
                          (err.message && (err.message.includes('Failed to fetch') || err.message.includes('abort') || err.message.includes('Timeout')));

        if (isTimeout) {
            console.log("Shap-E cold boot exceeded 50s limit. Created 3D sculpture.");
            showStatus(`⏱️ Shap-E is booting on Replicate (>50s). Created 3D sculpture for "${prompt}".`, false);
        } else {
            console.warn("Conjure 3D notice:", err);
            showStatus(`✨ Created 3D sculpture for "${prompt}".`, false);
        }
    }
}

function loadLocal3DModel(filename, name) {
    const forward = new THREE.Vector3();
    camera3D.getWorldDirection(forward);
    const spawnPosition = new THREE.Vector3()
        .copy(camera3D.position)
        .addScaledVector(forward, 8);

    showStatus(`Loading 3D model (${filename})...`, true);
    const placeholder = createConjuringOrb(spawnPosition, name);
    activePlaceholders.push(placeholder);
    scene.add(placeholder);

    loadAndPlace3DModel(filename, spawnPosition, name, placeholder)
        .then(() => {
            showStatus(`✨ Successfully conjured "${name}"!`, false);
        })
        .catch((err) => {
            console.error("Local 3D model load error:", err);
            crystallizePlaceholder(placeholder, name);
            showStatus(`Failed to load ${filename}.`, false);
        });
}

async function createHologramPrism(spawnPosition, prompt, placeholder) {
    showStatus(`Generating 3D AI Hologram for "${prompt}" (~3.5s)...`, true);
    try {
        const payload = {
            model: "black-forest-labs/flux-schnell",
            input: {
                prompt: `${prompt}, floating magical artifact, centered, volumetric glow, concept art, dark background`,
                aspect_ratio: "1:1"
            }
        };

        const res = await fetch(REPLICATE_PROXY_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...(AUTH_TOKEN ? { "Authorization": `Bearer ${AUTH_TOKEN}` } : {})
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`Proxy status ${res.status}`);
        const data = await res.json();
        const imgUrl = extractMediaURL(data);
        if (!imgUrl) throw new Error("No image generated for hologram");

        const safeImgUrl = getCorsSafeImageUrl(imgUrl);
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(safeImgUrl, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;

            const group = new THREE.Group();
            group.position.copy(spawnPosition);

            // Double-sided holographic card
            const geom = new THREE.PlaneGeometry(3.6, 3.6);
            const mat = new THREE.MeshStandardMaterial({
                map: texture,
                transparent: true,
                opacity: 0.95,
                roughness: 0.1,
                metalness: 0.2,
                side: THREE.DoubleSide
            });
            const cardFront = new THREE.Mesh(geom, mat);
            group.add(cardFront);

            // Cross-plane card for 3D volume
            const cardCross = new THREE.Mesh(geom, mat);
            cardCross.rotation.y = Math.PI / 2;
            group.add(cardCross);

            // Glowing glass wireframe frame
            const boxGeom = new THREE.BoxGeometry(3.7, 3.7, 0.4);
            const boxMat = new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                wireframe: true,
                emissive: 0x0284c7,
                emissiveIntensity: 0.5
            });
            const box = new THREE.Mesh(boxGeom, boxMat);
            group.add(box);

            // Orbiting magical ring
            const ringGeom = new THREE.TorusGeometry(3.0, 0.03, 16, 64);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
            const ring = new THREE.Mesh(ringGeom, ringMat);
            ring.rotation.x = Math.PI / 4;
            group.add(ring);

            group.userData = {
                name: prompt,
                rotSpeedY: 0.012,
                rotSpeedX: 0.003,
                ringMesh: ring,
                ringSpeed: 0.02,
                baseY: spawnPosition.y
            };

            scene.add(group);
            conjuredObjects.push(group);

            if (placeholder) {
                const pIdx = activePlaceholders.indexOf(placeholder);
                if (pIdx > -1) activePlaceholders.splice(pIdx, 1);
                scene.remove(placeholder);
            }

            showStatus(`✨ Conjured 3D AI Hologram for "${prompt}"!`, false);
        }, undefined, () => {
            crystallizePlaceholder(placeholder, prompt);
            showStatus(`✨ Materialized 3D sculpture for "${prompt}"!`, false);
        });

    } catch (err) {
        console.warn("Hologram error:", err);
        crystallizePlaceholder(placeholder, prompt);
        showStatus(`✨ Materialized 3D sculpture for "${prompt}".`, false);
    }
}

function createProceduralCrystal(spawnPosition, prompt, placeholder) {
    const group = new THREE.Group();
    group.position.copy(spawnPosition);

    const polyTypes = [
        () => new THREE.OctahedronGeometry(2.0, 0),
        () => new THREE.IcosahedronGeometry(1.9, 0),
        () => new THREE.DodecahedronGeometry(1.8, 0)
    ];
    const randGeom = polyTypes[Math.floor(Math.random() * polyTypes.length)]();

    const colors = [0xa855f7, 0x38bdf8, 0xec4899, 0x10b981, 0xf59e0b];
    const pickColor = colors[Math.floor(Math.random() * colors.length)];

    const mat = new THREE.MeshStandardMaterial({
        color: pickColor,
        emissive: pickColor,
        emissiveIntensity: 0.35,
        roughness: 0.15,
        metalness: 0.85,
        flatShading: true
    });
    const crystal = new THREE.Mesh(randGeom, mat);
    group.add(crystal);

    const coreGeom = new THREE.SphereGeometry(0.7, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const core = new THREE.Mesh(coreGeom, coreMat);
    group.add(core);

    const ringGeom = new THREE.TorusGeometry(2.8, 0.035, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: pickColor });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 3;
    group.add(ring);

    group.userData = {
        name: prompt,
        rotSpeedY: 0.015,
        rotSpeedX: 0.007,
        ringMesh: ring,
        ringSpeed: 0.025,
        baseY: spawnPosition.y
    };

    scene.add(group);
    conjuredObjects.push(group);

    if (placeholder) {
        const pIdx = activePlaceholders.indexOf(placeholder);
        if (pIdx > -1) activePlaceholders.splice(pIdx, 1);
        scene.remove(placeholder);
    }

    showStatus(`✨ Conjured 3D Crystal for "${prompt}"!`, false);
}

function createConjuringOrb(position, prompt) {
    const group = new THREE.Group();
    group.position.copy(position);

    // Glowing energy sphere
    const sphereGeom = new THREE.SphereGeometry(0.75, 24, 24);
    const sphereMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.5
    });
    const orb = new THREE.Mesh(sphereGeom, sphereMat);
    group.add(orb);

    // Outer wireframe cage
    const cageGeom = new THREE.IcosahedronGeometry(1.2, 1);
    const cageMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        wireframe: true,
        transparent: true,
        opacity: 0.7
    });
    const cage = new THREE.Mesh(cageGeom, cageMat);
    group.add(cage);

    group.userData = {
        isPlaceholder: true,
        prompt: prompt,
        orb: orb,
        cage: cage,
        pulseTime: 0
    };

    return group;
}

function crystallizePlaceholder(placeholder, prompt) {
    // Remove from active placeholders
    const idx = activePlaceholders.indexOf(placeholder);
    if (idx > -1) activePlaceholders.splice(idx, 1);

    // Transform placeholder into a stylized permanent crystalline 3D sculpture
    const cage = placeholder.userData.cage;
    if (cage) {
        cage.material = new THREE.MeshStandardMaterial({
            color: 0x67e8f9,
            emissive: 0x0e7490,
            roughness: 0.2,
            metalness: 0.8,
            wireframe: false,
            flatShading: true
        });
    }

    placeholder.userData.isPlaceholder = false;
    placeholder.userData.rotSpeedY = 0.015;
    placeholder.userData.rotSpeedX = 0.008;
    placeholder.userData.baseY = placeholder.position.y;
    conjuredObjects.push(placeholder);
}

async function loadAndPlace3DModel(url, spawnPosition, prompt, placeholder) {
    return new Promise((resolve, reject) => {
        const isGLB = url.toLowerCase().includes('.glb') || url.toLowerCase().includes('.gltf');
        const isOBJ = url.toLowerCase().includes('.obj');

        if (isGLB) {
            const loader = new GLTFLoader();
            loader.load(url, (gltf) => {
                const mesh = gltf.scene;
                finalizeLoadedMesh(mesh, spawnPosition, prompt, placeholder);
                resolve(mesh);
            }, undefined, reject);
        } else if (isOBJ) {
            const loader = new OBJLoader();
            loader.load(url, (obj) => {
                // Ensure default material for OBJ
                obj.traverse((child) => {
                    if (child.isMesh && (!child.material || child.material.isMeshBasicMaterial)) {
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0xd8b4fe,
                            roughness: 0.3,
                            metalness: 0.6
                        });
                    }
                });
                finalizeLoadedMesh(obj, spawnPosition, prompt, placeholder);
                resolve(obj);
            }, undefined, reject);
        } else {
            // Attempt GLTF fallback
            const loader = new GLTFLoader();
            loader.load(url, (gltf) => {
                finalizeLoadedMesh(gltf.scene, spawnPosition, prompt, placeholder);
                resolve(gltf.scene);
            }, undefined, () => {
                crystallizePlaceholder(placeholder, prompt);
                resolve(placeholder);
            });
        }
    });
}

function finalizeLoadedMesh(object3D, spawnPosition, prompt, placeholder) {
    // 1. Compute bounding box to normalize scale
    const box = new THREE.Box3().setFromObject(object3D);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetScale = 4.0; // scale to a pleasant 4-unit size in view
    const scaleFactor = targetScale / maxDim;
    object3D.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // 2. Center geometry pivot
    const center = new THREE.Vector3();
    box.getCenter(center);
    object3D.position.sub(center.multiplyScalar(scaleFactor));

    // 3. Wrap in container at spawnPosition
    const container = new THREE.Group();
    container.position.copy(spawnPosition);
    container.add(object3D);

    container.userData = {
        name: prompt,
        rotSpeedY: 0.01,
        rotSpeedX: 0.003,
        baseY: spawnPosition.y
    };

    scene.add(container);
    conjuredObjects.push(container);

    // 4. Remove placeholder orb
    if (placeholder) {
        const pIdx = activePlaceholders.indexOf(placeholder);
        if (pIdx > -1) activePlaceholders.splice(pIdx, 1);
        scene.remove(placeholder);
    }
}

function clearAllModels() {
    conjuredObjects.forEach(obj => scene.remove(obj));
    activePlaceholders.forEach(orb => scene.remove(orb));
    conjuredObjects.length = 0;
    activePlaceholders.length = 0;
    showStatus("Scene cleared. Ready to Conjure new creations!", false);
}

// ==========================================
// Voice Recording & Whisper Transcription
// (Style of ClientExamples > 3 Canvas 2D With Ask Voice Then Words)
// ==========================================
async function initVoice() {
    // Optional Web Speech API recognition for immediate live feedback
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        speechRecognizer = new SpeechRecognition();
        speechRecognizer.continuous = false;
        speechRecognizer.interimResults = false;
        speechRecognizer.lang = 'en-US';

        speechRecognizer.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log("WebSpeech Transcript:", transcript);
            if (transcript && !modelInput.value) {
                modelInput.value = transcript;
            }
        };
    }
}

async function toggleVoiceRecording() {
    if (isRecording) {
        stopVoiceRecording();
    } else {
        startVoiceRecording();
    }
}

async function startVoiceRecording() {
    if (isRecording) return;
    audioChunks = [];

    try {
        if (!mediaStream) {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        mediaRecorder = new MediaRecorder(mediaStream);
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
            console.log("Audio Blob captured:", audioBlob);
            await transcribeAudioWithWhisper(audioBlob);
        };

        mediaRecorder.start();
        isRecording = true;

        if (speechRecognizer) {
            try { speechRecognizer.start(); } catch (e) { /* already started */ }
        }

        btnVoice.classList.add('recording');
        micIcon.textContent = '⏹️';
        micLabel.textContent = 'Stop';
        showStatus('🎙️ Listening... Speak what you want to conjure in 3D!', false);

    } catch (err) {
        console.error("Microphone access error:", err);
        showStatus(`Mic Error: ${err.message}. You can still type in the text box.`, false);
    }
}

function stopVoiceRecording() {
    if (!isRecording) return;
    isRecording = false;

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    if (speechRecognizer) {
        try { speechRecognizer.stop(); } catch (e) { }
    }

    btnVoice.classList.remove('recording');
    micIcon.textContent = '🎙️';
    micLabel.textContent = 'Speak';
    showStatus('Processing speech with Whisper...', true);
}

async function transcribeAudioWithWhisper(audioBlob) {
    try {
        const base64Audio = await convertBlobToBase64(audioBlob);

        const requestPayload = {
            fieldToConvertBase64ToURL: "audio",
            fileFormat: "wav",
            version: "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c",
            input: {
                audio: base64Audio
            }
        };

        console.log("Sending Audio to Whisper via Proxy...");
        const res = await fetch(REPLICATE_PROXY_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...(AUTH_TOKEN ? { "Authorization": `Bearer ${AUTH_TOKEN}` } : {})
            },
            body: JSON.stringify(requestPayload)
        });

        if (!res.ok) throw new Error(`Whisper proxy error: ${res.status}`);
        const data = await res.json();
        console.log("Whisper Response:", data);

        let spokenText = "";
        if (data.output && data.output.text) {
            spokenText = data.output.text.trim();
        } else if (typeof data.output === 'string') {
            spokenText = data.output.trim();
        }

        if (spokenText) {
            // Clean up leading/trailing punctuation
            spokenText = spokenText.replace(/^[.\s]+|[.\s]+$/g, '');
            modelInput.value = spokenText;
            showStatus(`Heard: "${spokenText}". Conjuring 3D model now!`, true);
            conjure3D(spokenText, modelSelect.value);
        } else if (modelInput.value) {
            // Fallback to WebSpeech transcript if present
            conjure3D(modelInput.value, modelSelect.value);
        } else {
            showStatus("No speech detected. Please try again or type directly.", false);
        }

    } catch (err) {
        console.error("Whisper Error:", err);
        if (modelInput.value) {
            showStatus(`Whisper note: ${err.message}. Using speech recognition text.`, true);
            conjure3D(modelInput.value, modelSelect.value);
        } else {
            showStatus(`Audio transcription note: ${err.message}. You can type in the box.`, false);
        }
    }
}

function convertBlobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ==========================================
// Helper Utilities
// ==========================================
function extractMediaURL(data) {
    if (!data) return null;
    if (typeof data === 'string' && data.startsWith('http')) return data;
    if (Array.isArray(data.output) && data.output.length > 0) return data.output[0];
    if (typeof data.output === 'string' && data.output.startsWith('http')) return data.output;
    if (data.image) return data.image;
    return null;
}

function extract3DModelURL(data) {
    if (!data) return null;
    const output = data.output;

    // Check direct array of files
    if (Array.isArray(output)) {
        for (const item of output) {
            if (typeof item === 'string') {
                const lower = item.toLowerCase();
                if (lower.endsWith('.obj') || lower.endsWith('.glb') || lower.endsWith('.gltf') || lower.endsWith('.ply')) {
                    return item;
                }
            }
        }
        // If no file extension matches, pick first valid URL
        if (typeof output[0] === 'string' && output[0].startsWith('http')) {
            return output[0];
        }
    }

    // Check object fields
    if (output && typeof output === 'object') {
        if (output.mesh) return output.mesh;
        if (output.glb) return output.glb;
        if (output.obj) return output.obj;
    }

    if (typeof output === 'string' && output.startsWith('http')) {
        return output;
    }

    return null;
}

function showStatus(msg, isSpinning = false) {
    if (statusText) statusText.textContent = msg;
    if (statusSpinner) statusSpinner.style.display = isSpinning ? 'inline-block' : 'none';
}

// ==========================================
// Main Animation Loop
// ==========================================
function animate(time) {
    requestAnimationFrame(animate);

    const t = (time || 0) * 0.001;

    // Animate all conjured 3D objects (gentle rotation & hovering)
    for (const obj of conjuredObjects) {
        if (obj.userData.rotSpeedY) obj.rotation.y += obj.userData.rotSpeedY;
        if (obj.userData.rotSpeedX) obj.rotation.x += obj.userData.rotSpeedX;
        if (obj.userData.ringMesh) obj.userData.ringMesh.rotation.z += obj.userData.ringSpeed || 0.01;

        // Subtle floating bob
        if (obj.userData.baseY !== undefined) {
            obj.position.y = obj.userData.baseY + Math.sin(t * 1.5) * 0.25;
        }
    }

    // Animate active conjuring placeholders (pulsing & spinning)
    for (const placeholder of activePlaceholders) {
        if (placeholder.userData.cage) {
            placeholder.userData.cage.rotation.x += 0.03;
            placeholder.userData.cage.rotation.y += 0.04;
        }
        if (placeholder.userData.orb) {
            const scale = 1.0 + Math.sin(t * 4.0) * 0.15;
            placeholder.userData.orb.scale.set(scale, scale, scale);
        }
    }

    renderer.render(scene, camera3D);
}
