/**
 * MathUtils.js — Catmull-Rom Spline, Lerp, Vector helpers
 * Dùng cho procedural terrain và physics
 */

const MathUtils = {

    /**
     * Linear interpolation
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Smooth step (ease in-out)
     */
    smoothstep(a, b, t) {
        t = Math.max(0, Math.min(1, t));
        t = t * t * (3 - 2 * t);
        return a + (b - a) * t;
    },

    /**
     * Clamp value between min and max
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Catmull-Rom Spline interpolation
     * Cho 4 điểm: p0, p1, p2, p3 và t ∈ [0,1]
     * Trả về điểm nội suy giữa p1 và p2
     * Đảm bảo bề mặt terrain mượt mà tuyệt đối
     */
    catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;

        return 0.5 * (
            (2 * p1) +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );
    },

    /**
     * Catmull-Rom Spline trên toàn bộ mảng control points
     * @param {number[]} points - Mảng các giá trị Y (control points)
     * @param {number} segments - Số segment nội suy giữa mỗi cặp điểm
     * @returns {number[]} Mảng các giá trị Y đã nội suy mượt
     */
    catmullRomChain(points, segments) {
        const result = [];
        const n = points.length;

        for (let i = 0; i < n - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[Math.min(n - 1, i + 1)];
            const p3 = points[Math.min(n - 1, i + 2)];

            for (let j = 0; j < segments; j++) {
                const t = j / segments;
                result.push(this.catmullRom(p0, p1, p2, p3, t));
            }
        }

        // Add last point
        result.push(points[n - 1]);
        return result;
    },

    /**
     * Tính surface normal tại một điểm trên terrain
     * Dùng 2 điểm lân cận để tính tangent → normal
     * @param {number[]} heights - Mảng heightmap
     * @param {number} index - Vị trí cần tính normal
     * @param {number} segmentWidth - Khoảng cách giữa 2 segment
     * @returns {{x: number, y: number}} Normal vector (normalized)
     */
    getSurfaceNormal(heights, index, segmentWidth) {
        const prev = heights[Math.max(0, index - 1)];
        const next = heights[Math.min(heights.length - 1, index + 1)];

        // Tangent vector = (dx, dy)
        const dx = segmentWidth * (index < heights.length - 1 ? 1 : 0) -
                   segmentWidth * (index > 0 ? 1 : 0) || segmentWidth;
        const dy = next - prev;

        // Normal = perpendicular to tangent (rotate 90° CCW): (-dy, dx)
        const len = Math.sqrt(dy * dy + dx * dx);
        return {
            x: -dy / len,
            y: dx / len
        };
    },

    /**
     * Dot product giữa 2 vector 2D
     */
    dot2D(ax, ay, bx, by) {
        return ax * bx + ay * by;
    },

    /**
     * Tính slope angle (góc dốc) tại vị trí trên terrain
     * @returns {number} Góc tính bằng radians
     */
    getSlopeAngle(heights, index, segmentWidth) {
        const prev = heights[Math.max(0, index - 1)];
        const next = heights[Math.min(heights.length - 1, index + 1)];
        const dx = segmentWidth * 2;
        const dy = next - prev;
        return Math.atan2(dy, dx);
    },

    /**
     * Random trong khoảng [min, max]
     */
    randomRange(min, max) {
        return min + Math.random() * (max - min);
    },

    /**
     * Remap value từ range [inMin, inMax] sang [outMin, outMax]
     */
    remap(value, inMin, inMax, outMin, outMax) {
        return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
    }
};
