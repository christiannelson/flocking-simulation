// BirdGeometry: Custom geometry for each bird in the simulation
import * as THREE from 'three';

/**
 * BirdGeometry - BufferGeometry subclass for flocking simulation birds (used for GPGPU rendering).
 * @class
 * @extends THREE.BufferGeometry
 */
class BirdGeometry extends THREE.BufferGeometry {
    /**
     * Create a new BirdGeometry instance.
     * @param {number} [birdsCount=1024] - Number of birds in the simulation.
     * @param {Object} [options={}] - Options object, expects at least { resolution }.
     */
    constructor(birdsCount = 1024, options = {}) {
        super();

        // Number of birds and grid resolution
        const birds = typeof birdsCount !== 'undefined' ? birdsCount : 1024;
        const res = options && options.resolution ? options.resolution : 32;
        const triangles = birds * 3;
        const points = triangles * 3;

        // Buffer attributes for geometry, color, reference (for GPGPU), and vertex type
        const vertices = new THREE.BufferAttribute(new Float32Array(points * 3), 3);
        const birdColors = new THREE.BufferAttribute(new Float32Array(points * 3), 3);
        const references = new THREE.BufferAttribute(new Float32Array(points * 2), 2);
        const birdVertex = new THREE.BufferAttribute(new Float32Array(points), 1);
        this.setAttribute('position', vertices);
        this.setAttribute('birdColor', birdColors);
        this.setAttribute('reference', references);
        this.setAttribute('birdVertex', birdVertex);

        // Helper to append vertices for each triangle
        let v = 0;

        /**
         * Append vertices to the geometry.
         * @param {...number} args - Vertex coordinates to append.
         */
        function vertex_append(...args) {
            args.forEach(a => vertices.array[v++] = a);
        }

        // Define triangles for each bird
        for (let f = 0; f < birds; f++) {
            vertex_append(0, 0, -6, 0, 1, -15, 0, 0, 8);     // Body
            vertex_append(0, 0, -4, -6, 0, 0, 0, 0, 4);      // Left wing
            vertex_append(0, 0, 4, 6, 0, 0, 0, 0, -4);       // Right wing
        }

        // Assign color, reference, and vertex type for GPGPU
        for (let i = 0; i < triangles * 3; i++) {
            const idx = Math.floor(i / 3);
            const x = (idx % res) / res;
            const y = Math.floor(idx / res) / res;
            const c = new THREE.Color(0x000000);
            birdColors.array[i * 3] = c.r;
            birdColors.array[i * 3 + 1] = c.g;
            birdColors.array[i * 3 + 2] = c.b;
            references.array[i * 2] = x;
            references.array[i * 2 + 1] = y;
            birdVertex.array[i] = i % 9;
        }

        // Scale down the geometry for better scene fit
        this.scale(0.35, 0.35, 0.35);
    }
}

export default BirdGeometry;
