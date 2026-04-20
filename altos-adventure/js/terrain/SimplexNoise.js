/**
 * SimplexNoise.js — Simplex Noise 2D implementation
 * Sinh giá trị ngẫu nhiên có tính liên tục cho procedural terrain
 * Hỗ trợ Fractal Brownian Motion (fBm) để tạo địa hình phức tạp
 */

class SimplexNoise {
    constructor(seed) {
        this.seed = seed || Math.random() * 65536;
        this.grad3 = [
            [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
            [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
            [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
        ];

        // Permutation table
        this.perm = new Uint8Array(512);
        this.permMod12 = new Uint8Array(512);

        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            p[i] = i;
        }

        // Shuffle with seed
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

        // Skewing factors for 2D
        this.F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
        this.G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    }

    /**
     * 2D Simplex Noise
     * @param {number} xin - X coordinate
     * @param {number} yin - Y coordinate
     * @returns {number} Value in range [-1, 1]
     */
    noise2D(xin, yin) {
        const { perm, permMod12, grad3, F2, G2 } = this;
        let n0, n1, n2;

        // Skew input space
        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const t = (i + j) * G2;

        const X0 = i - t;
        const Y0 = j - t;
        const x0 = xin - X0;
        const y0 = yin - Y0;

        let i1, j1;
        if (x0 > y0) {
            i1 = 1; j1 = 0;
        } else {
            i1 = 0; j1 = 1;
        }

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2;
        const y2 = y0 - 1.0 + 2.0 * G2;

        const ii = i & 255;
        const jj = j & 255;
        const gi0 = permMod12[ii + perm[jj]];
        const gi1 = permMod12[ii + i1 + perm[jj + j1]];
        const gi2 = permMod12[ii + 1 + perm[jj + 1]];

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) {
            n0 = 0.0;
        } else {
            t0 *= t0;
            n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) {
            n1 = 0.0;
        } else {
            t1 *= t1;
            n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) {
            n2 = 0.0;
        } else {
            t2 *= t2;
            n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2);
        }

        // Scale to [-1, 1]
        return 70.0 * (n0 + n1 + n2);
    }

    /**
     * Fractal Brownian Motion - chồng nhiều octave Simplex Noise
     * Octave 1: Sóng lớn (đồi núi chính)
     * Octave 2+: Chi tiết nhỏ (gồ ghề nhẹ)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} octaves - Số octave (2-4 recommended)
     * @param {number} persistence - Biên độ giảm mỗi octave (0.5 typical)
     * @param {number} lacunarity - Tần số tăng mỗi octave (2.0 typical)
     * @param {number} scale - Scale chung
     * @returns {number} Giá trị noise đa octave
     */
    fbm(x, y, octaves = 3, persistence = 0.5, lacunarity = 2.0, scale = 1.0) {
        let total = 0;
        let frequency = scale;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return total / maxValue;
    }
}
