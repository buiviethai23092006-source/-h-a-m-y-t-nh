/**
 * Player.js — Nhân vật chính (snowboarder)
 * 
 * Chứa StateMachine, visual model, và tất cả player properties.
 * Model: Simple geometric snowboarder (capsule body + board).
 */

class Player {
    constructor(scene, terrainManager) {
        this.scene = scene;
        this.terrainManager = terrainManager;

        // === Kinematic properties ===
        this.position = { x: 10, y: 10 };
        this.velocity = { x: Physics.MIN_SPEED, y: 0 };
        this.rotation = 0;
        this.targetRotation = 0;

        // === State flags ===
        this.isGrounded = false;
        this.isFlipping = false;
        this.isGrinding = false;
        this.isBoosting = false;
        this.isCrashed = false;
        this.flipAngle = 0;

        // === Score ===
        this.score = 0;
        this.distance = 0;
        this.comboMultiplier = 1;
        this.pendingPerfectLanding = false;

        // === Grind line reference ===
        this.currentGrindLine = null;

        // === Trick text ===
        this.trickText = '';
        this.trickTextTimer = 0;

        // === Callbacks ===
        this.onGameOver = null;
        this.onRestart = null;

        // === Visual ===
        this.group = new THREE.Group();
        this._createModel();
        this.scene.add(this.group);

        // === Trail effect ===
        this.trailPositions = [];
        this.trailMesh = null;
        this._createTrail();

        // === FSM Setup ===
        this.fsm = new StateMachine(this);
        this.fsm.register('grounded', new GroundedState());
        this.fsm.register('airborne', new AirborneState());
        this.fsm.register('flipping', new FlippingState());
        this.fsm.register('grinding', new GrindingState());
        this.fsm.register('boosting', new BoostingState());
        this.fsm.register('crashed', new CrashedState());

        // Start in grounded state
        this.fsm.changeState('grounded');
    }

