/**
 * main.js — Alto's Adventure 2D Canvas Version
 * Pure HTML5 Canvas 2D implementation for peak performance and 2D authenticity.
 */

(function () {
    'use strict';

    // ========================================================
    // MATH & UTILS
    // ========================================================
    const MathUtils = {
        lerp(a, b, t) { return a + (b - a) * t; },
        clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
        catmullRom(p0, p1, p2, p3, t) {
            const t2 = t * t, t3 = t2 * t;
            return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
        },
        catmullRomChain(points, segments) {
            const result = [];
            const n = points.length;
            for (let i = 0; i < n - 1; i++) {
                const p0 = points[Math.max(0, i - 1)];
                const p1 = points[i];
                const p2 = points[Math.min(n - 1, i + 1)];
                const p3 = points[Math.min(n - 1, i + 2)];
                for (let j = 0; j < segments; j++) {
                    result.push(this.catmullRom(p0, p1, p2, p3, j / segments));
                }
            }
            result.push(points[n - 1]);
            return result;
        },
        hash(seed) {
            seed = ((seed >> 16) ^ seed) * 0x45d9f3b;
            seed = ((seed >> 16) ^ seed) * 0x45d9f3b;
            seed = (seed >> 16) ^ seed;
            return Math.abs(seed);
        }
    };

    class SimplexNoise {
        constructor(seed) {
            this.seed = seed || Math.random() * 65536;
            this.grad3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
            this.perm = new Uint8Array(512);
            this.permMod12 = new Uint8Array(512);
            const p = new Uint8Array(256);
            for (let i = 0; i < 256; i++) p[i] = i;
            let s = this.seed;
            for (let i = 255; i > 0; i--) {
                s = (s * 16807 + 0) % 2147483647;
                const j = s % (i + 1);
                [p[i], p[j]] = [p[j], p[i]];
            }
            for (let i = 0; i < 512; i++) {
                this.perm[i] = p[i & 255];
                this.permMod12[i] = this.perm[i] % 12;
            }
            this.F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
            this.G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
        }
        noise2D(xin, yin) {
            const { perm, permMod12, grad3, F2, G2 } = this;
            const s = (xin + yin) * F2;
            const i = Math.floor(xin + s), j = Math.floor(yin + s);
            const t = (i + j) * G2;
            const x0 = xin - (i - t), y0 = yin - (j - t);
            const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
            const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
            const x2 = x0 - 1.0 + 2.0 * G2, y2 = y0 - 1.0 + 2.0 * G2;
            const ii = i & 255, jj = j & 255;
            const gi0 = permMod12[ii + perm[jj]];
            const gi1 = permMod12[ii + i1 + perm[jj + j1]];
            const gi2 = permMod12[ii + 1 + perm[jj + 1]];
            let n0, n1, n2;
            let t0 = 0.5 - x0 * x0 - y0 * y0;
            n0 = t0 < 0 ? 0 : (t0 *= t0, t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0));
            let t1 = 0.5 - x1 * x1 - y1 * y1;
            n1 = t1 < 0 ? 0 : (t1 *= t1, t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1));
            let t2 = 0.5 - x2 * x2 - y2 * y2;
            n2 = t2 < 0 ? 0 : (t2 *= t2, t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2));
            return 70.0 * (n0 + n1 + n2);
        }
        fbm(x, y, octaves = 3, persistence = 0.5, lacunarity = 2.0, scale = 1.0) {
            let total = 0, frequency = scale, amplitude = 1, maxValue = 0;
            for (let i = 0; i < octaves; i++) {
                total += this.noise2D(x * frequency, y * frequency) * amplitude;
                maxValue += amplitude;
                amplitude *= persistence;
                frequency *= lacunarity;
            }
            return total / maxValue;
        }
    }

    // ========================================================
    // OPTIMIZATION PATTERNS
    // ========================================================
    class ObjectPool {
        constructor(createFn, initialSize) {
            this.pool = [];
            this.createFn = createFn;
            for (let i = 0; i < initialSize; i++) {
                const obj = this.createFn();
                obj.active = false;
                this.pool.push(obj);
            }
        }
        get() {
            for (let i = 0; i < this.pool.length; i++) {
                if (!this.pool[i].active) {
                    this.pool[i].active = true;
                    return this.pool[i];
                }
            }
            const obj = this.createFn();
            obj.active = true;
            this.pool.push(obj);
            return obj;
        }
    }

    class RingBuffer {
        constructor(capacity) {
            this.buffer = new Float32Array(capacity);
            this.head = 0;
            this.tail = 0;
            this.size = 0;
            this.capacity = capacity;
        }
        push(val) {
            if (this.size === this.capacity) {
                this.buffer[this.head] = val;
                this.head = (this.head + 1) % this.capacity;
                this.tail = (this.tail + 1) % this.capacity;
            } else {
                this.buffer[this.tail] = val;
                this.tail = (this.tail + 1) % this.capacity;
                this.size++;
            }
        }
        popFront() {
            if (this.size > 0) {
                const val = this.buffer[this.head];
                this.head = (this.head + 1) % this.capacity;
                this.size--;
                return val;
            }
            return 0;
        }
        get(index) {
            if (index < 0 || index >= this.size) return 0;
            return this.buffer[(this.head + index) % this.capacity];
        }
        get last() {
            if (this.size === 0) return 0;
            const lastIdx = this.tail === 0 ? this.capacity - 1 : this.tail - 1;
            return this.buffer[lastIdx];
        }
    }

    // ========================================================
    // PHYSICS CONSTANTS
    // ========================================================
    const Physics = {
        GRAVITY: 1000,       // For pure projectile jumps
        JUMP_FORCE: -600,    // Balanced jump force
        AIR_DRAG: 0.15,      // Airborne drag
        FLIP_SPEED: 6.5,     // Relaxed flip speed
        SAFE_LANDING_ANGLE: 1.2, // ~70 degrees forgiveness for avoiding crashes
        PERFECT_LANDING: 0.35,   // Easier to hit perfect landings
        COLLECT_RADIUS: 40,
        ROCK_RADIUS: 45,     // Larger hitbox to match visual scale
        LLAMA_SPEED: 350,
        PIXELS_PER_METER: 30
    };

    // ========================================================
    // TERRAIN SYSTEM
    // ========================================================
    class TerrainManager {
        constructor(seed) {
            this.noise = new SimplexNoise(seed);
            this.chunkWidth = 1000;
            this.segmentWidth = 10; // Drawing resolution
            this.segmentsPerChunk = this.chunkWidth / this.segmentWidth;
            this.controlPointsPerChunk = 10;

            this.heightMap = new RingBuffer(2000); // Use RingBuffer to avoid shift() allocations
            this.startX = 0; // World X where heightMap[0] is
            this.maxCacheWidth = 3000; // Keep generating up to playerX + maxCacheWidth

            this.baseHeight = 400;
            this.maxDepth = 800; // How deep slopes can go (Canvas Y)

            // Initial generation
            this.noiseOffset = 0;
            this.lastCPHeight = this.baseHeight;
            this.generatePoints(0, this.maxCacheWidth);
        }

        generatePoints(fromX, toX) {
            // Generate in chunks of control points
            const currentEnd = this.startX + Math.max(0, this.heightMap.size - 1) * this.segmentWidth;
            let targetX = currentEnd;

            while (targetX < toX) {
                const cps = [];
                cps.push(this.lastCPHeight);
                for (let i = 1; i < this.controlPointsPerChunk; i++) {
                    let nx = (this.noiseOffset + i) * 0.025; // Perfect frequency for wide rolling hills
                    let height = this.noise.fbm(nx, 0, 3, 0.5, 2.0, 1.0) * 1100; // Not too vertical, allowing momentum to carry over
                    height += i * 35; // Macroscopic down-slope ensures you trend downwards overall
                    cps.push(height + this.baseHeight);
                }

                const interpolated = MathUtils.catmullRomChain(cps, this.segmentsPerChunk / this.controlPointsPerChunk * 2);

                // Add to heightmap (skip first to avoid duplicate)
                for (let i = 1; i < interpolated.length; i++) {
                    this.heightMap.push(interpolated[i]);
                }

                this.noiseOffset += this.controlPointsPerChunk;
                this.lastCPHeight = cps[cps.length - 1];
                targetX += this.chunkWidth;
            }
        }

        update(playerX) {
            // Drop old points to save memory, zero array re-allocation with RingBuffer!
            while (playerX - this.startX > 1500 && this.heightMap.size > 500) {
                this.heightMap.popFront();
                this.startX += this.segmentWidth;
            }
            // Generate ahead
            this.generatePoints(this.startX, playerX + this.maxCacheWidth);
        }

        getHeightAt(x) {
            if (x < this.startX) return this.heightMap.get(0);
            const idx = (x - this.startX) / this.segmentWidth;
            const i = Math.floor(idx);
            if (i >= this.heightMap.size - 1) return this.heightMap.last;
            return MathUtils.lerp(this.heightMap.get(i), this.heightMap.get(i + 1), idx - i);
        }

        getSlopeAngle(x) {
            // Sampling over a wider range (30px) ensures smoother angles when traveling at high speeds
            const h1 = this.getHeightAt(x - 15);
            const h2 = this.getHeightAt(x + 15);
            return Math.atan2(h2 - h1, 30);
        }
    }

    // ========================================================
    // PROP MANAGER (Trees, Rocks, Coins, Llamas)
    // ========================================================
    class PropManager {
        constructor(terrainManager) {
            this.terrainManager = terrainManager;
            
            // Object Pools
            this.treePool = new ObjectPool(() => ({ x: 0, scale: 1, colorId: 0 }), 100);
            this.rockPool = new ObjectPool(() => ({ x: 0, scale: 1, smashed: false }), 40);
            this.campfirePool = new ObjectPool(() => ({ x: 0, scale: 1 }), 20);
            this.coinPool = new ObjectPool(() => ({ x: 0, y: 0, collected: false, animTime: 0 }), 150);
            this.llamaPool = new ObjectPool(() => ({ x: 0, y: 0, speed: 0, animTime: 0, collected: false }), 20);

            this.lastSpawnX = 0;
            this.spawnDistAhead = 2000;

            this.nextTreeSpawnX = 50;
            this.nextMajorSpawnX = 1500; // Unified tracker for major objects to prevent overlaps
        }

        update(dt, playerX) {
            // 1. Spawn new entities ahead
            if (playerX + this.spawnDistAhead > this.lastSpawnX) {
                this._spawnAhead(this.lastSpawnX, this.lastSpawnX + 1000);
                this.lastSpawnX += 1000;
            }

            // 2. Clean up behind (Return to pool)
            const cleanupLimit = playerX - 1000;
            for (const t of this.treePool.pool) { if (t.active && t.x < cleanupLimit) t.active = false; }
            for (const r of this.rockPool.pool) { if (r.active && r.x < cleanupLimit) r.active = false; }
            for (const c of this.campfirePool.pool) { if (c.active && c.x < cleanupLimit) c.active = false; }
            for (const c of this.coinPool.pool) { if (c.active && (c.x < cleanupLimit || c.collected)) c.active = false; }
            for (const l of this.llamaPool.pool) { if (l.active && (l.x < cleanupLimit || l.collected)) l.active = false; }

            // 3. Update active entities
            for (const llama of this.llamaPool.pool) {
                if (llama.active && !llama.collected) {
                    if (llama.x - playerX < 600 && llama.x > playerX) { // Start running away
                        llama.x += llama.speed * dt;
                    }
                    llama.y = this.terrainManager.getHeightAt(llama.x);
                    llama.animTime += dt * 15;
                }
            }
            for (const coin of this.coinPool.pool) {
                if (coin.active) {
                    coin.animTime += dt * 5;
                }
            }
        }

        _spawnAhead(startX, endX) {
            let seed = Math.floor(startX);

            // Trees (Background, allowed to overlap anything since they represent scenery)
            while (this.nextTreeSpawnX < endX) {
                seed = MathUtils.hash(seed + this.nextTreeSpawnX);
                if ((seed % 100) / 100 < 0.6) {
                    const scale = 0.5 + (seed % 50) / 100;
                    const tree = this.treePool.get();
                    tree.x = this.nextTreeSpawnX + (seed % 50);
                    tree.scale = scale;
                    tree.colorId = seed % 3;
                }
                this.nextTreeSpawnX += 150;
            }

            // Unified Major Object Spawner - Ensures Rocks, Coins, Llamas, and Campfires NEVER overlap
            while (this.nextMajorSpawnX < endX) {
                const slope = this.terrainManager.getSlopeAngle(this.nextMajorSpawnX);
                seed = MathUtils.hash(seed + this.nextMajorSpawnX);
                const typeRoll = (seed % 100) / 100;

                // Prevent Obstacles (Rocks & Campfires) from spawning on uphill stretches!
                if ((typeRoll >= 0.45 && typeRoll < 0.85) && slope < -0.1) {
                    this.nextMajorSpawnX += 300; // Skip a bit and try again later
                    continue;
                }

                if (typeRoll < 0.45) {
                    // 45% chance: Coins Parabola
                    const arcLength = 200 + (seed % 100);
                    const arcHeight = 150 + (seed % 50);
                    const pieces = 5 + (seed % 5); // 5 to 9 coins
                    for (let i = 0; i < pieces; i++) {
                        const t = i / (pieces - 1);
                        const cx = this.nextMajorSpawnX + t * arcLength;
                        const cyBase = this.terrainManager.getHeightAt(cx);
                        const cy = cyBase - 40 - (4 * arcHeight * t * (1 - t));
                        
                        const coin = this.coinPool.get();
                        coin.x = cx;
                        coin.y = cy;
                        coin.collected = false;
                        coin.animTime = t * Math.PI;
                    }
                    this.nextMajorSpawnX += arcLength + 1500 + (seed % 800); // Buffer after arc finishes
                }
                else if (typeRoll < 0.70) {
                    // 25% chance: Massive Rock
                    const rock = this.rockPool.get();
                    rock.x = this.nextMajorSpawnX;
                    rock.scale = 1.8 + (seed % 60) / 100;
                    rock.smashed = false;
                    this.nextMajorSpawnX += 1800 + (seed % 1000);
                }
                else if (typeRoll < 0.85) {
                    // 15% chance: Campfire Obstacle
                    const camp = this.campfirePool.get();
                    camp.x = this.nextMajorSpawnX;
                    camp.scale = 1.0;
                    this.nextMajorSpawnX += 1800 + (seed % 800);
                }
                else {
                    // 15% chance: Llama
                    const llama = this.llamaPool.get();
                    llama.x = this.nextMajorSpawnX;
                    llama.y = 0;
                    llama.speed = Physics.LLAMA_SPEED + (seed % 50);
                    llama.animTime = 0;
                    llama.collected = false;
                    this.nextMajorSpawnX += 2000 + (seed % 1000);
                }
            }
        }

        checkCollisions(player) {
            const px = player.x, py = player.y;

            // Coins
            for (const coin of this.coinPool.pool) {
                if (coin.active && !coin.collected && Math.hypot(coin.x - px, coin.y - py) < Physics.COLLECT_RADIUS) {
                    coin.collected = true;
                    player.score += 10 * player.comboMultiplier;
                    player.coinsCollected++;
                }
            }

            // Llamas
            for (const llama of this.llamaPool.pool) {
                if (llama.active && !llama.collected && Math.hypot(llama.x - px, llama.y - py) < Physics.COLLECT_RADIUS) {
                    llama.collected = true;
                    player.score += 50 * player.comboMultiplier;
                    player.llamasCollected++;
                    player.showTrickText('Llama! +50');
                }
            }

            // Rocks & Campfires
            for (const rock of this.rockPool.pool) {
                if (rock.active && !rock.smashed) {
                    const ry = this.terrainManager.getHeightAt(rock.x);
                    if (Math.hypot(rock.x - px, (ry - 15) - py) < Physics.ROCK_RADIUS) {
                        if (player.state !== 'crashed') {
                            player.changeState('crashed');
                        }
                    }
                }
            }

            for (const camp of this.campfirePool.pool) {
                if (camp.active) {
                    const ry = this.terrainManager.getHeightAt(camp.x);
                    if (Math.hypot(camp.x - px, (ry - 15) - py) < Physics.ROCK_RADIUS) {
                        if (player.state !== 'crashed') {
                            player.changeState('crashed');
                        }
                    }
                }
            }
        }
    }

    // ========================================================
    // PLAYER
    // ========================================================
    class Player {
        constructor(terrainManager) {
            this.terrainManager = terrainManager;
            this.x = 200;
            this.y = 0;
            this.vx = 400;
            this.vy = 0;
            this.rotation = 0; // Radians
            this.state = 'grounded'; // grounded, airborne, flipping, crashed

            this.score = 0;
            this.distance = 0;
            this.comboMultiplier = 1;
            this.coinsCollected = 0;
            this.llamasCollected = 0;

            this.trickText = '';
            this.trickTimer = 0;

            // Mechanic tracks
            this.flipAngleTotal = 0;
            this.flipsCompleted = 0;
            this.airTime = 0;
            this.boostTimer = 0;
            this.crashTimer = 0;
            this.isHoveringJump = false; // Input

            this.onGameOver = null;
        }

        update(dt, input) {
            const terrainY = this.terrainManager.getHeightAt(this.x);
            const slope = this.terrainManager.getSlopeAngle(this.x);

            // True Alto Speed Mechanic: 
            // 1. A Base speed that slowly increases over vast distances.
            this.baseSpeed = 400 + Math.min(350, this.distance * 0.1);

            // 2. Drag only heavily affects you in the air or flipping
            if (this.state === 'airborne' || this.state === 'flipping') {
                this.vx *= (1 - Physics.AIR_DRAG * dt);
            }
            if (this.state === 'crashed') {
                this.vx *= 0.95;
            }

            // State Pattern Dispatch
            if (this[`state_${this.state}`]) {
                this[`state_${this.state}`](dt, input, terrainY, slope);
            }

            if (!input.isDown) this.isHoveringJump = false;

            // Apply movement for grounded (others already applied)
            if (this.state === 'grounded') {
                this.x += this.vx * dt;
            }

            // Failsafe bounds
            if (this.y > terrainY + 50 && this.state !== 'crashed') this.changeState('crashed');

            this.distance = Math.max(this.distance, this.x / Physics.PIXELS_PER_METER);
            if (this.trickTimer > 0) this.trickTimer -= dt;
        }

        state_grounded(dt, input, terrainY, slope) {
            this.y = terrainY;
            this.vy = 0;

            // 3. Gravity explicitly pushes or pulls speed on slopes
            this.vx += 850 * Math.sin(slope) * dt;

            // 4. Momentum normalization
            if (this.vx > this.baseSpeed) {
                // Friction gently degrades extreme downhill momentum back to the base driving speed over time
                this.vx = MathUtils.lerp(this.vx, this.baseSpeed, 0.6 * dt);
            } else if (slope >= -0.15) {
                // Forward drive exclusively kicks in on flats and downhills to pull you up to base speed
                this.vx = MathUtils.lerp(this.vx, this.baseSpeed, 1.8 * dt);
            }

            // 5. Absolute crawl minimum so you never get stuck infinitely
            this.vx = Math.max(150, this.vx);

            // Rotate to match slope smoothly
            this.rotation = MathUtils.lerp(this.rotation, slope, 15 * dt);

            if (input.isDown && !this.isHoveringJump) {
                this.vy = Physics.JUMP_FORCE;
                this.vx += 150; // Jump momentum impulse
                this.changeState('airborne');
                this.isHoveringJump = true;
            }
        }

        state_airborne(dt, input, terrainY, slope) {
            this.vy += Physics.GRAVITY * dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.airTime += dt;

            // Smooth auto rotation towards natural trajectory
            const trajAngle = Math.atan2(this.vy, this.vx);
            let rotDiff = (trajAngle * 0.4 - this.rotation) % (Math.PI * 2);
            if (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            if (rotDiff < -Math.PI) rotDiff += Math.PI * 2;

            // Gentle auto-correct when airborne instead of aggressive snapping
            this.rotation += rotDiff * 3 * dt;

            if (input.isDown && this.airTime > 0.1) {
                this.changeState('flipping');
            }

            this._checkLanding(terrainY, slope);
        }

        state_flipping(dt, input, terrainY, slope) {
            this.vy += Physics.GRAVITY * dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;

            const flipDelta = Physics.FLIP_SPEED * dt;
            this.rotation += flipDelta; // Positive because Canvas Y is down, rotating Right
            this.flipAngleTotal += flipDelta;

            const newFlips = Math.floor(Math.abs(this.flipAngleTotal) / (Math.PI * 2));
            if (newFlips > this.flipsCompleted) {
                this.flipsCompleted = newFlips;
                this.comboMultiplier += 2;
                this.score += 100 * this.flipsCompleted * this.comboMultiplier;
                this.showTrickText(`Backflip x${this.flipsCompleted}!`);
            }

            if (!input.isDown) this.changeState('airborne');

            this._checkLanding(terrainY, slope);
        }

        state_crashed(dt, input, terrainY, slope) {
            this.crashTimer += dt;
            this.x += this.vx * dt;
            this.vy += Physics.GRAVITY * dt;
            this.y += this.vy * dt;
            this.vx *= 0.95; // fast slow down
            this.rotation += 10 * dt; // tumble

            if (this.y > terrainY) {
                this.y = terrainY;
                this.vy = -this.vy * 0.4;
            }

            if (this.crashTimer > 1.5 && this.onGameOver) {
                this.onGameOver();
                this.onGameOver = null;
            }
        }

        _checkLanding(terrainY, slope) {
            if (this.y >= terrainY && this.vy >= 0) {
                this.y = terrainY;

                // Normalization angle between -PI and PI
                let relAngle = (this.rotation - slope) % (Math.PI * 2);
                if (relAngle > Math.PI) relAngle -= Math.PI * 2;
                if (relAngle < -Math.PI) relAngle += Math.PI * 2;

                const diff = Math.abs(relAngle);

                if (diff < Physics.SAFE_LANDING_ANGLE) {
                    this.vy = 0;
                    if (diff < Physics.PERFECT_LANDING && this.airTime > 0.5) { // Perfect Landing visually
                        this.score += 50 * this.comboMultiplier;
                        this.comboMultiplier++;
                        this.showTrickText('Perfect Landing!');
                        this.changeState('grounded');
                    } else {
                        this.changeState('grounded');
                    }
                } else {
                    this.changeState('crashed');
                }
            }
        }

        changeState(newState) {
            this.state = newState;
            if (newState === 'airborne') {
                this.airTime = 0;
                this.flipAngleTotal = 0;
                this.flipsCompleted = 0;
            }
            if (newState === 'grounded' && this.comboMultiplier > 1 && this.trickTimer <= 0) {
                // Combo reset timeout logic could go here
            }
            if (newState === 'crashed') {
                this.crashTimer = 0;
                this.comboMultiplier = 1;
                this.vy = Physics.JUMP_FORCE * 0.6;
                this.vx *= 0.5;
            }
        }

        showTrickText(text) {
            this.trickText = text;
            this.trickTimer = 1.5;
        }
    }

    // ========================================================
    // RENDERING & ENGINE
    // ========================================================
    class GameEngine {
        constructor() {
            this.canvas = document.getElementById('gameCanvas');
            this.ctx = this.canvas.getContext('2d', { alpha: false });
            this.setupCanvas();
            window.addEventListener('resize', () => this.setupCanvas());

            // UI
            this.hudScore = document.getElementById('hud-score');
            this.hudDist = document.getElementById('hud-distance');
            this.hudCombo = document.getElementById('hud-combo');
            this.hudTrick = document.getElementById('hud-trick');
            this.hudState = document.getElementById('hud-state');
            this.hudSpeed = document.getElementById('hud-speed');
            this.screenStart = document.getElementById('start-screen');
            this.screenOver = document.getElementById('game-over');

            // Input
            this.input = { isDown: false };
            this.handleInputDown = (e) => { e.preventDefault(); if (this.gameState === 'MENU') this.start(); else if (this.gameState === 'OVER' && this.player.crashTimer > 2) this.restart(); else this.input.isDown = true; };
            this.handleInputUp = (e) => { e.preventDefault(); this.input.isDown = false; };

            window.addEventListener('pointerdown', this.handleInputDown, { passive: false });
            window.addEventListener('pointerup', this.handleInputUp, { passive: false });
            window.addEventListener('keydown', e => { if (e.code === 'Space' && !e.repeat) this.handleInputDown(e); });
            window.addEventListener('keyup', e => { if (e.code === 'Space') this.handleInputUp(e); });

            // Particles (Weather)
            this.snowflakes = Array.from({ length: 200 }, () => ({
                x: Math.random() * 2000, y: Math.random() * 1000, s: Math.random() * 2 + 1, v: Math.random() * 50 + 20
            }));

            this.gameState = 'MENU'; // MENU, PLAYING, OVER
            this.init();

            this.lastTime = performance.now();
            requestAnimationFrame((t) => this.loop(t));
        }

        setupCanvas() {
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = window.innerWidth * dpr;
            this.canvas.height = window.innerHeight * dpr;
            this.ctx.scale(dpr, dpr);
            this.w = window.innerWidth;
            this.h = window.innerHeight;
            this.cameraX = 0;
            this.cameraY = 0;
        }

        init() {
            this.terrain = new TerrainManager(Date.now());
            this.propManager = new PropManager(this.terrain);
            this.player = new Player(this.terrain);
            this.player.y = this.terrain.getHeightAt(this.player.x);

            this.player.onGameOver = () => {
                this.gameState = 'OVER';
                this.screenOver.style.display = 'flex';
                document.getElementById('final-score').textContent = Math.floor(this.player.score).toLocaleString();
                document.getElementById('final-distance').textContent = Math.floor(this.player.distance) + 'm';
            };
        }

        start() {
            this.gameState = 'PLAYING';
            this.screenStart.style.display = 'none';
        }

        restart() {
            this.init();
            this.gameState = 'PLAYING';
            this.screenOver.style.display = 'none';
        }

        loop(now) {
            requestAnimationFrame((t) => this.loop(t));
            let dt = Math.min((now - this.lastTime) / 1000, 0.05);
            this.lastTime = now;

            if (this.gameState === 'PLAYING' || this.gameState === 'OVER') {
                this.player.update(dt, this.input);
                if (this.gameState === 'PLAYING') {
                    this.terrain.update(this.player.x);
                    this.propManager.update(dt, this.player.x);
                    this.propManager.checkCollisions(this.player);
                }
            } else if (this.gameState === 'MENU') {
                this.cameraX += 100 * dt; // gentle scroll
                this.terrain.update(this.cameraX + this.w);
            }

            // Camera follow
            if (this.gameState === 'PLAYING' || this.gameState === 'OVER') {
                const targetCamX = this.player.x - 200; // Player kept left
                const targetCamY = this.player.y - this.h * 0.6; // Player kept lower-middle
                this.cameraX = MathUtils.lerp(this.cameraX, targetCamX, 5 * dt);
                this.cameraY = MathUtils.lerp(this.cameraY, targetCamY, 5 * dt);
            }

            this.render();
            this.updateHUD();
        }

        render() {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.w, this.h);

            // 1. Sky Gradient & Sun
            const skyGrad = ctx.createLinearGradient(0, 0, 0, this.h);
            skyGrad.addColorStop(0, '#1e1b4b');
            skyGrad.addColorStop(0.5, '#4338ca');
            skyGrad.addColorStop(1, '#fde68a'); // Warm sunset bottom
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, this.w, this.h);

            // Sun
            ctx.fillStyle = 'rgba(255, 230, 200, 0.9)';
            ctx.beginPath();
            ctx.arc(this.w * 0.7, this.h * 0.4 - this.cameraY * 0.1, 40, 0, Math.PI * 2);
            ctx.fill();

            // 2. Parallax background Mountains (Silhouette layers)
            this.drawParallaxLayer(0.2, '#312e81', 100, 300);
            this.drawParallaxLayer(0.4, '#3730a3', 150, 400);
            this.drawParallaxLayer(0.6, '#3f3cbb', 200, 500);

            // Save state for world transform
            ctx.save();
            ctx.translate(-this.cameraX, -this.cameraY);

            // 3. Snowflakes Details layer (World space but unaffected by zoom/shake)
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            this.snowflakes.forEach(s => {
                s.y += s.v * 0.016; s.x -= 20 * 0.016;
                // Wrap around camera
                if (s.y > this.cameraY + this.h + 10) s.y = this.cameraY - 10;
                if (s.x < this.cameraX - 10) s.x = this.cameraX + this.w + 10;
                ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2); ctx.fill();
            });

            // 4. Terrain Solid Fill (Silhouettes style)
            const mapSize = this.terrain.heightMap.size;
            const startX = this.terrain.startX;
            const segW = this.terrain.segmentWidth;

            // Shadow/Base layer
            ctx.fillStyle = '#6366f1';
            ctx.beginPath();
            ctx.moveTo(startX, this.h + this.cameraY + 1000);
            for (let i = 0; i < mapSize; i++) {
                // Ensure we only draw inside viewport roughly
                const x = startX + i * segW;
                if (x > this.cameraX - 200 && x < this.cameraX + this.w + 200) {
                    ctx.lineTo(x, this.terrain.heightMap.get(i));
                }
            }
            ctx.lineTo(startX + (mapSize - 1) * segW, this.h + this.cameraY + 1000);
            ctx.fill();

            // White snow top layer offset
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(startX, this.h + this.cameraY + 1000);
            for (let i = 0; i < mapSize; i++) {
                const x = startX + i * segW;
                if (x > this.cameraX - 200 && x < this.cameraX + this.w + 200) {
                    ctx.lineTo(x, this.terrain.heightMap.get(i) - 15); // Shift up slightly
                }
            }
            ctx.lineTo(startX + (mapSize - 1) * segW, this.h + this.cameraY + 1000);
            ctx.fill();

            // 5. Props (Trees, Rocks, Coins, Llamas)
            // Trees
            ctx.fillStyle = '#064e3b'; // Dark pine
            for (const t of this.propManager.treePool.pool) {
                if (t.active && t.x > this.cameraX - 100 && t.x < this.cameraX + this.w + 100) {
                    const ty = this.terrain.getHeightAt(t.x) - 10;
                    ctx.beginPath();
                    ctx.moveTo(t.x, ty - 80 * t.scale);
                    ctx.lineTo(t.x - 20 * t.scale, ty);
                    ctx.lineTo(t.x + 20 * t.scale, ty);
                    ctx.fill();
                }
            }

            // Rocks
            ctx.fillStyle = '#64748b';
            for (const r of this.propManager.rockPool.pool) {
                if (r.active && !r.smashed && r.x > this.cameraX - 100 && r.x < this.cameraX + this.w + 100) {
                    const ry = this.terrain.getHeightAt(r.x) - 10;
                    ctx.beginPath();
                    ctx.arc(r.x, ry, 15 * r.scale, Math.PI, 0);
                    ctx.fill();
                }
            }

            // Coins
            ctx.fillStyle = '#fbbf24';
            for (const c of this.propManager.coinPool.pool) {
                if (c.active && !c.collected && c.x > this.cameraX - 50 && c.x < this.cameraX + this.w + 50) {
                    ctx.save();
                    ctx.translate(c.x, c.y);
                    ctx.scale(Math.abs(Math.cos(c.animTime)), 1); // Spin effect
                    ctx.beginPath();
                    ctx.arc(0, 0, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }
            // Campfires
            for (const camp of this.propManager.campfirePool.pool) {
                if (camp.active && camp.x > this.cameraX - 100 && camp.x < this.cameraX + this.w + 100) {
                    const ry = this.terrain.getHeightAt(camp.x);
                    // Logs
                    ctx.fillStyle = '#78350f';
                    ctx.beginPath(); ctx.moveTo(camp.x - 20, ry - 5); ctx.lineTo(camp.x + 20, ry); ctx.lineTo(camp.x, ry); ctx.fill();
                    // Fire Flames
                    ctx.fillStyle = '#f97316';
                    const fireFlicker = Math.sin(performance.now() * 0.01 + camp.x) * 10;
                    ctx.beginPath(); ctx.moveTo(camp.x, ry - 35 + fireFlicker); ctx.lineTo(camp.x - 15, ry - 5); ctx.lineTo(camp.x + 15, ry - 5); ctx.fill();
                    // Core Flame glow
                    ctx.fillStyle = '#fde047';
                    ctx.beginPath(); ctx.moveTo(camp.x, ry - 20 + fireFlicker * 0.5); ctx.lineTo(camp.x - 7, ry - 5); ctx.lineTo(camp.x + 7, ry - 5); ctx.fill();
                }
            }

            // Llamas
            ctx.fillStyle = '#f8fafc';
            for (const l of this.propManager.llamaPool.pool) {
                if (l.active && !l.collected && l.x > this.cameraX - 100 && l.x < this.cameraX + this.w + 100) {
                    const ly = l.y - 15;
                    const bob = Math.abs(Math.sin(l.animTime)) * 10; // Jumping animation
                    ctx.save();
                    ctx.translate(l.x, ly - bob);
                    // Body
                    ctx.fillRect(-15, -20, 30, 20);
                    // Neck/Head
                    ctx.fillRect(5, -35, 10, 20);
                    // Legs
                    const legSwing = Math.sin(l.animTime) * 5;
                    ctx.fillRect(-10 + legSwing, 0, 4, 10);
                    ctx.fillRect(10 - legSwing, 0, 4, 10);
                    ctx.restore();
                }
            }

            // 6. Player Character
            if (this.gameState === 'PLAYING' || this.gameState === 'OVER') {
                ctx.save();
                ctx.translate(this.player.x, this.player.y - 5);
                ctx.rotate(this.player.rotation);

                // Scarf (Red trailing back)
                ctx.fillStyle = '#ef4444';
                const flutter = Math.sin(performance.now() * 0.02) * 5;
                ctx.beginPath();
                ctx.moveTo(-5, -25);
                ctx.lineTo(-35, -25 + flutter);
                ctx.lineTo(-35, -20 + flutter);
                ctx.lineTo(-5, -20);
                ctx.fill();

                // Board
                ctx.fillStyle = '#0f172a';
                ctx.beginPath(); ctx.roundRect(-25, 0, 50, 6, 3); ctx.fill();

                // Body (Silhouette shape)
                ctx.fillStyle = '#1e293b';
                ctx.beginPath(); ctx.roundRect(-8, -30, 16, 30, 8); ctx.fill();

                // Head
                ctx.fillStyle = '#ffedd5';
                ctx.beginPath(); ctx.arc(2, -35, 8, 0, Math.PI * 2); ctx.fill();

                ctx.restore();
            }

            ctx.restore(); // Restore world transform
        }

        drawParallaxLayer(speedMult, color, baseYOffset, noiseScale) {
            const ctx = this.ctx;
            ctx.fillStyle = color;
            ctx.beginPath();
            const relCameraX = this.cameraX * speedMult;
            const screenStartX = relCameraX;
            ctx.moveTo(0, this.h);

            for (let x = 0; x < this.w; x += 20) {
                const worldX = screenStartX + x;
                const y = Math.sin(worldX / noiseScale) * 100 + Math.cos(worldX / (noiseScale * 2)) * 50;
                ctx.lineTo(x, this.h - baseYOffset + y + this.cameraY * 0.2);
            }
            ctx.lineTo(this.w, this.h);
            ctx.fill();
        }

        updateHUD() {
            if (this.gameState !== 'PLAYING') return;

            this.hudScore.textContent = Math.floor(this.player.score).toLocaleString();
            this.hudDist.textContent = Math.floor(this.player.distance) + 'm';
            this.hudSpeed.textContent = Math.floor(this.player.vx / 10) + ' km/h';
            this.hudState.textContent = this.player.state.toUpperCase();

            // Trick Text
            if (this.player.trickTimer > 0) {
                this.hudTrick.textContent = this.player.trickText;
                this.hudTrick.style.opacity = Math.min(1, this.player.trickTimer * 2).toString();
                this.hudTrick.style.transform = `translateX(-50%) translateY(${(1.5 - this.player.trickTimer) * -20}px)`;
            } else {
                this.hudTrick.style.opacity = '0';
            }

            // Combo multiplier
            if (this.player.comboMultiplier > 1) {
                this.hudCombo.textContent = 'x' + this.player.comboMultiplier;
                this.hudCombo.style.opacity = '1';
                this.hudCombo.style.transform = `translateY(-50%) scale(${1 + this.player.comboMultiplier * 0.05})`;
            } else {
                this.hudCombo.style.opacity = '0';
            }
        }
    }

    // Start App
    console.log("🏔️ Alto's Adventure 2D Canvas Edition initializing...");
    new GameEngine();

})();
