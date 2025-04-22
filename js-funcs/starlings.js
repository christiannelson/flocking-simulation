/**
 * Starlings flocking simulation (GPU-based, Three.js).
 *
 * @class Starlings
 * @param {string|HTMLElement} selector - CSS selector or container element.
 * @param {Object} options - Configuration options.
 * @param {number} [options.resolution=32] - Compute texture resolution.
 * @param {number} [options.birds=null] - Override total bird count.
 * @param {number} [options.separation=20.0] - Separation distance.
 * @param {number} [options.alignment=30.0] - Alignment distance.
 * @param {number} [options.cohesion=20.0] - Cohesion distance.
 * @param {number} [options.freedom=0.3] - Randomness factor.
 * @param {number} [options.bounds=500] - Simulation bounds.
 * @param {string} [options.backgroundColor='#ffffff'] - Background/fog color.
 * @param {string} [options.birdColor='#ff2200'] - Bird color.
 */

import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {GPUComputationRenderer} from 'three/examples/jsm/misc/GPUComputationRenderer.js';


// Import BirdGeometry as a reusable module for bird mesh construction
import BirdGeometry from './BirdGeometry.js';

import BOID_POSITION_FRAG from '../shaders/boidPositionFrag.glsl';
import BOID_GEOMETRY_FRAG from '../shaders/boidGeometryFrag.glsl';
import BOID_VELOCITY_FRAG from '../shaders/boidVelocityFrag.glsl';
import BOID_VERTEX from '../shaders/boidVertex.glsl';

/**
 * Main Starlings simulation class that handles the flocking behavior and rendering.
 */
class Starlings {
    /**
     * Create a new Starlings simulation instance.
     * @param {string|HTMLElement} selector - DOM selector or element for container.
     * @param {Object} options - Simulation configuration options.
     */
    constructor(selector, options = {}) {
        this.selector = selector;

        // Merge user options with defaults
        this.options = Object.assign({
            // Grid resolution (birds per side)
            resolution: 32,
            birds: null, // If set, overrides resolution
            // Flocking behavior
            separation: 20.0,
            alignment: 30.0,
            cohesion: 20.0,
            freedom: 0.3,
            // Simulation environment
            bounds: 500,
            // Visual appearance
            backgroundColor: '#fff',
            birdColor: '#ccc'
        }, options);

        // Get container element
        this.container = typeof selector === 'string'
            ? document.querySelector(selector)
            : selector;
        if (!this.container) throw new Error(`Container not found: ${selector}`);
        
        // Initialize animation frame ID
        this._rafId = null;
    }

    /**
     * Start the simulation (async to allow for shader loading).
     */
    async start() {
        try {
            const shaders = await this.loadAllShaders();
            this.runSimulation(shaders);
        } catch (err) {
            console.error('Error starting simulation:', err);
        }
    }

    /**
     * Initialize and run the simulation with resolved shaders.
     * @param {Object} shaders - Loaded shader sources
     */
    runSimulation(shaders) {
        // Calculate bird count and grid resolution
        let resolution = this.options.resolution;
        let birdsCount;
        if (Number.isInteger(this.options.birds) && this.options.birds > 0) {
            birdsCount = this.options.birds;
            // Ensure grid is large enough for requested bird count
            resolution = Math.ceil(Math.sqrt(birdsCount));
            this.options.resolution = resolution;
        } else {
            birdsCount = resolution * resolution;
        }
        this.birdsCount = birdsCount;

        // Log startup information
        console.log(`Starlings simulation starting with ${birdsCount} birds`);
        console.log(`Using Three.js version ${THREE.REVISION}`);

        this.shaders = shaders;

        // Get container size (fallback to window if needed)
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;
        this.halfX = width / 2;
        this.halfY = height / 2;
        this.lastTime = performance.now();
        this.mouseX = 0;
        this.mouseY = 0;

        // Initialize Three.js scene, GPGPU renderer, birds, and start animation loop
        this.initScene();
        this.initComputeRenderer();
        this.initBirds();

        console.log('Simulation initialized successfully, starting animation loop');
        this.animate();
    }

