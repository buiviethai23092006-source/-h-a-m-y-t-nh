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

            this.baseHeight = 600; // Hạ thấp terrain xuống giữa màn hình
            this.maxDepth = 800; // How deep slopes can go (Canvas Y)

            // Initial generation
            this.noiseOffset = 0;
            this.lastCPHeight = this.baseHeight;
            this.maxLevelY = this.baseHeight; // Tracking Y for monotonic downhills
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
                    let globalIndex = this.noiseOffset + i;

                    // Đồng bằng xuất phát: 20 điểm đầu bị ép phẳng
                    let activeIndex = Math.max(0, globalIndex - 20);

                    let nx = activeIndex * 0.035; // Tần số thấp hơn → sóng rộng hơn, mượt hơn
                    // Noise cơ bản tạo đường cong thoải
                    let height = this.noise.noise2D(nx, 0) * 500;

                    // Sóng lượn siêu rộng cho bề mặt nhấp nhô tự nhiên
                    height += Math.sin(nx * 0.4) * 550;

                    // Transition mượt từ đồng bằng
                    let noiseFade = Math.min(1, activeIndex / 8);
                    height *= noiseFade;

                    const slopeMul = 100 + Math.abs(this.noise.noise2D(nx * 0.3, 5)) * 40; // 80-120 ngẫu nhiên
                    height += activeIndex * slopeMul;
                    cps.push(height + this.baseHeight);
                }

                const interpolated = MathUtils.catmullRomChain(cps, this.segmentsPerChunk / this.controlPointsPerChunk * 2);

                // Add to heightmap (skip first to avoid duplicate)
                for (let i = 1; i < interpolated.length; i++) {
                    let y = interpolated[i];

                    // Cho phép đồi cao tối đa 200px (y nhỏ hơn = cao hơn trên màn hình)
                    if (y < this.maxLevelY - 200) {
                        y = this.maxLevelY - 200; // Giới hạn độ cao đồi
                    }
                    // Cập nhật điểm thấp nhất (chỉ khi đi xuống sâu hơn)
                    if (y > this.maxLevelY) {
                        this.maxLevelY = y;
                    }

                    this.heightMap.push(y);
                }

                this.noiseOffset += this.controlPointsPerChunk;
                // Use the clamped result for continuous connecting
                this.lastCPHeight = this.maxLevelY;
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
            this.chasmPool = new ObjectPool(() => ({ x: 0, width: 0, depth: 0, surfaceY: 0 }), 15);

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
            for (const ch of this.chasmPool.pool) { if (ch.active && ch.x + ch.width < cleanupLimit) ch.active = false; }

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
                    // 45% chance: Coins line along terrain (Alto's style)
                    const spacing = 80;
                    const pieces = 4 + (seed % 3); // 4-6 xu
                    for (let i = 0; i < pieces; i++) {
                        const cx = this.nextMajorSpawnX + i * spacing;
                        const cy = this.terrainManager.getHeightAt(cx) - 35;

                        const coin = this.coinPool.get();
                        coin.x = cx;
                        coin.y = cy;
                        coin.collected = false;
                        coin.animTime = i * 0.5;
                    }
                    this.nextMajorSpawnX += pieces * spacing + 800 + (seed % 600);
                }
                else if (typeRoll < 0.60) {
                    // 15% chance: CHASM (khe nứt vực sâu)
                    const chasmWidth = 450 + (seed % 250); // 450-700px rộng (phải nhảy mới qua)
                    const surfaceY = this.terrainManager.getHeightAt(this.nextMajorSpawnX);

                    const chasm = this.chasmPool.get();
                    chasm.x = this.nextMajorSpawnX;
                    chasm.width = chasmWidth;
                    chasm.depth = 600; // Sâu vực
                    chasm.surfaceY = surfaceY;

                    // Spawn xu vòng cung phía trên vực (phải nhảy qua mới ăn được)
                    const coinCount = 4 + (seed % 3); // 4-6 xu
                    for (let i = 0; i < coinCount; i++) {
                        const t = i / (coinCount - 1);
                        const cx = this.nextMajorSpawnX + t * chasmWidth;
                        const arcH = 120 + (seed % 60);
                        const cy = surfaceY - 50 - (4 * arcH * t * (1 - t));

                        const coin = this.coinPool.get();
                        coin.x = cx;
                        coin.y = cy;
                        coin.collected = false;
                        coin.animTime = t * Math.PI;
                    }

                    this.nextMajorSpawnX += chasmWidth + 1500 + (seed % 800);
                }
                else if (typeRoll < 0.68) {
                    // 8% chance: Rock obstacle (nhảy qua hoặc crash)
                    const rock = this.rockPool.get();
                    rock.x = this.nextMajorSpawnX;
                    rock.scale = 1.6 + (seed % 100) / 100; // 1.6-2.6 (tăng kích thước to hơn)
                    rock.smashed = false;
                    this.nextMajorSpawnX += 1200 + (seed % 800);
                }
                else if (typeRoll < 0.76) {
                    // 8% chance: Campfire obstacle (nhảy qua hoặc crash)
                    const camp = this.campfirePool.get();
                    camp.x = this.nextMajorSpawnX;
                    camp.scale = 1.3; // (tăng kích thước to hơn)
                    this.nextMajorSpawnX += 1200 + (seed % 800);
                }
                else if (typeRoll < 0.85) {
                    // 9% chance: Skip
                    this.nextMajorSpawnX += 1800 + (seed % 1000);
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
            // Chasms — rơi vào vực = chết
            for (const ch of this.chasmPool.pool) {
                if (ch.active && px > ch.x + 20 && px < ch.x + ch.width - 20) {
                    // Player đang ở trên vực: nếu đang grounded (chạm đất) thì rơi xuống
                    if (player.state === 'grounded') {
                        player.vy = 50; // Rơi xuống
                        player.changeState('airborne');
                    }
                    // Nếu rơi quá sâu dưới mặt tuyết → crash
                    if (py > ch.surfaceY + 200 && player.state !== 'crashed') {
                        player.changeState('crashed');
                    }
                }
            }
        }
    }

    // ========================================================
    // PARTICLE SYSTEM (VFX: Snow Trail, Landing Burst, Speed Lines)
    // ========================================================
    class ParticleSystem {
        constructor() { this.particles = []; }

        emit(x, y, count, cfg) {
            for (let i = 0; i < count; i++) {
                let p = this.particles.find(q => q.life <= 0);
                if (!p) {
                    if (this.particles.length >= 500) continue;
                    p = { life: 0 };
                    this.particles.push(p);
                }
                p.x = x + (Math.random() - 0.5) * (cfg.spread || 0);
                p.y = y + (Math.random() - 0.5) * (cfg.spreadY || 0);
                p.vx = (cfg.vx || 0) + (Math.random() - 0.5) * (cfg.vxRand || 50);
                p.vy = (cfg.vy || -50) + Math.random() * (cfg.vyRand || 50);
                p.life = (cfg.life || 0.8) + Math.random() * (cfg.lifeRand || 0.3);
                p.maxLife = p.life;
                p.size = (cfg.size || 3) + Math.random() * (cfg.sizeRand || 1);
                p.color = cfg.color || '#fff';
                p.type = cfg.type || 'circle';
                p.gravity = cfg.gravity !== undefined ? cfg.gravity : 200;
            }
        }

        update(dt) {
            for (const p of this.particles) {
                if (p.life <= 0) continue;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += p.gravity * dt;
                p.life -= dt;
            }
        }

        render(ctx) {
            for (const p of this.particles) {
                if (p.life <= 0) continue;
                const a = MathUtils.clamp(p.life / p.maxLife, 0, 1);
                ctx.globalAlpha = a;
                if (p.type === 'line') {
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = p.size;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x - 50, p.y);
                    ctx.stroke();
                } else {
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size * (0.3 + a * 0.7), 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
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
            this.vx = 800; // Tốc độ khởi đầu chậm lại
            this.vy = 0;
            this.rotation = 0;
            this.state = 'grounded';
            this.prevState = 'grounded';

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
            this.isHoveringJump = false;

            // VFX event flags
            this.justLanded = false;
            this.justBoosted = false;

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

            // Đã giảm tốc độ xuống mức dễ chịu hơn: 50 - 80 (tương đương 500 đến 800 pixel/giây)
            this.vx = MathUtils.clamp(this.vx, 500, 800);

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

            // Momentum normalization (chỉ nhẹ nhàng kéo giãn về giữa, vì hard clamp đã bắt buộc min max)
            if (this.vx > this.baseSpeed) {
                this.vx = MathUtils.lerp(this.vx, this.baseSpeed, 0.6 * dt);
            } else if (slope >= -0.15) {
                this.vx = MathUtils.lerp(this.vx, this.baseSpeed, 1.8 * dt);
            }

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
                this.boostTimer = 2.0;
                this.justBoosted = true;
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
            this.prevState = this.state;
            this.state = newState;
            if (newState === 'airborne') {
                this.airTime = 0;
                this.flipAngleTotal = 0;
                this.flipsCompleted = 0;
            }
            if (newState === 'grounded' && (this.prevState === 'airborne' || this.prevState === 'flipping')) {
                this.justLanded = true;
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
            this.hudTrick = document.getElementById('hud-trick');
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

            // Snowflakes (Weather)
            this.snowflakes = Array.from({ length: 200 }, () => ({
                x: Math.random() * 2000, y: Math.random() * 1000, s: Math.random() * 2 + 1, v: Math.random() * 50 + 20
            }));

            // VFX Particle System
            this.particles = new ParticleSystem();
            this.shakeTimer = 0;
            this.shakeIntensity = 0;

            // Background Image
            this.bgImg = new Image();
            this.bgImg.src = 'T.jpg';

            this.gameState = 'MENU';
            this.init();

            this.lastTime = performance.now();
            requestAnimationFrame((t) => this.loop(t));
        }

        setupCanvas() {
            const dpr = window.devicePixelRatio || 1;
            // Tạo góc nhìn rộng hơn: thu nhỏ thế giới 2D lại để bao quát rộng hơn (Zoom Out)
            this.zoomScale = 0.6; // Tỷ lệ scale world nhỏ lại

            this.canvas.width = window.innerWidth * dpr;
            this.canvas.height = window.innerHeight * dpr;
            this.ctx.scale(dpr * this.zoomScale, dpr * this.zoomScale);

            // Tính lại w và h của viewport theo không gian world để culling không bị lỗi
            this.w = window.innerWidth / this.zoomScale;
            this.h = window.innerHeight / this.zoomScale;

            if (this.cameraX === undefined) this.cameraX = 0;
            if (this.cameraY === undefined) this.cameraY = 0;
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
            this.dt = dt;

            if (this.gameState === 'PLAYING' || this.gameState === 'OVER') {
                this.player.update(dt, this.input);
                if (this.gameState === 'PLAYING') {
                    this.terrain.update(this.player.x);
                    this.propManager.update(dt, this.player.x);
                    this.propManager.checkCollisions(this.player);
                }

                // === VFX: Snow Trail (tuyết bắn khi trượt) ===
                if (this.player.state === 'grounded') {
                    const speed01 = (this.player.vx - 600) / 600;
                    const trailCount = Math.floor(1 + speed01 * 3);
                    this.particles.emit(this.player.x - 20, this.player.y, trailCount, {
                        vx: -this.player.vx * 0.3, vxRand: 80,
                        vy: -120, vyRand: 60,
                        life: 0.3, lifeRand: 0.2,
                        size: 2, sizeRand: 2,
                        gravity: 150, spread: 10,
                        color: '#000000' // Đuôi khói ván trượt màu đen
                    });
                }

                // === VFX: Landing Burst (bụi tuyết tung khi tiếp đất) ===
                if (this.player.justLanded) {
                    this.player.justLanded = false;
                    this.particles.emit(this.player.x, this.player.y, 25, {
                        vx: 0, vxRand: 250,
                        vy: -200, vyRand: 100,
                        life: 0.5, lifeRand: 0.3,
                        size: 3, sizeRand: 3,
                        gravity: 300, spread: 30,
                        color: '#c7d2fe'
                    });
                    this.shakeTimer = 0.15;
                    this.shakeIntensity = 6;
                }

                // === VFX: Speed Lines (vệt sáng khi backflip boost) ===
                if (this.player.justBoosted) {
                    this.player.justBoosted = false;
                    for (let i = 0; i < 15; i++) {
                        this.particles.emit(
                            this.player.x + 50 + Math.random() * 200,
                            this.player.y - 40 + Math.random() * 80, 1, {
                            vx: -600, vxRand: 200,
                            vy: 0, vyRand: 20,
                            life: 0.4, lifeRand: 0.3,
                            size: 2, sizeRand: 1,
                            gravity: 0, type: 'line',
                            color: '#fbbf24'
                        });
                    }
                }

                if (this.player.boostTimer > 0) this.player.boostTimer -= dt;

            } else if (this.gameState === 'MENU') {
                this.cameraX += 100 * dt;
                this.terrain.update(this.cameraX + this.w);
            }

            // Update VFX
            this.particles.update(dt);
            if (this.shakeTimer > 0) this.shakeTimer -= dt;

            // Camera follow
            if (this.gameState === 'PLAYING' || this.gameState === 'OVER') {
                const lookAhead = Math.min(this.player.vx * 0.3, this.w * 0.4);
                const targetCamX = this.player.x - this.w * 0.2 + lookAhead;
                const targetCamY = this.player.y - this.h * 0.67; // Terrain ở 1/3 dưới màn hình
                this.cameraX = MathUtils.lerp(this.cameraX, targetCamX, 15 * dt);
                this.cameraY = MathUtils.lerp(this.cameraY, targetCamY, 15 * dt);
            }

            this.render();
            this.updateHUD();
        }

        render() {
            const ctx = this.ctx;
            const dt = this.dt || 0.016;

            // Fix: clearRect needs canvas-space dimensions before scale
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.restore();

            // 1. Background with subtle parallax
            if (this.bgImg && this.bgImg.complete && this.bgImg.naturalWidth > 0) {
                const imgRatio = this.bgImg.width / this.bgImg.height;
                const canvasRatio = this.w / this.h;
                let drawW = this.w;
                let drawH = this.h;
                let drawX = 0;
                let drawY = 0;
                if (imgRatio > canvasRatio) {
                    drawW = this.h * imgRatio;
                    drawX = (this.w - drawW) / 2;
                } else {
                    drawH = this.w / imgRatio;
                    drawY = (this.h - drawH) / 2;
                }
                ctx.drawImage(this.bgImg, drawX, drawY, drawW, drawH);
            } else {
                ctx.fillStyle = '#1e1b4b';
                ctx.fillRect(0, 0, this.w, this.h);
            }

            // Camera shake offset
            const shakeX = this.shakeTimer > 0 ? (Math.random() - 0.5) * this.shakeIntensity : 0;
            const shakeY = this.shakeTimer > 0 ? (Math.random() - 0.5) * this.shakeIntensity : 0;

            // Save state for world transform
            ctx.save();
            ctx.translate(-this.cameraX + shakeX, -this.cameraY + shakeY);

            // 2. Snowflakes (fixed dt, full vertical coverage)
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            this.snowflakes.forEach(s => {
                s.y += s.v * dt; s.x -= 30 * dt;
                if (s.y > this.cameraY + this.h + 10) s.y = this.cameraY - 10;
                if (s.y < this.cameraY - 50) s.y = this.cameraY + Math.random() * this.h;
                if (s.x < this.cameraX - 10) s.x = this.cameraX + this.w + 10;
                if (s.x > this.cameraX + this.w + 10) s.x = this.cameraX - 10;
                ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2); ctx.fill();
            });

            // 3. Terrain with gradient depth (3 layers + glow stroke)
            const mapSize = this.terrain.heightMap.size;
            const startX = this.terrain.startX;
            const segW = this.terrain.segmentWidth;
            const btm = this.h + this.cameraY + 1000;
            const camL = this.cameraX - 200;
            const camR = this.cameraX + this.w + 200;

            // Layer 1: Deep shadow (darkest)
            ctx.fillStyle = '#312e81';
            ctx.beginPath();
            ctx.moveTo(startX, btm);
            for (let i = 0; i < mapSize; i++) {
                const x = startX + i * segW;
                if (x > camL && x < camR) ctx.lineTo(x, this.terrain.heightMap.get(i) + 20);
            }
            ctx.lineTo(startX + (mapSize - 1) * segW, btm);
            ctx.fill();

            // Layer 2: Mid indigo shadow
            ctx.fillStyle = '#4338ca';
            ctx.beginPath();
            ctx.moveTo(startX, btm);
            for (let i = 0; i < mapSize; i++) {
                const x = startX + i * segW;
                if (x > camL && x < camR) ctx.lineTo(x, this.terrain.heightMap.get(i) + 5);
            }
            ctx.lineTo(startX + (mapSize - 1) * segW, btm);
            ctx.fill();

            // Layer 3: Snow surface
            ctx.fillStyle = '#eef2ff';
            ctx.beginPath();
            ctx.moveTo(startX, btm);
            for (let i = 0; i < mapSize; i++) {
                const x = startX + i * segW;
                if (x > camL && x < camR) ctx.lineTo(x, this.terrain.heightMap.get(i) - 8);
            }
            ctx.lineTo(startX + (mapSize - 1) * segW, btm);
            ctx.fill();

            // Snow highlight glow on top edge
            ctx.strokeStyle = '#ffffff'; // Viền tuyết trắng sáng bật lại
            ctx.lineWidth = 3;
            ctx.shadowColor = 'rgba(255,255,255,0.4)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            let firstPt = true;
            for (let i = 0; i < mapSize; i++) {
                const x = startX + i * segW;
                if (x > camL && x < camR) {
                    if (firstPt) { ctx.moveTo(x, this.terrain.heightMap.get(i) - 10); firstPt = false; }
                    else ctx.lineTo(x, this.terrain.heightMap.get(i) - 10);
                }
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // 4. CHASMS (khe nứt vực sâu)
            for (const ch of this.propManager.chasmPool.pool) {
                if (!ch.active) continue;
                if (ch.x + ch.width < camL || ch.x > camR) continue;

                const lx = ch.x;           // Mép trái vực
                const rx = ch.x + ch.width; // Mép phải vực
                const sy = ch.surfaceY;     // Mặt tuyết
                const deep = sy + ch.depth; // Đáy vực

                // Xóa vùng terrain tại vực (vẽ đè bằng nền tối)
                ctx.fillStyle = '#0f0e2a';
                ctx.fillRect(lx + 10, sy - 10, ch.width - 20, ch.depth + 100);

                // Vách đá bên trái
                ctx.fillStyle = '#44403c';
                ctx.beginPath();
                ctx.moveTo(lx, sy - 15);
                ctx.lineTo(lx + 15, sy - 5);
                ctx.lineTo(lx + 20, sy + 60);
                ctx.lineTo(lx + 10, sy + 150);
                ctx.lineTo(lx + 25, sy + 300);
                ctx.lineTo(lx + 8, deep);
                ctx.lineTo(lx - 5, deep);
                ctx.lineTo(lx - 5, sy - 15);
                ctx.fill();

                // Chi tiết vách trái (lớp sáng hơn)
                ctx.fillStyle = '#57534e';
                ctx.beginPath();
                ctx.moveTo(lx + 3, sy);
                ctx.lineTo(lx + 15, sy + 20);
                ctx.lineTo(lx + 12, sy + 80);
                ctx.lineTo(lx + 18, sy + 200);
                ctx.lineTo(lx + 5, sy + 300);
                ctx.lineTo(lx, sy + 300);
                ctx.lineTo(lx, sy);
                ctx.fill();

                // Vách đá bên phải
                ctx.fillStyle = '#44403c';
                ctx.beginPath();
                ctx.moveTo(rx, sy - 15);
                ctx.lineTo(rx - 15, sy - 5);
                ctx.lineTo(rx - 20, sy + 60);
                ctx.lineTo(rx - 10, sy + 150);
                ctx.lineTo(rx - 25, sy + 300);
                ctx.lineTo(rx - 8, deep);
                ctx.lineTo(rx + 5, deep);
                ctx.lineTo(rx + 5, sy - 15);
                ctx.fill();

                // Chi tiết vách phải
                ctx.fillStyle = '#57534e';
                ctx.beginPath();
                ctx.moveTo(rx - 3, sy);
                ctx.lineTo(rx - 15, sy + 20);
                ctx.lineTo(rx - 12, sy + 80);
                ctx.lineTo(rx - 18, sy + 200);
                ctx.lineTo(rx - 5, sy + 300);
                ctx.lineTo(rx, sy + 300);
                ctx.lineTo(rx, sy);
                ctx.fill();

                // Tuyết trên đỉnh vách (mũ tuyết trắng)
                ctx.fillStyle = '#eef2ff';
                // Mũ trái
                ctx.beginPath();
                ctx.moveTo(lx - 10, sy - 15);
                ctx.lineTo(lx + 18, sy - 10);
                ctx.lineTo(lx + 12, sy - 3);
                ctx.lineTo(lx - 10, sy - 8);
                ctx.fill();
                // Mũ phải
                ctx.beginPath();
                ctx.moveTo(rx + 10, sy - 15);
                ctx.lineTo(rx - 18, sy - 10);
                ctx.lineTo(rx - 12, sy - 3);
                ctx.lineTo(rx + 10, sy - 8);
                ctx.fill();
            }

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

            // 6. VFX Particles (world space)
            this.particles.render(ctx);

            // 7. Player Character
            if (this.gameState === 'PLAYING' || this.gameState === 'OVER') {
                ctx.save();
                ctx.translate(this.player.x, this.player.y - 5);
                ctx.rotate(this.player.rotation);

                // Boost glow aura
                if (this.player.boostTimer > 0) {
                    const glowAlpha = Math.min(1, this.player.boostTimer) * 0.4;
                    ctx.shadowColor = '#fbbf24';
                    ctx.shadowBlur = 25 + Math.sin(performance.now() * 0.01) * 10;
                    ctx.fillStyle = `rgba(251, 191, 36, ${glowAlpha})`;
                    ctx.beginPath(); ctx.arc(0, -15, 35, 0, Math.PI * 2); ctx.fill();
                    ctx.shadowBlur = 0;
                }

                // Scarf (dynamic length based on speed)
                ctx.fillStyle = '#ef4444';
                const scarfLen = 30 + (this.player.vx - 600) / 600 * 20;
                const flutter = Math.sin(performance.now() * 0.02) * 5;
                ctx.beginPath();
                ctx.moveTo(-5, -25);
                ctx.lineTo(-5 - scarfLen, -25 + flutter);
                ctx.lineTo(-5 - scarfLen, -20 + flutter);
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

        updateHUD() {
            if (this.gameState !== 'PLAYING') return;

            // Trick Text
            if (this.player.trickTimer > 0) {
                this.hudTrick.textContent = this.player.trickText;
                this.hudTrick.style.opacity = Math.min(1, this.player.trickTimer * 2).toString();
                this.hudTrick.style.transform = `translateX(-50%) translateY(${(1.5 - this.player.trickTimer) * -20}px)`;
            } else {
                this.hudTrick.style.opacity = '0';
            }
        }
    }

    // Start App
    console.log("🏔️ Alto's Adventure 2D Canvas Edition initializing...");
    new GameEngine();

})();
