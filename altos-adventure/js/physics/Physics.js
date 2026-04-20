/**
 * Physics.js — Hằng số vật lý và tích phân Euler
 * 
 * Euler Integration cơ bản: 
 *   velocity += acceleration * dt
 *   position += velocity * dt
 * 
 * Slope acceleration: g * sin(slopeAngle)
 * Landing check: dot(playerUp, surfaceNormal) > threshold
 */

const Physics = {
    // Gravity (hướng xuống, negative Y)
    GRAVITY: -28,

    // Jump force (hướng lên)
    JUMP_FORCE: 14,

    // Speed limits
    MIN_SPEED: 8,
    MAX_SPEED: 45,

    // Friction coefficient
    FRICTION: 0.15,

    // Air drag
    AIR_DRAG: 0.05,

    // Flip rotation speed (rad/s)
    FLIP_SPEED: 7.5,

    // Landing safety thresholds (cosine of angle)
    // cos(45°) ≈ 0.707 → nếu góc lệch > 45° thì crash
    SAFE_LANDING_THRESHOLD: 0.45,

    // cos(15°) ≈ 0.966 → nếu góc lệch < 15° thì perfect landing
    PERFECT_LANDING_THRESHOLD: 0.85,

    // Grind detection radius
    GRIND_DETECT_RADIUS: 3,
};