    /**
     * Create simple geometric snowboarder model
     */
    _createModel() {
        // === SNOWBOARD ===
        const boardGeo = new THREE.BoxGeometry(2.2, 0.15, 0.6);
        const boardMat = new THREE.MeshStandardMaterial({
            color: 0x2a1f5e,
            roughness: 0.3,
            metalness: 0.7,
        });
        this.board = new THREE.Mesh(boardGeo, boardMat);
        this.board.castShadow = true;
        this.group.add(this.board);

        // === BODY (capsule-like) ===
        const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xe74c3c,
            roughness: 0.6,
            metalness: 0.1,
        });
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.set(0, 0.85, 0);
        this.body.castShadow = true;
        this.group.add(this.body);

        // === HEAD ===
        const headGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const headMat = new THREE.MeshStandardMaterial({
            color: 0xfdbf60,
            roughness: 0.5,
        });
        this.head = new THREE.Mesh(headGeo, headMat);
        this.head.position.set(0, 1.55, 0);
        this.head.castShadow = true;
        this.group.add(this.head);

        // === SCARF (trailing detail) ===
        const scarfGeo = new THREE.BoxGeometry(0.1, 0.1, 0.8);
        const scarfMat = new THREE.MeshStandardMaterial({
            color: 0x3498db,
            roughness: 0.8,
        });
        this.scarf = new THREE.Mesh(scarfGeo, scarfMat);
        this.scarf.position.set(-0.3, 1.35, 0);
        this.group.add(this.scarf);
    }

    /**
     * Create snow trail effect behind the board
     */
    _createTrail() {
        const maxTrailPoints = 60;
        const trailGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(maxTrailPoints * 3 * 2); // 2 vertices per point (width)
        const colors = new Float32Array(maxTrailPoints * 3 * 2);

        trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        trailGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const indices = [];
        for (let i = 0; i < maxTrailPoints - 1; i++) {
            const a = i * 2;
            const b = i * 2 + 1;
            const c = (i + 1) * 2;
            const d = (i + 1) * 2 + 1;
            indices.push(a, c, b);
            indices.push(b, c, d);
        }
        trailGeo.setIndex(indices);

        const trailMat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
        });

        this.trailMesh = new THREE.Mesh(trailGeo, trailMat);
        this.scene.add(this.trailMesh);
        this.maxTrailPoints = maxTrailPoints;
    }

    /**
     * Update trail
     */
    _updateTrail() {
        if (this.isGrounded || this.isBoosting) {
            this.trailPositions.unshift({
                x: this.position.x,
                y: this.position.y + 0.05,
                z: 0
            });
        }

        // Trim
        while (this.trailPositions.length > this.maxTrailPoints) {
            this.trailPositions.pop();
        }

        const posAttr = this.trailMesh.geometry.getAttribute('position');
        const colAttr = this.trailMesh.geometry.getAttribute('color');
        const trailWidth = 0.3;

        for (let i = 0; i < this.maxTrailPoints; i++) {
            if (i < this.trailPositions.length) {
                const p = this.trailPositions[i];
                const idx = i * 2 * 3;

                posAttr.array[idx] = p.x;
                posAttr.array[idx + 1] = p.y;
                posAttr.array[idx + 2] = p.z + trailWidth;

                posAttr.array[idx + 3] = p.x;
                posAttr.array[idx + 4] = p.y;
                posAttr.array[idx + 5] = p.z - trailWidth;

                // Fade alpha via color brightness
                const fade = 1 - (i / this.trailPositions.length);
                colAttr.array[idx] = 0.85 * fade;
                colAttr.array[idx + 1] = 0.9 * fade;
                colAttr.array[idx + 2] = 1.0 * fade;

                colAttr.array[idx + 3] = 0.85 * fade;
                colAttr.array[idx + 4] = 0.9 * fade;
                colAttr.array[idx + 5] = 1.0 * fade;
            } else {
                const idx = i * 2 * 3;
                for (let j = 0; j < 6; j++) {
                    posAttr.array[idx + j] = 0;
                    colAttr.array[idx + j] = 0;
                }
            }
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
    }

    /**
     * Show trick text (temporary)
     */
    showTrickText(text) {
        this.trickText = text;
        this.trickTextTimer = 1.5;
    }

    /**
     * Main update — delegate to FSM
     */
    update(dt, input) {
        // Update FSM
        this.fsm.update(dt, input);

        // Update visual position
        this.group.position.set(this.position.x, this.position.y, 0);
        this.group.rotation.z = this.rotation;

        // Scarf animation (wind effect)
        this.scarf.rotation.z = Math.sin(Date.now() * 0.01) * 0.3;
        this.scarf.position.x = -0.3 - Math.abs(this.velocity.x) * 0.01;

        // Body lean based on velocity
        const leanAngle = MathUtils.clamp(this.velocity.x * 0.005, -0.15, 0.15);
        this.body.rotation.z = leanAngle;

        // Update trail
        this._updateTrail();

        // Trick text timer
        if (this.trickTextTimer > 0) {
            this.trickTextTimer -= dt;
            if (this.trickTextTimer <= 0) {
                this.trickText = '';
            }
        }

        // Distance score
        this.distance = Math.max(this.distance, this.position.x);
    }

    /**
     * Reset player for new game
     */
    reset() {
        this.position = { x: 10, y: 10 };
        this.velocity = { x: Physics.MIN_SPEED, y: 0 };
        this.rotation = 0;
        this.targetRotation = 0;
        this.score = 0;
        this.distance = 0;
        this.comboMultiplier = 1;
        this.pendingPerfectLanding = false;
        this.trickText = '';
        this.trickTextTimer = 0;
        this.isGrounded = false;
        this.isFlipping = false;
        this.isGrinding = false;
        this.isBoosting = false;
        this.isCrashed = false;
        this.trailPositions = [];
        this.fsm.changeState('grounded');
    }
}
