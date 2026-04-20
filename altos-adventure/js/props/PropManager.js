/**
 * PropManager.js — Instanced rendering cho cây thông, tảng đá, cờ
 * 
 * Sử dụng THREE.InstancedMesh để vẽ hàng trăm props chỉ với 1 Draw Call/loại.
 * Props được spawn trên bề mặt terrain và recycle cùng terrain chunks.
 */

class PropManager {
    constructor(scene, terrainManager) {
        this.scene = scene;
        this.terrainManager = terrainManager;

        // InstancedMesh pools
        this.treeInstances = null;
        this.rockInstances = null;
        this.flagInstances = null;

        // Instance counts
        this.maxTrees = 250;
        this.maxRocks = 120;
        this.maxFlags = 40;

        // Active instance tracking
        this.activeTreeCount = 0;
        this.activeRockCount = 0;
        this.activeFlagCount = 0;

        // Temporary matrix for instance transforms
        this._matrix = new THREE.Matrix4();
        this._position = new THREE.Vector3();
        this._quaternion = new THREE.Quaternion();
        this._scale = new THREE.Vector3();

        // Grind lines for GrindingState
        this.grindLines = [];

        this._createInstances();
    }

    /**
     * Create InstancedMesh pools (1 draw call per prop type!)
     */
    _createInstances() {
        // === TREES (Pine trees) ===
        // Combine cone + cylinder into merged geometry
        const treeGroup = new THREE.Group();

        const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4e37 });

        const leafGeo1 = new THREE.ConeGeometry(1.0, 2.0, 6);
        const leafGeo2 = new THREE.ConeGeometry(0.75, 1.5, 6);
        const leafGeo3 = new THREE.ConeGeometry(0.5, 1.2, 6);

        // Merge into single geometry for instancing
        // Use a single cone for simplicity (looks great at distance)
        const treeGeo = new THREE.ConeGeometry(1.2, 3.5, 7);
        const treeMat = new THREE.MeshStandardMaterial({
            color: 0x1a5c2a,
            roughness: 0.9,
            metalness: 0,
        });
        this.treeInstances = new THREE.InstancedMesh(treeGeo, treeMat, this.maxTrees);
        this.treeInstances.castShadow = true;
        this.treeInstances.receiveShadow = true;
        this.treeInstances.count = 0;
        this.scene.add(this.treeInstances);

        // === ROCKS ===
        const rockGeo = new THREE.DodecahedronGeometry(0.8, 0);
        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x7a7a8a,
            roughness: 0.95,
            metalness: 0.05,
            flatShading: true,
        });
        this.rockInstances = new THREE.InstancedMesh(rockGeo, rockMat, this.maxRocks);
        this.rockInstances.castShadow = true;
        this.rockInstances.receiveShadow = true;
        this.rockInstances.count = 0;
        this.scene.add(this.rockInstances);

        // === FLAG POLES ===
        const flagGeo = new THREE.CylinderGeometry(0.05, 0.05, 4, 4);
        const flagMat = new THREE.MeshStandardMaterial({
            color: 0xcc3333,
            roughness: 0.6,
        });
        this.flagInstances = new THREE.InstancedMesh(flagGeo, flagMat, this.maxFlags);
        this.flagInstances.castShadow = true;
        this.flagInstances.count = 0;
        this.scene.add(this.flagInstances);
    }

    /**
     * Populate props on terrain chunks
     * Called when terrain updates
     */
    populateChunks(playerX) {
        this.activeTreeCount = 0;
        this.activeRockCount = 0;
        this.activeFlagCount = 0;
        this.grindLines = [];

        const chunks = this.terrainManager.getActiveChunks();
        const seededRandom = this._seededRandom;

        for (const chunk of chunks) {
            const startX = chunk.xOffset;
            const endX = chunk.getEndX();
            const chunkSeed = Math.floor(chunk.noiseOffset * 1000);

            // === SPAWN TREES ===
            // Density: ~1 tree every 4-8 units
            let treeSeed = chunkSeed;
            for (let x = startX + 2; x < endX - 2; x += 3) {
                treeSeed = this._hash(treeSeed);
                const prob = (treeSeed % 1000) / 1000;
                if (prob > 0.45) continue; // 45% chance

                const offsetX = ((treeSeed >> 4) % 100) / 100 * 2 - 1;
                const wx = x + offsetX;
                const wy = chunk.getHeightAt(wx);
                if (wy === null) continue;

                treeSeed = this._hash(treeSeed + 1);
                const offsetZ = ((treeSeed % 200) / 100 - 1) * 15; // Spread along Z
                const treeScale = 0.6 + (treeSeed % 100) / 100 * 0.8;

                if (this.activeTreeCount < this.maxTrees) {
                    this._matrix.compose(
                        this._position.set(wx, wy + treeScale * 1.5, offsetZ),
                        this._quaternion.setFromEuler(new THREE.Euler(0, treeSeed % 6, 0)),
                        this._scale.set(treeScale, treeScale, treeScale)
                    );
                    this.treeInstances.setMatrixAt(this.activeTreeCount, this._matrix);
                    this.activeTreeCount++;
                }
            }

            // === SPAWN ROCKS ===
            let rockSeed = chunkSeed + 9999;
            for (let x = startX + 5; x < endX - 5; x += 6) {
                rockSeed = this._hash(rockSeed);
                const prob = (rockSeed % 1000) / 1000;
                if (prob > 0.3) continue; // 30% chance

                const wx = x + ((rockSeed >> 3) % 100) / 100;
                const wy = chunk.getHeightAt(wx);
                if (wy === null) continue;

                rockSeed = this._hash(rockSeed + 1);
                const offsetZ = ((rockSeed % 100) / 50 - 1) * 3; // Near center (obstacle)
                const rockScale = 0.4 + (rockSeed % 100) / 100 * 0.6;

                if (this.activeRockCount < this.maxRocks) {
                    this._matrix.compose(
                        this._position.set(wx, wy + rockScale * 0.3, offsetZ),
                        this._quaternion.setFromEuler(new THREE.Euler(
                            rockSeed % 3 * 0.5, rockSeed % 5 * 0.7, rockSeed % 4 * 0.3
                        )),
                        this._scale.set(rockScale, rockScale * 0.7, rockScale)
                    );
                    this.rockInstances.setMatrixAt(this.activeRockCount, this._matrix);
                    this.activeRockCount++;
                }
            }

            // === SPAWN FLAG LINES (grind rails) ===
            let flagSeed = chunkSeed + 77777;
            for (let x = startX + 15; x < endX - 20; x += 30) {
                flagSeed = this._hash(flagSeed);
                const prob = (flagSeed % 1000) / 1000;
                if (prob > 0.25) continue; // 25% chance

                const startFX = x;
                const endFX = x + 12 + (flagSeed % 10);
                const startFY = chunk.getHeightAt(startFX);
                const endFY = chunk.getHeightAt(endFX);
                if (startFY === null || endFY === null) continue;

                const poleHeight = 4;

                // Place two flag poles
                if (this.activeFlagCount + 1 < this.maxFlags) {
                    // Start pole
                    this._matrix.compose(
                        this._position.set(startFX, startFY + poleHeight / 2, 0),
                        this._quaternion.identity(),
                        this._scale.set(1, 1, 1)
                    );
                    this.flagInstances.setMatrixAt(this.activeFlagCount, this._matrix);
                    this.activeFlagCount++;

                    // End pole
                    this._matrix.compose(
                        this._position.set(endFX, endFY + poleHeight / 2, 0),
                        this._quaternion.identity(),
                        this._scale.set(1, 1, 1)
                    );
                    this.flagInstances.setMatrixAt(this.activeFlagCount, this._matrix);
                    this.activeFlagCount++;

                    // Register grind line
                    this.grindLines.push({
                        startX: startFX,
                        endX: endFX,
                        startY: startFY + poleHeight,
                        endY: endFY + poleHeight,
                    });
                }
            }
        }

        // Update instance counts
        this.treeInstances.count = this.activeTreeCount;
        this.treeInstances.instanceMatrix.needsUpdate = true;

        this.rockInstances.count = this.activeRockCount;
        this.rockInstances.instanceMatrix.needsUpdate = true;

        this.flagInstances.count = this.activeFlagCount;
        this.flagInstances.instanceMatrix.needsUpdate = true;
    }

    /**
     * Check if player is near a grind line
     */
    checkGrindCollision(playerX, playerY) {
        for (const line of this.grindLines) {
            if (playerX >= line.startX && playerX <= line.endX) {
                const t = (playerX - line.startX) / (line.endX - line.startX);
                const lineY = MathUtils.lerp(line.startY, line.endY, t);
                const dist = Math.abs(playerY - lineY);
                if (dist < Physics.GRIND_DETECT_RADIUS) {
                    return line;
                }
            }
        }
        return null;
    }

    /**
     * Simple hash function for deterministic prop placement
     */
    _hash(seed) {
        seed = ((seed >> 16) ^ seed) * 0x45d9f3b;
        seed = ((seed >> 16) ^ seed) * 0x45d9f3b;
        seed = (seed >> 16) ^ seed;
        return Math.abs(seed);
    }

    update(playerX) {
        this.populateChunks(playerX);
    }

    dispose() {
        this.treeInstances.dispose();
        this.rockInstances.dispose();
        this.flagInstances.dispose();
    }
}