    /**
     * Initialize the Three.js scene, camera, renderer, and lighting.
     * Sets up the container, camera perspective, scene background, and event listeners.
     */
    initScene() {
        const wrapper = document.createElement('div');
        this.container.appendChild(wrapper);
        this.wrapper = wrapper;

        const rect = this.container.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, width / height, 1, 3000);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.options.backgroundColor);
        this.scene.fog = new THREE.Fog(this.options.backgroundColor, 100, 1000);

        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setClearColor(this.options.backgroundColor);
        this.renderer.setSize(width, height);
        wrapper.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.addEventListener('change', this.render.bind(this));

        this.camera.position.set(600, 600, 600);
        this.camera.lookAt(this.scene.position);

        this.spotLight = new THREE.SpotLight(0xffffff);
        this.spotLight.castShadow = true;
        this.spotLight.intensity = 2.5;
        this.spotLight.distance = 373;
        this.spotLight.angle = 1.6;
        this.spotLight.exponent = 38;
        this.spotLight.shadow.camera.near = 34;
        this.spotLight.shadow.camera.far = 2635;
        this.spotLight.shadow.camera.fov = 68;
        this.spotLight.shadow.bias = 0.00;
        this.scene.add(this.spotLight);

        this.wrapper.addEventListener('mousemove', this.onDocumentMouseMove.bind(this), false);
        this.wrapper.addEventListener('touchstart', this.onDocumentTouchStart.bind(this), false);
        this.wrapper.addEventListener('touchmove', this.onDocumentTouchMove.bind(this), false);
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
    }

    /**
     * Initialize the GPU computation renderer for flocking simulation.
     * Creates and configures textures for position and velocity calculations.
     */
    initComputeRenderer() {
        const resolution = this.options.resolution;
        const bounds = this.options.bounds;
        this.gpuAllocation = new GPUComputationRenderer(resolution, resolution, this.renderer);

        const dtPosition = this.gpuAllocation.createTexture();
        const dtVelocity = this.gpuAllocation.createTexture();
        // fill initial state
        this.fillPositionTexture(dtPosition);
        this.fillVelocityTexture(dtVelocity);

        this.velocityVariable = this.gpuAllocation.addVariable('VelocityTexture', this.shaders.boidVelocityFrag, dtVelocity);
        this.positionVariable = this.gpuAllocation.addVariable('PositionTexture', this.shaders.boidPositionFrag, dtPosition);

        this.gpuAllocation.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);
        this.gpuAllocation.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable]);

        this.uniformPosition = this.positionVariable.material.uniforms;
        this.uniformVelocity = this.velocityVariable.material.uniforms;

        this.uniformPosition.clock = {value: 0.0};
        this.uniformPosition.del_change = {value: 0.0};
        this.uniformVelocity.clock = {value: 1.0};
        this.uniformVelocity.del_change = {value: 0.0};
        this.uniformVelocity.separation_distance = {value: this.options.separation};
        this.uniformVelocity.alignment_distance = {value: this.options.alignment};
        this.uniformVelocity.cohesion_distance = {value: this.options.cohesion};
        this.uniformVelocity.freedom_distance = {value: this.options.freedom};
        this.uniformVelocity.predator = {value: new THREE.Vector3()};
        this.velocityVariable.material.defines.bounds = bounds.toFixed(2);

        this.velocityVariable.wrapS = THREE.RepeatWrapping;
        this.velocityVariable.wrapT = THREE.RepeatWrapping;
        this.positionVariable.wrapS = THREE.RepeatWrapping;
        this.positionVariable.wrapT = THREE.RepeatWrapping;

        const error = this.gpuAllocation.init();
        if (error !== null) {
            console.error('GPUComputationRenderer initialization error:', error);
            throw new Error('GPU computation initialization failed: ' + error);
        }
    }

    /**
     * Initialize the bird mesh geometry and material.
     * Creates the shader-based bird visualization with proper uniforms.
     */
    initBirds() {
        // Pass birdsCount and options to BirdGeometry for encapsulation
        const geometry = new BirdGeometry(this.birdsCount, this.options);
        this.uniformBird = {
            color: {value: new THREE.Color(this.options.birdColor)},
            PositionTexture: {value: null},
            VelocityTexture: {value: null},
            clock: {value: 1.0},
            del_change: {value: 0.0}
        };
        const material = new THREE.ShaderMaterial({
            uniforms: this.uniformBird,
            vertexShader: this.shaders.boidVertex,
            fragmentShader: this.shaders.boidGeometryFrag,
            side: THREE.DoubleSide
        });
        this.birdMesh = new THREE.Mesh(geometry, material);
        this.birdMesh.rotation.y = Math.PI / 2;
        this.birdMesh.matrixAutoUpdate = false;
        this.birdMesh.updateMatrix();
        this.scene.add(this.birdMesh);
    }

    /**
     * Animation loop: schedules next frame and renders the scene.
     */
    animate() {
        this._rafId = requestAnimationFrame(this.animate.bind(this));
        this.render();
    }

    /**
     * Load all GLSL shaders (inlined by bundler).
     * @returns {Promise<Object>} Shader sources
     */
    async loadAllShaders() {
        return {
            boidPositionFrag: BOID_POSITION_FRAG,
            boidVelocityFrag: BOID_VELOCITY_FRAG,
            boidGeometryFrag: BOID_GEOMETRY_FRAG,
            boidVertex: BOID_VERTEX
        };
    }

    /**
     * Render a single frame: update GPGPU, uniforms, and draw the scene.
     */
    render() {
        // Calculate time delta (in seconds)
        const now = performance.now();
        let delta = (now - this.lastTime) / 1000;
        if (delta > 1) delta = 1; // Clamp delta to avoid large jumps
        this.lastTime = now;

        // Update simulation time uniforms
        this.uniformVelocity.clock.value = now;
        this.uniformVelocity.del_change.value = delta;
        this.uniformBird.clock.value = now;
        this.uniformBird.del_change.value = delta;
        this.uniformPosition.clock.value = now;
        this.uniformPosition.del_change.value = delta;

        // Only update predator position if mouse/touch is active (within bounds)
        if (Math.abs(this.mouseX) < this.halfX * 10 && Math.abs(this.mouseY) < this.halfY * 10) {
            // Update predator (mouse/touch) position for flocking influence
            this.uniformVelocity.predator.value.set(
                0.5 * this.mouseX / this.halfX,
                -0.5 * this.mouseY / this.halfY,
                0
            );
            
            // Reset mouse/touch position so predator only affects for a single frame
            this.mouseX = 10000;
            this.mouseY = 10000;
        }

        // Run GPGPU computation for simulation step
        this.gpuAllocation.compute();

        // Update bird shader textures with new positions/velocities
        this.uniformBird.PositionTexture.value = this.gpuAllocation.getCurrentRenderTarget(this.positionVariable).texture;
        this.uniformBird.VelocityTexture.value = this.gpuAllocation.getCurrentRenderTarget(this.velocityVariable).texture;

        // Render the Three.js scene
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Handle mouse movement events to update predator position.
     * @param {MouseEvent} event - The mouse movement event.
     */
    onDocumentMouseMove(event) {
        this.mouseX = event.clientX - this.halfX;
        this.mouseY = event.clientY - this.halfY;
    }

    /**
     * Handle touch start events for mobile devices.
     * @param {TouchEvent} event - The touch event.
     */
    onDocumentTouchStart(event) {
        if (event.touches.length === 1) {
            event.preventDefault();
            this.mouseX = event.touches[0].pageX - this.halfX;
            this.mouseY = event.touches[0].pageY - this.halfY;
        }
    }

    /**
     * Handle touch movement events for mobile devices.
     * @param {TouchEvent} event - The touch event.
     */
    onDocumentTouchMove(event) {
        if (event.touches.length === 1) {
            event.preventDefault();
            this.mouseX = event.touches[0].pageX - this.halfX;
            this.mouseY = event.touches[0].pageY - this.halfY;
        }
    }

    /**
     * Handle window resize events to update camera and renderer dimensions.
     */
    onWindowResize() {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.halfX = width / 2;
        this.halfY = height / 2;
    }

    /**
     * Fill the position texture with initial random positions for the birds.
     * @param {THREE.DataTexture} texture - The texture to fill with position data.
     */
    fillPositionTexture(texture) {
        const data = texture.image.data;
        for (let i = 0; i < data.length; i += 4) {
            const x = Math.random() * 100;
            const y = Math.random() * 100;
            const z = Math.random() * 100;
            data[i] = x;
            data[i + 1] = y;
            data[i + 2] = z;
            data[i + 3] = 1;
        }
    }

    /**
     * Fill the velocity texture with initial random velocities for the birds.
     * @param {THREE.DataTexture} texture - The texture to fill with velocity data.
     */
    fillVelocityTexture(texture) {
        const data = texture.image.data;
        for (let i = 0; i < data.length; i += 4) {
            const x = (Math.random() - 0.5) * 10;
            const y = (Math.random() - 0.5) * 10;
            const z = (Math.random() - 0.5) * 10;
            data[i] = x;
            data[i + 1] = y;
            data[i + 2] = z;
            data[i + 3] = 1;
        }
    }

    /**
     * Stop the animation loop and clean up resources.
     */
    stop() {
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        
        // Remove event listeners
        if (this.wrapper) {
            this.wrapper.removeEventListener('mousemove', this.onDocumentMouseMove.bind(this));
            this.wrapper.removeEventListener('touchstart', this.onDocumentTouchStart.bind(this));
            this.wrapper.removeEventListener('touchmove', this.onDocumentTouchMove.bind(this));
        }
        window.removeEventListener('resize', this.onWindowResize.bind(this));
        
        // Dispose Three.js resources
        if (this.birdMesh) {
            this.scene.remove(this.birdMesh);
            this.birdMesh.geometry.dispose();
            this.birdMesh.material.dispose();
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// Global error handler: logs uncaught errors with details
window.onerror = function (message, source, lineno, colno, error) {
    console.error('[window.onerror]', {message, source, lineno, colno, error: error && error.stack});
};

// Global promise rejection handler: logs unhandled promise rejections
window.addEventListener('unhandledrejection', function (event) {
    console.error('[window.unhandledrejection]', event.reason && event.reason.stack ? event.reason.stack : event.reason);
});

// Expose Starlings globally for browser usage
window.Starlings = Starlings;
